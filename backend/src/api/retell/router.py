
# ROUTER: RETELL AI INTEGRATIONS & OPERATIONS
# This module orchestrates all API endpoints relating to the Retell AI Voice
# Agent. It serves as the primary webhook destination for Retell callbacks,
# handles B2B inquiries logging, drafts/matches orders, and manages Clover POS mappings.

import os
import re
from datetime import datetime, date, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi import status as http_status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy import update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

# Imports for database query dependencies
from src.utils.db import get_db, User, Caller
from src.utils.dependencies import get_current_user
from src.utils.db_functions import (
    list_call_logs,
    get_call_log_by_call_id,
    get_combined_stats,
    get_caller_by_phone,
    upsert_caller,
    update_caller_last_called,
    create_call_log,
    update_call_log,
    get_agent_settings,
    build_menu_text,
    create_order,
    list_orders,
    get_order_by_id,
    update_order,
    get_order_stats,
    get_order_by_call_id,
    get_recent_order_for_caller,
    get_dashboard_stats,
    get_calls_over_time,
    get_orders_over_time,
    get_top_repeat_callers,
    get_sentiment_breakdown,
    upsert_menu_item_from_clover,
    delete_menu_item_by_clover_id,
    full_sync_menu_from_clover,
    auto_extract_order_items,
)
from src.services import retell_service
from src.api.outbound.utils import clean_customer_value

RETELL_API_KEY = os.getenv("RETELL_API_KEY", "")
RETELL_WEBHOOK_SECRET = os.getenv("RETELL_WEBHOOK_SECRET", "")

router = APIRouter(prefix="/api/retell", tags=["retell"])

ALLOWED_ORDER_STATUSES = {"received", "preparing", "ready", "completed", "cancelled"}
ALLOWED_ORDER_TYPES = {"pickup", "delivery"}


def _check_business_hours(current_hhmm: str, open_hhmm: str, close_hhmm: str) -> bool:
    def to_minutes(t: str) -> int:
        h, m = map(int, t.split(":"))
        return h * 60 + m
    now = to_minutes(current_hhmm)
    open_m = to_minutes(open_hhmm)
    close_m = to_minutes(close_hhmm)
    if open_m <= close_m:
        return open_m <= now <= close_m
    else:
        return now >= open_m or now <= close_m


class CallLogResponse(BaseModel):
    id: str
    call_id: str
    caller_phone: str
    customer_name: str | None
    call_status: str
    direction: str
    recording_url: str | None
    transcript: str | None
    call_summary: str | None
    order_booked: bool
    call_successful: bool | None
    user_sentiment: str | None
    duration_ms: int | None
    start_timestamp: int | None
    end_timestamp: int | None
    order_items: str | None
    order_type: str | None
    special_notes: str | None
    call_reason: str | None
    customer_name_extracted: str | None
    reservation_date: str | None
    party_size: str | None
    recall_at: datetime | None = None
    customer_feedback: str | None = None
    feedback_rating: int | None = None
    created_at: datetime
    order_details: "OrderResponse | None" = None

    @field_validator("customer_name", "customer_name_extracted", mode="before")
    @classmethod
    def empty_name_to_none(cls, v):
        if isinstance(v, str):
            val = v.strip()
            if not val or val.lower() in ("unknown", "n/a", "na", "none", "null", "undefined"):
                return None
            return val
        return v

    class Config:
        from_attributes = True


class CombinedStatsResponse(BaseModel):
    calls: dict
    orders: dict


class CallerResponse(BaseModel):
    id: str
    phone_number: str
    customer_name: str | None
    notes: str | None
    created_at: datetime
    last_called_at: datetime | None

    class Config:
        from_attributes = True


class UpdateCallerRequest(BaseModel):
    customer_name: str | None = None
    notes: str | None = None


class FlowNodeInstruction(BaseModel):
    type: str = "prompt"
    text: str


class FlowNodeUpdate(BaseModel):
    id: str
    type: str
    instruction: FlowNodeInstruction


class UpdateFlowRequest(BaseModel):
    global_prompt: str | None = None
    nodes: list[FlowNodeUpdate] | None = None
    default_dynamic_variables: dict | None = None
    model_choice: dict | None = None
    model_temperature: float | None = Field(default=None, ge=0, le=1)
    begin_message: str | None = None


class AddKnowledgeBaseRequest(BaseModel):
    kb_id: str


class InboundDynamicVariables(BaseModel):
    customer_name: str
    is_returning_customer: str
    customer_phone: str
    kitchen_is_open: str
    store_is_open: str
    menu: str
    closed_greeting: str
    open_greeting: str
    pickup_address: str
    delivery_address: str
    restaurant_name: str
    kitchen_open_time: str
    kitchen_close_time: str
    restaurant_info: str
    wait_time_pickup: str
    wait_time_delivery: str


class InboundCallInnerResponse(BaseModel):
    dynamic_variables: InboundDynamicVariables


class InboundWebhookResponse(BaseModel):
    call_inbound: InboundCallInnerResponse


class WebhookResponse(BaseModel):
    received: bool


class OrderResponse(BaseModel):
    order_id: str
    call_id: str | None
    caller_phone: str
    customer_name: str
    order_items: list[dict]
    order_type: str
    delivery_address: str | None
    total_amount: float | None
    status: str
    special_notes: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrderListResponse(BaseModel):
    orders: list[OrderResponse]
    total: int
    skip: int
    limit: int


class OrderStatsResponse(BaseModel):
    total: int
    received: int
    preparing: int
    ready: int
    completed: int
    cancelled: int
    today: int


class OrderUpdateRequest(BaseModel):
    status: str | None = None
    special_notes: str | None = None
    delivery_address: str | None = None


class CloverItemMapItem(BaseModel):
    item_name: str
    clover_item_id: str
    clover_item_name: str | None = None
    is_active: bool

    class Config:
        from_attributes = True


class CloverItemMapRequest(BaseModel):
    item_name: str
    clover_item_id: str
    clover_item_name: str | None = None


class CloverSyncResponse(BaseModel):
    auto_mapped: list[str]
    unmatched_clover_items: list[str]
    total_clover_items: int
    total_mapped: int


class RepeatCallerItem(BaseModel):
    phone: str
    name: str
    call_count: int


class ReportSummary(BaseModel):
    total_calls: int
    total_orders: int
    total_minutes: float
    successful_calls: int
    repeat_callers: int
    new_callers: int
    order_type_distribution: dict


class ReportResponse(BaseModel):
    period_days: int
    summary: ReportSummary
    calls_over_time: list[dict]
    orders_over_time: list[dict]
    top_repeat_callers: list[RepeatCallerItem]
    sentiment_breakdown: dict


class OrderConfirmRequest(BaseModel):
    customer_name: str
    customer_phone: str
    order_items: list[dict]
    order_type: str
    delivery_address: str = ""
    total_amount: float | None = None


@router.get("/reports", response_model=ReportResponse)
async def get_reports(
    days: int = 7,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    summary = await get_dashboard_stats(db, days)
    calls_over_time = await get_calls_over_time(db, days)
    orders_over_time = await get_orders_over_time(db, days)
    top_repeat_callers = await get_top_repeat_callers(db, days)
    sentiment_breakdown = await get_sentiment_breakdown(db, days)
    return ReportResponse(
        period_days=days,
        summary=ReportSummary(**summary),
        calls_over_time=calls_over_time,
        orders_over_time=orders_over_time,
        top_repeat_callers=[RepeatCallerItem(**r) for r in top_repeat_callers],
        sentiment_breakdown=sentiment_breakdown,
    )


@router.get("/calls", response_model=list[CallLogResponse])
async def get_calls(
    skip: int = 0,
    limit: int = 20,
    call_status: str | None = None,
    order_booked: bool | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    logs = await list_call_logs(db, skip, limit, call_status, order_booked)
    return await _enrich_call_logs_with_caller_names(db, logs)


@router.get("/calls/{call_id}", response_model=CallLogResponse)
async def get_call(
    call_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    log = await get_call_log_by_call_id(db, call_id)
    if not log:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Call log not found")
    enriched = await _enrich_call_logs_with_caller_names(db, [log])
    return enriched[0]


@router.get("/calls/{call_id}/live")
async def get_live_call(call_id: str, _: User = Depends(get_current_user)) -> dict:
    return await retell_service.get_call(call_id)


class RecallRequest(BaseModel):
    recall_at: datetime | None


@router.patch("/calls/{call_id}/recall", response_model=CallLogResponse)
async def set_call_recall(
    call_id: str,
    body: RecallRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Manually set or clear the callback reminder time for an inbound call log."""
    from src.utils.db import CallLog
    from sqlalchemy import select
    result = await db.execute(select(CallLog).where(CallLog.call_id == call_id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Call log not found")
    log.recall_at = body.recall_at
    await db.commit()
    await db.refresh(log)
    enriched = await _enrich_call_logs_with_caller_names(db, [log])
    return enriched[0]


@router.get("/stats", response_model=CombinedStatsResponse)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stats = await get_combined_stats(db)
    return CombinedStatsResponse(**stats)


@router.get("/flow")
async def get_flow(_: User = Depends(get_current_user)) -> dict:
    return await retell_service.get_conversation_flow()


@router.patch("/flow")
async def update_flow(
    body: UpdateFlowRequest,
    _: User = Depends(get_current_user),
) -> dict:
    payload = body.model_dump(exclude_none=True)
    return await retell_service.update_conversation_flow(payload)


@router.get("/knowledge-bases")
async def get_knowledge_bases(_: User = Depends(get_current_user)) -> dict:
    return await retell_service.list_knowledge_bases()


@router.post("/flow/knowledge-base")
async def add_knowledge_base(
    body: AddKnowledgeBaseRequest,
    _: User = Depends(get_current_user),
) -> dict:
    return await retell_service.add_knowledge_base_to_flow(body.kb_id)


@router.delete("/flow/knowledge-base/{kb_id}")
async def remove_knowledge_base(
    kb_id: str,
    _: User = Depends(get_current_user),
) -> dict:
    return await retell_service.remove_knowledge_base_from_flow(kb_id)


@router.get("/callers", response_model=list[CallerResponse])
async def get_callers(
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Caller).offset(skip).limit(limit))
    callers = result.scalars().all()
    return [CallerResponse.model_validate(c) for c in callers]


@router.get("/callers/{phone_number}", response_model=CallerResponse)
async def get_caller(
    phone_number: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    caller = await get_caller_by_phone(db, phone_number)
    if not caller:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Caller not found")
    return CallerResponse.model_validate(caller)


@router.patch("/callers/{phone_number}", response_model=CallerResponse)
async def update_caller(
    phone_number: str,
    body: UpdateCallerRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    caller = await get_caller_by_phone(db, phone_number)
    if not caller:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Caller not found")
    updates = body.model_dump(exclude_none=True)
    if updates:
        await db.execute(
            sa_update(Caller).where(Caller.phone_number == phone_number).values(**updates)
        )
        await db.commit()
        await db.refresh(caller)
    return CallerResponse.model_validate(caller)


@router.get("/orders/stats", response_model=OrderStatsResponse)
async def get_orders_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stats = await get_order_stats(db)
    return OrderStatsResponse(**stats)


@router.get("/orders", response_model=OrderListResponse)
async def get_orders(
    skip: int = 0,
    limit: int = 20,
    status: str | None = None,
    date: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from sqlalchemy import func as sa_func, select as sa_select
    from src.utils.db import Order
    count_query = sa_select(sa_func.count()).select_from(Order)
    if status:
        count_query = count_query.where(Order.status == status)
    if date:
        from datetime import date as date_type
        count_query = count_query.where(sa_func.date(Order.created_at) == date_type.fromisoformat(date))
    total = await db.scalar(count_query) or 0
    rows = await list_orders(db, skip, limit, status, date)
    return OrderListResponse(
        orders=[OrderResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    order = await get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Order not found")
    return OrderResponse.model_validate(order)


@router.patch("/orders/{order_id}", response_model=OrderResponse)
async def patch_order(
    order_id: str,
    body: OrderUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    updates = body.model_dump(exclude_none=True)
    if "status" in updates and updates["status"] not in ALLOWED_ORDER_STATUSES:
        raise HTTPException(
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"status must be one of: {', '.join(ALLOWED_ORDER_STATUSES)}",
        )
    updated = await update_order(db, order_id, **updates)
    return OrderResponse.model_validate(updated)


@router.post("/orders/{order_id}/reprint")
async def reprint_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    order = await get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    if not order.clover_order_id:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Order is not synced to Clover POS",
        )

    from src.services import clover_service
    import httpx
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            print_resp = await client.post(
                f"{clover_service._merchant_base()}/print_event",
                headers=clover_service._headers(),
                json={"orderRef": {"id": order.clover_order_id}},
            )
            print_resp.raise_for_status()
    except Exception as exc:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Clover print failed: {str(exc)}",
        )
    return {"success": True, "message": "Print command sent to warehouse printer"}


@router.post("/calls/{call_id}/order", response_model=OrderResponse)
async def create_order_from_call(
    call_id: str,
    body: OrderConfirmRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Endpoint: Manually confirms and submits an order extracted from a Call Log draft.

    How this works:
      1. Confirms the Call Log exists.
      2. Creates a formal Order record.
      3. Marks 'order_booked=True' on the Call Log.
      4. Saves/upserts the Caller information.
      5. Matches items to active database prices and submits the order to Clover POS.
    """
    log = await get_call_log_by_call_id(db, call_id)
    if not log:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Call log not found"
        )

    order = await create_order(
        db,
        caller_phone=body.customer_phone,
        customer_name=body.customer_name,
        order_items=body.order_items,
        order_type=body.order_type,
        delivery_address=body.delivery_address.strip() or None,
        total_amount=body.total_amount,
        special_notes=None,
        call_id=call_id,
    )

    await update_call_log(db, call_id=call_id, order_booked=True)
    await upsert_caller(db, body.customer_phone, body.customer_name)

    import logging
    from src.services import clover_service
    from src.utils.db_functions import update_order_clover_status, get_menu_items_prices
    _logger = logging.getLogger(__name__)

    if os.getenv("CLOVER_API_TOKEN") and os.getenv("CLOVER_MERCHANT_ID"):
        try:
            item_names = [i.get("item", "") for i in body.order_items]
            prices_map = await get_menu_items_prices(db, item_names)
            enhanced_items = []
            for item in body.order_items:
                name = item.get("item", "Unknown Item")
                db_price = prices_map.get(name.lower(), 0.0)
                enhanced_item = dict(item)
                enhanced_item["price"] = db_price
                enhanced_items.append(enhanced_item)
            clover_result = await clover_service.push_order_to_clover(
                order_items=enhanced_items,
                customer_name=body.customer_name,
            )
            await update_order_clover_status(db, order.order_id, clover_result["clover_order_id"], True)
        except Exception as exc:
            _logger.error("Clover push failed: %s", exc)
            await update_order_clover_status(db, order.order_id, None, False, str(exc))

    db_order = await get_order_by_id(db, order.order_id)
    return db_order


@router.post("/order-confirm")
async def order_confirm(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Endpoint: Called by the Retell Voice Agent *during* a live call to place an order.
    Returns a conversational confirmation message that the voice agent speaks back to the caller.
    """
    try:
        raw = await request.json()
    except Exception:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload")
    try:
        body = OrderConfirmRequest(**raw)
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))

    if body.order_type not in ALLOWED_ORDER_TYPES:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"order_type must be one of: {', '.join(ALLOWED_ORDER_TYPES)}",
        )
    if body.order_type == "delivery" and not body.delivery_address.strip():
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Delivery address is required for delivery orders.",
        )

    call_id = request.headers.get("x-retell-call-id") or raw.get("call_id")

    order = await create_order(
        db,
        caller_phone=body.customer_phone,
        customer_name=body.customer_name,
        order_items=body.order_items,
        order_type=body.order_type,
        delivery_address=body.delivery_address.strip() or None,
        total_amount=body.total_amount,
        special_notes=None,
        call_id=call_id,
    )
    await upsert_caller(db, body.customer_phone, body.customer_name)

    import logging
    from src.services import clover_service
    from src.utils.db_functions import update_order_clover_status, get_menu_items_prices
    _logger = logging.getLogger(__name__)

    if os.getenv("CLOVER_API_TOKEN") and os.getenv("CLOVER_MERCHANT_ID"):
        try:
            item_names = [i.get("item", "") for i in body.order_items]
            prices_map = await get_menu_items_prices(db, item_names)
            enhanced_items = []
            for item in body.order_items:
                name = item.get("item", "Unknown Item")
                db_price = prices_map.get(name.lower(), 0.0)
                enhanced_item = dict(item)
                enhanced_item["price"] = db_price
                enhanced_items.append(enhanced_item)
            clover_result = await clover_service.push_order_to_clover(
                order_items=enhanced_items,
                customer_name=body.customer_name,
            )
            await update_order_clover_status(db, order.order_id, clover_result["clover_order_id"], True)
        except Exception as exc:
            _logger.error("Clover push failed: %s", exc)
            await update_order_clover_status(db, order.order_id, None, False, str(exc))

    messages = {
        "pickup": "Your order has been confirmed. It will be ready for pickup in about 15 minutes.",
        "delivery": "Your order has been confirmed and will be delivered to you in about 30 minutes.",
    }
    return {"order_id": order.order_id, "message": messages[body.order_type]}


@router.post("/inbound-webhook", response_model=InboundWebhookResponse)
async def inbound_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Endpoint: Webhook called by Retell AI when a phone call is initiated (inbound call starts).
    Retell asks our backend for 'dynamic variables' to customize the conversation prompt.
    """
    try:
        event = await request.json()
    except Exception:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload")

    call_inbound = event.get("call_inbound", {})
    from_number = call_inbound.get("from_number", "")

    existing_caller = await get_caller_by_phone(db, from_number)
    dynamic_vars = retell_service.build_caller_dynamic_variables(existing_caller, from_number)

    await upsert_caller(db, from_number, existing_caller.customer_name if existing_caller else None)
    await update_caller_last_called(db, from_number)

    settings = await get_agent_settings(db)
    try:
        from zoneinfo import ZoneInfo
        tz = ZoneInfo(settings.restaurant_timezone)
    except Exception:
        from datetime import timezone as _tz
        tz = _tz.utc

    now_hhmm = datetime.now(tz).strftime("%H:%M")

    if settings.is_active:
        store_open = "true" if _check_business_hours(now_hhmm, settings.store_open_time, settings.store_close_time) else "false"
        kitchen_open = "true" if _check_business_hours(now_hhmm, settings.kitchen_open_time, settings.kitchen_close_time) else "false"
    else:
        store_open = "false"
        kitchen_open = "false"

    dynamic_vars["kitchen_is_open"] = kitchen_open
    dynamic_vars["store_is_open"] = store_open
    dynamic_vars["menu"] = await build_menu_text(db)
    dynamic_vars["closed_greeting"] = settings.closed_greeting or "We are currently closed. Please call back during our business hours."
    dynamic_vars["open_greeting"] = settings.open_greeting or ""
    dynamic_vars["pickup_address"] = settings.pickup_address or ""
    dynamic_vars["delivery_address"] = settings.delivery_address or ""
    dynamic_vars["restaurant_name"] = settings.restaurant_name or "Mitchell's Fruit Farms"
    dynamic_vars["restaurant_info"] = settings.restaurant_info or "Mitchell's is a historic food manufacturer in Pakistan, producing high-quality jams, squashes, ketchups, sauces, and confectionery since 1933."
    dynamic_vars["wait_time_pickup"] = settings.wait_time_pickup or "15"
    dynamic_vars["wait_time_delivery"] = settings.wait_time_delivery or "30"
    dynamic_vars["kitchen_open_time"] = settings.kitchen_open_time
    dynamic_vars["kitchen_close_time"] = settings.kitchen_close_time

    return InboundWebhookResponse(
        call_inbound=InboundCallInnerResponse(
            dynamic_variables=InboundDynamicVariables(**dynamic_vars)
        )
    )


def _extract_caller_name(data: dict | None) -> str | None:
    if not data:
        return None
    for key in ("customer_name", "caller_name", "name", "owner_name", "user_name", "caller", "customer"):
        val = clean_customer_value(data.get(key))
        if val:
            return val
    return None


def _extract_company_from_data(*sources: dict | None) -> str | None:
    for data in sources:
        if not data:
            continue
        for key in (
            "company_name",
            "company",
            "customer_company",
            "business_name",
            "shop_name",
            "store_name",
            "organization",
        ):
            company = clean_customer_value(data.get(key))
            if company:
                return company
    return None


def _extract_name_from_summary(summary: str) -> str | None:
    if not summary:
        return None
    m = re.search(r"\b(?:contacted|spoke with|spoke to|called|talked to|conversing with)\s+([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)?)\s+(?:from|at|in|to|regarding|about|on)\b", summary)
    if m:
        name = m.group(1).strip()
        if name.lower() not in ("the user", "the customer", "the client", "the distributor", "the retailer", "the agent", "the store", "ahmad store"):
            return clean_customer_value(name)
    m = re.search(r"\b(?:contacted|spoke with|spoke to|called|talked to)\s+([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)?)\b", summary)
    if m:
        name = m.group(1).strip()
        if name.lower() not in ("the user", "the customer", "the client", "the distributor", "the retailer", "the agent", "the store", "ahmad store"):
            return clean_customer_value(name)
    return None


def _extract_company_from_summary(summary: str) -> str | None:
    if not summary:
        return None
    patterns = (
        r"\b(?:customer company is|company is|business is|shop is|store is)\s+([A-Z][a-zA-Z0-9'&.-]*(?:\s+[A-Z][a-zA-Z0-9'&.-]*){0,4})\b",
        r"\b(?:from|at|of)\s+([A-Z][a-zA-Z0-9']+(?:\s+[A-Z][a-zA-Z0-9']+){0,3}\s+(?:Store|Shop|Mart|Distributor|Ltd|Co|Incorporated|Inc|Enterprises|Traders|Supermarket))\b",
    )
    for pattern in patterns:
        m = re.search(pattern, summary, re.IGNORECASE)
        if m:
            return clean_customer_value(m.group(1))
    return None


def _is_outbound_call(call_data: dict) -> bool:
    if call_data.get("direction") == "outbound":
        return True
    metadata = call_data.get("metadata") or {}
    return bool(metadata.get("campaign_id") or metadata.get("contact_id"))


async def _enrich_call_logs_with_caller_names(
    db: AsyncSession,
    logs: list,
) -> list[CallLogResponse]:
    from src.utils.db_functions import normalize_phone_number

    phones = {
        log.caller_phone
        for log in logs
        if log.caller_phone
        and not (log.customer_name_extracted or log.customer_name)
    }
    caller_names: dict[str, str] = {}
    if phones:
        result = await db.execute(select(Caller))
        all_callers = result.scalars().all()
        normalized_caller_map = {}
        for c in all_callers:
            if c.customer_name:
                norm_p = normalize_phone_number(c.phone_number)
                if norm_p:
                    normalized_caller_map[norm_p] = c.customer_name
        for log_phone in phones:
            norm_log_p = normalize_phone_number(log_phone)
            name = normalized_caller_map.get(norm_log_p)
            if name:
                caller_names[log_phone] = name

    responses = []
    for log in logs:
        resp = CallLogResponse.model_validate(log)
        if not resp.customer_name_extracted and not resp.customer_name:
            name = caller_names.get(log.caller_phone)
            if name:
                resp = resp.model_copy(update={"customer_name": name})
        responses.append(resp)
    return responses


@router.post("/webhook", response_model=WebhookResponse)
async def webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Endpoint: Main webhook listener that receives event notifications from Retell AI.

    This handles two major event types:
      1. 'call_ended': Fired immediately when the call finishes.
      2. 'call_analyzed': Fired after LLM completes call summaries.
    """
    try:
        event = await request.json()
    except Exception:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload")

    event_type = event.get("event")
    call_data = event.get("call", {})
    call_id = call_data.get("call_id", "")

    if _is_outbound_call(call_data):
        from src.api.outbound.service import outbound_service
        await outbound_service.process_webhook(db, event)

    if event_type == "call_ended":
        direction = call_data.get("direction", "inbound")
        from_number = call_data.get("to_number", "") if direction == "outbound" else call_data.get("from_number", "")

        collected = call_data.get("collected_dynamic_variables") or {}
        customer_name_extracted = _extract_caller_name(collected)
        order_items = (collected.get("order_items_summary") or "").strip() or None
        order_type = (collected.get("order_type") or "").strip() or None
        special_notes = (collected.get("special_notes") or "").strip() or None
        reservation_date = (collected.get("reservation_date") or "").strip() or None
        party_size = (collected.get("party_size") or "").strip() or None

        existing_log = await get_call_log_by_call_id(db, call_id)
        if not existing_log:
            caller = await get_caller_by_phone(db, from_number)
            existing_log = await create_call_log(
                db,
                call_id=call_id,
                caller_phone=from_number,
                customer_name=caller.customer_name if caller else None,
                direction=direction,
                call_status="ended",
            )

        update_data = {
            "call_status": "ended",
            "duration_ms": call_data.get("duration_ms"),
            "end_timestamp": call_data.get("end_timestamp"),
            "start_timestamp": call_data.get("start_timestamp"),
            "transcript": call_data.get("transcript"),
            "recording_url": call_data.get("recording_url"),
            "raw_payload": event,
        }
        if order_items:
            update_data["order_items"] = order_items
        if order_type:
            update_data["order_type"] = order_type
        if special_notes:
            update_data["special_notes"] = special_notes
        if customer_name_extracted:
            update_data["customer_name_extracted"] = customer_name_extracted
            if not existing_log.customer_name:
                update_data["customer_name"] = customer_name_extracted
        if reservation_date:
            update_data["reservation_date"] = reservation_date
        if party_size:
            update_data["party_size"] = party_size

        await update_call_log(db, call_id, **update_data)

        if customer_name_extracted and from_number:
            await upsert_caller(db, from_number, customer_name_extracted)

        recent_order = await get_order_by_call_id(db, call_id)
        if not recent_order and from_number:
            recent_order = await get_recent_order_for_caller(db, from_number, minutes=60)
            if recent_order:
                await update_order(db, recent_order.order_id, call_id=call_id)

        if recent_order:
            await update_call_log(db, call_id, order_booked=True)
        elif order_items:
            import logging as _logging
            from src.services import clover_service
            from src.utils.db_functions import update_order_clover_status
            _auto_logger = _logging.getLogger("auto_order")

            structured = await auto_extract_order_items(
                db,
                order_items_text=order_items or "",
                call_summary_text="",
            )

            resolved_order_type = order_type if order_type in ("pickup", "delivery") else "pickup"
            customer = customer_name_extracted or "Guest"
            phone = from_number or ""

            if structured:
                total = sum(i["price"] * i["quantity"] for i in structured)
                auto_order = await create_order(
                    db,
                    caller_phone=phone,
                    customer_name=customer,
                    order_items=structured,
                    order_type=resolved_order_type,
                    delivery_address=None,
                    total_amount=round(total, 2),
                    special_notes=special_notes,
                    call_id=call_id,
                )
                await update_call_log(db, call_id, order_booked=True)
                _auto_logger.info("Auto-order created for call %s: %d item(s), total $%.2f", call_id, len(structured), total)

                if os.getenv("CLOVER_API_TOKEN") and os.getenv("CLOVER_MERCHANT_ID"):
                    try:
                        clover_result = await clover_service.push_order_to_clover(order_items=structured, customer_name=customer)
                        await update_order_clover_status(db, auto_order.order_id, clover_result["clover_order_id"], True)
                        _auto_logger.info("Auto-order synced to Clover: %s", clover_result["clover_order_id"])
                    except Exception as exc:
                        _auto_logger.error("Auto-order Clover push failed for %s: %s", call_id, exc)
                        await update_order_clover_status(db, auto_order.order_id, None, False, str(exc))
            else:
                _auto_logger.warning("Auto-order: no menu items matched for call %s - saving draft", call_id)
                await update_call_log(db, call_id, order_booked=True)

    elif event_type == "call_analyzed":
        analysis = call_data.get("call_analysis")
        if not isinstance(analysis, dict):
            analysis = {}
        custom = analysis.get("custom_analysis_data")
        if not isinstance(custom, dict):
            custom = {}

        call_reason = (custom.get("call_reason") or "").strip() or None

        # Extract customer feedback fields from Retell's custom_analysis_data
        customer_feedback_raw = custom.get("customer_feedback")
        customer_feedback = str(customer_feedback_raw).strip() if customer_feedback_raw and str(customer_feedback_raw).strip().lower() not in ("none", "null", "n/a", "") else None

        feedback_rating_raw = custom.get("feedback_rating")
        feedback_rating = None
        if feedback_rating_raw is not None:
            try:
                rating_int = int(float(str(feedback_rating_raw)))
                if 1 <= rating_int <= 5:
                    feedback_rating = rating_int
            except (ValueError, TypeError):
                pass

        existing_log = await get_call_log_by_call_id(db, call_id)
        already_booked = False
        existing_call_reason = None
        if existing_log:
            already_booked = existing_log.order_booked
            existing_call_reason = existing_log.call_reason

        call_reason = call_reason or existing_call_reason
        is_order_booked = already_booked or bool(custom.get("order_booked", False))

        raw_success = custom.get("call_successful")
        is_success = None
        if isinstance(raw_success, str):
            is_success = raw_success.strip().lower() in ("true", "1", "yes")
        elif isinstance(raw_success, bool):
            is_success = raw_success

        if is_order_booked:
            is_success = True

        if is_success is None:
            sentiment = (analysis.get("user_sentiment") or "").strip().lower()
            if sentiment in ("positive", "neutral"):
                is_success = True
            else:
                is_success = False

        direction = call_data.get("direction", "inbound")
        from_number = call_data.get("to_number", "") if direction == "outbound" else call_data.get("from_number", "")
        if not from_number and existing_log:
            from_number = existing_log.caller_phone

        collected = call_data.get("collected_dynamic_variables") or {}
        call_summary_text = analysis.get("call_summary") or ""
        extracted_company = (
            _extract_company_from_data(collected, custom)
            or _extract_company_from_summary(call_summary_text)
        )
        extracted_name = (
            _extract_caller_name(collected)
            or _extract_caller_name(custom)
        )
        if not extracted_name and call_summary_text:
            extracted_name = _extract_name_from_summary(call_summary_text)

        name_updates: dict = {}
        if extracted_name:
            name_updates["customer_name_extracted"] = extracted_name
            if not existing_log or not existing_log.customer_name:
                name_updates["customer_name"] = extracted_name
            if from_number:
                await upsert_caller(db, from_number, extracted_name)

        if direction == "outbound" and existing_log and (extracted_name or extracted_company):
            from src.api.outbound import repository as outbound_repo
            from src.utils.db import OutboundCall
            res_outbound = await db.execute(select(OutboundCall).where(OutboundCall.retell_call_id == call_id))
            outbound_call = res_outbound.scalar_one_or_none()
            if outbound_call:
                contact = await outbound_repo.get_contact(db, outbound_call.contact_id)
                if contact:
                    kwargs_updates = {}
                    if extracted_name:
                        kwargs_updates["name"] = extracted_name
                    if extracted_company and not contact.company:
                        kwargs_updates["company"] = extracted_company
                    if kwargs_updates:
                        await outbound_repo.update_contact(db, contact, **kwargs_updates)

        recent_order = await get_order_by_call_id(db, call_id)
        if not recent_order and from_number:
            recent_order = await get_recent_order_for_caller(db, from_number, minutes=60)
            if recent_order:
                await update_order(db, recent_order.order_id, call_id=call_id)
                is_order_booked = True
                is_success = True

        _SUMMARY_ORDER_KEYWORDS = [
            "placed an order", "place a business order",
            "logged the trade inquiry", "logged the export inquiry",
            "trade inquiry", "export inquiry", "import inquiry",
            "bulk order", "capturing order details", "successfully logged",
            "order for", "reorder", "order request", "recorded the order",
            "confirm a reorder", "confirm the order", "placed order",
        ]
        call_summary_text = (analysis.get("call_summary") or "").lower()
        if (
            not is_order_booked
            and is_success
            and any(kw in call_summary_text for kw in _SUMMARY_ORDER_KEYWORDS)
        ):
            is_order_booked = True
            is_success = True

        if is_order_booked and not recent_order:
            order_items_collected = existing_log.order_items if existing_log else None
            structured = await auto_extract_order_items(
                db,
                order_items_text=order_items_collected or "",
                call_summary_text=analysis.get("call_summary") or "",
            )
            if structured:
                customer_name_extracted = (
                    _extract_caller_name(custom)
                    or _extract_caller_name(collected)
                )
                if not customer_name_extracted and existing_log:
                    customer_name_extracted = existing_log.customer_name_extracted or existing_log.customer_name
                customer = customer_name_extracted or "Guest"
                phone = from_number or ""

                order_type_val = (custom.get("order_type") or "").strip().lower()
                if not order_type_val and existing_log:
                    order_type_val = (existing_log.order_type or "").strip().lower()
                resolved_order_type = order_type_val if order_type_val in ("pickup", "delivery") else "pickup"

                special_notes_val = (custom.get("special_notes") or "").strip()
                if not special_notes_val and existing_log:
                    special_notes_val = existing_log.special_notes
                special_notes_val = special_notes_val or None

                total = sum(i["price"] * i["quantity"] for i in structured)
                auto_order = await create_order(
                    db,
                    caller_phone=phone,
                    customer_name=customer,
                    order_items=structured,
                    order_type=resolved_order_type,
                    delivery_address=None,
                    total_amount=round(total, 2),
                    special_notes=special_notes_val,
                    call_id=call_id,
                )

                if os.getenv("CLOVER_API_TOKEN") and os.getenv("CLOVER_MERCHANT_ID"):
                    try:
                        from src.services import clover_service
                        from src.utils.db_functions import update_order_clover_status
                        clover_result = await clover_service.push_order_to_clover(order_items=structured, customer_name=customer)
                        await update_order_clover_status(db, auto_order.order_id, clover_result["clover_order_id"], True)
                    except Exception as exc:
                        import logging as _logging
                        _logging.getLogger("auto_order").error("Auto-order Clover push failed on call_analyzed for %s: %s", call_id, exc)
                        from src.utils.db_functions import update_order_clover_status
                        await update_order_clover_status(db, auto_order.order_id, None, False, str(exc))

                recent_order = auto_order

        # Build feedback updates dict
        feedback_updates: dict = {}
        if customer_feedback:
            feedback_updates["customer_feedback"] = customer_feedback
        if feedback_rating is not None:
            feedback_updates["feedback_rating"] = feedback_rating

        if is_order_booked and not recent_order:
            if "export" in call_summary_text:
                inferred_order_type = "B2B Export Inquiry"
            elif "import" in call_summary_text:
                inferred_order_type = "B2B Import Inquiry"
            elif any(kw in call_summary_text for kw in ["trade", "wholesale", "bulk"]):
                inferred_order_type = "B2B Trade Inquiry"
            else:
                inferred_order_type = existing_log.order_type if existing_log else "pickup"

            await update_call_log(
                db,
                call_id,
                call_summary=analysis.get("call_summary"),
                user_sentiment="Positive" if is_order_booked else analysis.get("user_sentiment"),
                order_booked=True,
                call_successful=True,
                call_reason=call_reason,
                order_items=analysis.get("call_summary"),
                order_type=inferred_order_type,
                **name_updates,
                **feedback_updates,
            )
        else:
            await update_call_log(
                db,
                call_id,
                call_summary=analysis.get("call_summary"),
                user_sentiment="Positive" if is_order_booked else analysis.get("user_sentiment"),
                order_booked=is_order_booked,
                call_successful=is_success,
                call_reason=call_reason,
                **name_updates,
                **feedback_updates,
            )

    return WebhookResponse(received=True)


@router.get("/clover/inventory")
async def clover_inventory(_: User = Depends(get_current_user)) -> list[dict]:
    from src.services import clover_service
    items = await clover_service.get_clover_inventory()
    return [{"id": i.get("id"), "name": i.get("name"), "price": i.get("price")} for i in items]


@router.get("/clover/order-types")
async def clover_order_types(_: User = Depends(get_current_user)) -> list[dict]:
    from src.services import clover_service
    return await clover_service.get_clover_order_types()


@router.get("/clover/item-map", response_model=list[CloverItemMapItem])
async def get_item_map(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from src.utils.db import CloverItemMap
    result = await db.execute(select(CloverItemMap))
    return [CloverItemMapItem.model_validate(r) for r in result.scalars().all()]


@router.post("/clover/item-map")
async def save_item_map(
    body: CloverItemMapRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    from src.utils.db_functions import upsert_clover_item
    await upsert_clover_item(db, body.item_name, body.clover_item_id, body.clover_item_name)
    return {"message": "Item mapping saved"}


@router.delete("/clover/item-map/{item_name}")
async def remove_item_map(
    item_name: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    from src.utils.db_functions import delete_clover_item
    await delete_clover_item(db, item_name)
    return {"message": "Item mapping removed"}


@router.post("/clover/sync-inventory", response_model=CloverSyncResponse)
async def sync_clover_inventory(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from src.services import clover_service
    from src.utils.db_functions import upsert_clover_item, get_clover_item_map
    from src.utils.db import MenuItem
    clover_items = await clover_service.get_clover_inventory()

    menu_result = await db.execute(select(MenuItem).where(MenuItem.is_available == True))
    menu_items = list(menu_result.scalars().all())

    auto_mapped: list[str] = []
    unmatched: list[str] = []

    for ci in clover_items:
        ci_name = (ci.get("name") or "").strip().lower()
        ci_id = ci.get("id", "")
        matched = False
        for mi in menu_items:
            mi_name = (mi.name or "").strip().lower()
            if ci_name in mi_name or mi_name in ci_name:
                await upsert_clover_item(db, mi.name, ci_id, ci.get("name"))
                auto_mapped.append(mi.name)
                matched = True
                break
        if not matched:
            unmatched.append(ci.get("name", ""))

    current_map = await get_clover_item_map(db)
    return CloverSyncResponse(
        auto_mapped=auto_mapped,
        unmatched_clover_items=unmatched,
        total_clover_items=len(clover_items),
        total_mapped=len(current_map),
    )


@router.get("/square/locations")
async def square_locations(_: User = Depends(get_current_user)) -> list[dict]:
    from src.services import square_service
    return await square_service.get_square_locations()


@router.post("/menu/sync-from-clover")
async def sync_menu_from_clover(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    """Full replacement sync: pull all Clover items and replace local menu."""
    from src.services.clover_service import fetch_all_clover_items
    items = await fetch_all_clover_items()
    result = await full_sync_menu_from_clover(db, items)
    return {"total_clover_items": len(items), **result}


@router.post("/clover/webhook")
async def clover_inventory_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Receive Clover inventory change webhooks and sync to local DB."""
    import logging
    _wh_logger = logging.getLogger(__name__)
    from src.services.clover_service import fetch_clover_item

    try:
        payload = await request.json()
    except Exception:
        return {"received": False}

    events = payload if isinstance(payload, list) else [payload]

    for event in events:
        event_type = event.get("type", "")
        item_id = event.get("itemId", event.get("objectId", ""))
        if not item_id:
            continue

        if event_type == "DELETE":
            await delete_menu_item_by_clover_id(db, item_id)
            _wh_logger.info("Clover webhook: deleted item %s", item_id)
        else:
            try:
                item = await fetch_clover_item(item_id)
                await upsert_menu_item_from_clover(db, item)
                _wh_logger.info("Clover webhook: upserted item %s", item_id)
            except Exception as exc:
                _wh_logger.error("Clover webhook: failed for %s: %s", item_id, exc)

    return {"received": True}


@router.post("/trade-inquiry")
async def log_trade_inquiry(request: Request, db: AsyncSession = Depends(get_db)):
    """Log a B2B trade or wholesale inquiry from Retell AI."""
    import uuid
    from src.utils.db import TradeInquiry
    try:
        data = await request.json()
    except Exception:
        return {"success": False, "message": "Invalid JSON body"}

    inquiry = TradeInquiry(
        id=str(uuid.uuid4()),
        caller_name=data.get("caller_name", ""),
        caller_phone=data.get("caller_phone", ""),
        company_name=data.get("company_name", ""),
        location=data.get("location", ""),
        product_interest=data.get("product_interest", ""),
        notes=data.get("notes", ""),
        email=data.get("email", ""),
        caller_type=data.get("caller_type", "")
    )
    db.add(inquiry)
    await db.commit()

    call_id = request.headers.get("x-retell-call-id") or data.get("call_id")
    if call_id:
        existing_log = await get_call_log_by_call_id(db, call_id)
        caller_phone = data.get("caller_phone", "")
        caller_name = data.get("caller_name", "")
        if caller_phone:
            await upsert_caller(db, caller_phone, caller_name or None)
        if not existing_log:
            existing_log = await create_call_log(
                db,
                call_id=call_id,
                caller_phone=caller_phone or "Unknown",
                customer_name=caller_name or None,
                direction="inbound",
                call_status="ongoing",
            )

        product_interest = data.get("product_interest", "")
        company_name = data.get("company_name", "")
        location = data.get("location", "")
        caller_type = data.get("caller_type", "")
        notes = data.get("notes", "")
        order_desc = f"B2B Trade Inquiry: {product_interest}"
        notes_parts = []
        if company_name:
            notes_parts.append(f"Company: {company_name}")
        if location:
            notes_parts.append(f"Location: {location}")
        if caller_type:
            notes_parts.append(f"Caller Type: {caller_type}")
        if notes:
            notes_parts.append(f"Notes: {notes}")
        special_notes = ", ".join(notes_parts) if notes_parts else None

        await update_call_log(
            db,
            call_id=call_id,
            order_booked=True,
            order_items=order_desc,
            order_type="B2B Trade Inquiry",
            special_notes=special_notes,
            customer_name=caller_name or None,
            customer_name_extracted=caller_name or None,
        )

    return {"inquiry_id": inquiry.id, "message": "Trade inquiry logged successfully."}


@router.post("/export-inquiry")
async def log_export_inquiry(request: Request, db: AsyncSession = Depends(get_db)):
    """Log an international export or import inquiry from Retell AI."""
    import uuid
    from src.utils.db import ExportInquiry
    try:
        data = await request.json()
    except Exception:
        return {"success": False, "message": "Invalid JSON body"}

    inquiry = ExportInquiry(
        id=str(uuid.uuid4()),
        caller_name=data.get("caller_name", ""),
        caller_phone=data.get("caller_phone", ""),
        company_name=data.get("company_name", ""),
        country=data.get("country", ""),
        product_interest=data.get("product_interest", ""),
        notes=data.get("notes", ""),
        email=data.get("email", "")
    )
    db.add(inquiry)
    await db.commit()

    call_id = request.headers.get("x-retell-call-id") or data.get("call_id")
    if call_id:
        existing_log = await get_call_log_by_call_id(db, call_id)
        caller_phone = data.get("caller_phone", "")
        caller_name = data.get("caller_name", "")
        if caller_phone:
            await upsert_caller(db, caller_phone, caller_name or None)
        if not existing_log:
            existing_log = await create_call_log(
                db,
                call_id=call_id,
                caller_phone=caller_phone or "Unknown",
                customer_name=caller_name or None,
                direction="inbound",
                call_status="ongoing",
            )

        product_interest = data.get("product_interest", "")
        company_name = data.get("company_name", "")
        country = data.get("country", "")
        notes = data.get("notes", "")
        order_desc = f"B2B Export Inquiry: {product_interest}"
        notes_parts = []
        if company_name:
            notes_parts.append(f"Company: {company_name}")
        if country:
            notes_parts.append(f"Country: {country}")
        if notes:
            notes_parts.append(f"Notes: {notes}")
        special_notes = ", ".join(notes_parts) if notes_parts else None

        await update_call_log(
            db,
            call_id=call_id,
            order_booked=True,
            order_items=order_desc,
            order_type="B2B Export Inquiry",
            special_notes=special_notes,
            customer_name=caller_name or None,
            customer_name_extracted=caller_name or None,
        )

    return {"inquiry_id": inquiry.id, "message": "Export inquiry logged successfully."}


@router.post("/complaint-log")
async def log_complaint(request: Request, db: AsyncSession = Depends(get_db)):
    """Log a customer product/service complaint from Retell AI."""
    import uuid
    from src.utils.db import Complaint
    try:
        data = await request.json()
    except Exception:
        return {"success": False, "message": "Invalid JSON body"}

    complaint = Complaint(
        id=str(uuid.uuid4()),
        caller_name=data.get("caller_name", ""),
        caller_phone=data.get("caller_phone", ""),
        product_name=data.get("product_name", ""),
        complaint_description=data.get("complaint_description", ""),
        purchase_location=data.get("purchase_location", ""),
        batch_lot_number=data.get("batch_lot_number", ""),
        purchase_date=data.get("purchase_date", ""),
        severity=data.get("severity", ""),
        po_number=data.get("po_number", "")
    )
    db.add(complaint)
    await db.commit()

    call_id = request.headers.get("x-retell-call-id") or data.get("call_id")
    if call_id:
        existing_log = await get_call_log_by_call_id(db, call_id)
        caller_phone = data.get("caller_phone", "")
        caller_name = data.get("caller_name", "")
        if caller_phone:
            await upsert_caller(db, caller_phone, caller_name or None)
        if not existing_log:
            existing_log = await create_call_log(
                db,
                call_id=call_id,
                caller_phone=caller_phone or "Unknown",
                customer_name=caller_name or None,
                direction="inbound",
                call_status="ongoing",
            )

        product_name = data.get("product_name", "")
        complaint_description = data.get("complaint_description", "")
        purchase_location = data.get("purchase_location", "")
        batch_lot_number = data.get("batch_lot_number", "")
        purchase_date = data.get("purchase_date", "")
        severity = data.get("severity", "")
        po_number = data.get("po_number", "")
        notes_parts = []
        if product_name:
            notes_parts.append(f"Product: {product_name}")
        if complaint_description:
            notes_parts.append(f"Description: {complaint_description}")
        if purchase_location:
            notes_parts.append(f"Location: {purchase_location}")
        if batch_lot_number:
            notes_parts.append(f"Batch/Lot: {batch_lot_number}")
        if purchase_date:
            notes_parts.append(f"Date: {purchase_date}")
        if severity:
            notes_parts.append(f"Severity: {severity}")
        if po_number:
            notes_parts.append(f"PO Number: {po_number}")
        special_notes = ", ".join(notes_parts) if notes_parts else None

        await update_call_log(
            db,
            call_id=call_id,
            call_reason=f"Complaint: {product_name}" if product_name else "Complaint",
            special_notes=special_notes,
            customer_name=caller_name or None,
            customer_name_extracted=caller_name or None,
            user_sentiment="Frustrated",
        )

    return {"complaint_id": complaint.id, "message": "Complaint logged successfully."}


@router.post("/callback-request")
async def log_callback_request(request: Request, db: AsyncSession = Depends(get_db)):
    """Log a callback request from Retell AI."""
    import uuid
    from src.utils.db import CallbackRequest
    try:
        data = await request.json()
    except Exception:
        return {"success": False, "message": "Invalid JSON body"}

    callback = CallbackRequest(
        id=str(uuid.uuid4()),
        caller_name=data.get("caller_name", ""),
        caller_phone=data.get("caller_phone", ""),
        reason=data.get("reason", ""),
        notes=data.get("notes", ""),
        preferred_callback_time=data.get("preferred_callback_time", "")
    )
    db.add(callback)
    await db.commit()

    call_id = request.headers.get("x-retell-call-id") or data.get("call_id")
    if call_id:
        existing_log = await get_call_log_by_call_id(db, call_id)
        caller_phone = data.get("caller_phone", "")
        caller_name = data.get("caller_name", "")
        if caller_phone:
            await upsert_caller(db, caller_phone, caller_name or None)
        if not existing_log:
            existing_log = await create_call_log(
                db,
                call_id=call_id,
                caller_phone=caller_phone or "Unknown",
                customer_name=caller_name or None,
                direction="inbound",
                call_status="ongoing",
            )

        reason = data.get("reason", "")
        notes = data.get("notes", "")
        preferred_callback_time = data.get("preferred_callback_time", "")
        notes_parts = []
        if reason:
            notes_parts.append(f"Reason: {reason}")
        if notes:
            notes_parts.append(f"Notes: {notes}")
        if preferred_callback_time:
            notes_parts.append(f"Preferred Time: {preferred_callback_time}")
        special_notes = ", ".join(notes_parts) if notes_parts else None

        await update_call_log(
            db,
            call_id=call_id,
            call_reason=f"Callback: {reason}" if reason else "Callback Request",
            special_notes=special_notes,
            customer_name=caller_name or None,
            customer_name_extracted=caller_name or None,
        )

    return {"callback_id": callback.id, "message": "Callback request logged successfully."}


CallLogResponse.model_rebuild()


class ComplaintResponse(BaseModel):
    id: str
    caller_name: str
    caller_phone: str
    product_name: str
    complaint_description: str
    purchase_location: str | None = None
    batch_lot_number: str | None = None
    purchase_date: str | None = None
    severity: str | None = None
    po_number: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/complaints", response_model=list[ComplaintResponse])
async def get_complaints(db: AsyncSession = Depends(get_db)):
    from src.utils.db import Complaint
    result = await db.execute(select(Complaint).order_by(Complaint.created_at.desc()))
    return result.scalars().all()
