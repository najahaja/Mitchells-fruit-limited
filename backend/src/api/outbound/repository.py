from datetime import datetime, timezone, date

from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.utils.db import OutboundCampaign, OutboundContact, OutboundCall


async def create_campaign(
    db: AsyncSession,
    name: str,
    created_by: str,
    description: str | None = None,
    agent_id: str | None = None,
) -> OutboundCampaign:
    campaign = OutboundCampaign(
        name=name,
        description=description,
        agent_id=agent_id,
        created_by=created_by,
        status="draft",
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return campaign


async def get_campaign(db: AsyncSession, campaign_id: str) -> OutboundCampaign | None:
    result = await db.execute(
        select(OutboundCampaign)
        .options(selectinload(OutboundCampaign.contacts))
        .where(OutboundCampaign.id == campaign_id)
    )
    return result.scalar_one_or_none()


async def list_campaigns(
    db: AsyncSession,
    skip: int,
    limit: int,
    search: str | None = None,
) -> list[OutboundCampaign]:
    query = select(OutboundCampaign).order_by(OutboundCampaign.created_at.desc())
    if search:
        query = query.where(OutboundCampaign.name.ilike(f"%{search}%"))
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_campaign(
    db: AsyncSession,
    campaign: OutboundCampaign,
    **kwargs,
) -> OutboundCampaign:
    for key, value in kwargs.items():
        if value is not None and hasattr(campaign, key):
            setattr(campaign, key, value)
    campaign.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(campaign)
    return campaign


async def delete_campaign(db: AsyncSession, campaign_id: str) -> bool:
    campaign = await get_campaign(db, campaign_id)
    if not campaign:
        return False
    await db.execute(
        delete(OutboundCall).where(OutboundCall.campaign_id == campaign_id)
    )
    await db.execute(
        delete(OutboundContact).where(OutboundContact.campaign_id == campaign_id)
    )
    await db.delete(campaign)
    await db.commit()
    return True


async def create_contact(
    db: AsyncSession,
    campaign_id: str,
    phone_number: str,
    name: str | None = None,
    email: str | None = None,
    company: str | None = None,
    metadata: dict | None = None,
) -> OutboundContact:
    contact = OutboundContact(
        campaign_id=campaign_id,
        name=name,
        phone_number=phone_number,
        email=email,
        company=company,
        contact_metadata=metadata,
        status="pending",
    )
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return contact


async def list_contacts(
    db: AsyncSession,
    campaign_id: str,
    skip: int = 0,
    limit: int = 1000,
) -> list[OutboundContact]:
    result = await db.execute(
        select(OutboundContact)
        .where(OutboundContact.campaign_id == campaign_id)
        .order_by(OutboundContact.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_contact(db: AsyncSession, contact_id: str) -> OutboundContact | None:
    result = await db.execute(
        select(OutboundContact).where(OutboundContact.id == contact_id)
    )
    return result.scalar_one_or_none()


async def delete_contact(db: AsyncSession, contact_id: str) -> bool:
    contact = await get_contact(db, contact_id)
    if not contact:
        return False
    await db.execute(
        delete(OutboundCall).where(OutboundCall.contact_id == contact_id)
    )
    await db.delete(contact)
    await db.commit()
    return True


async def update_contact_status(
    db: AsyncSession,
    contact_id: str,
    status: str,
) -> None:
    contact = await get_contact(db, contact_id)
    if contact:
        contact.status = status
        await db.commit()


async def get_pending_contacts(
    db: AsyncSession,
    campaign_id: str,
) -> list[OutboundContact]:
    result = await db.execute(
        select(OutboundContact)
        .where(
            OutboundContact.campaign_id == campaign_id,
            OutboundContact.status == "pending",
        )
        .order_by(OutboundContact.created_at.asc())
    )
    return list(result.scalars().all())


async def create_outbound_call(
    db: AsyncSession,
    campaign_id: str,
    contact_id: str,
    phone_number: str,
    retell_call_id: str | None = None,
    call_status: str = "registered",
) -> OutboundCall:
    call = OutboundCall(
        campaign_id=campaign_id,
        contact_id=contact_id,
        phone_number=phone_number,
        retell_call_id=retell_call_id,
        call_status=call_status,
        started_at=datetime.now(timezone.utc),
    )
    db.add(call)
    await db.commit()
    await db.refresh(call)
    return call


async def get_outbound_call(db: AsyncSession, call_id: str) -> OutboundCall | None:
    result = await db.execute(
        select(OutboundCall)
        .options(
            selectinload(OutboundCall.contact),
            selectinload(OutboundCall.campaign),
        )
        .where(OutboundCall.id == call_id)
    )
    return result.scalar_one_or_none()


async def get_outbound_call_by_retell_id(
    db: AsyncSession,
    retell_call_id: str,
) -> OutboundCall | None:
    result = await db.execute(
        select(OutboundCall)
        .options(
            selectinload(OutboundCall.contact),
            selectinload(OutboundCall.campaign),
        )
        .where(OutboundCall.retell_call_id == retell_call_id)
    )
    return result.scalar_one_or_none()


async def list_outbound_calls(
    db: AsyncSession,
    skip: int,
    limit: int,
    campaign_id: str | None = None,
) -> list[OutboundCall]:
    query = (
        select(OutboundCall)
        .options(
            selectinload(OutboundCall.contact),
            selectinload(OutboundCall.campaign),
        )
        .order_by(OutboundCall.created_at.desc())
    )
    if campaign_id:
        query = query.where(OutboundCall.campaign_id == campaign_id)
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_outbound_call(
    db: AsyncSession,
    call: OutboundCall,
    **kwargs,
) -> OutboundCall:
    for key, value in kwargs.items():
        if value is not None and hasattr(call, key):
            setattr(call, key, value)
    await db.commit()
    await db.refresh(call)
    return call


async def get_campaign_contact_stats(
    db: AsyncSession,
    campaign_id: str,
) -> dict:
    result = await db.execute(
        select(OutboundContact.status, func.count())
        .where(OutboundContact.campaign_id == campaign_id)
        .group_by(OutboundContact.status)
    )
    counts = {row[0]: row[1] for row in result.all()}
    total = sum(counts.values())
    return {
        "total": total,
        "pending": counts.get("pending", 0),
        "calling": counts.get("calling", 0),
        "completed": counts.get("completed", 0),
        "failed": counts.get("failed", 0),
    }


async def get_dashboard_stats(db: AsyncSession) -> dict:
    today_start = datetime.combine(date.today(), datetime.min.time()).replace(
        tzinfo=timezone.utc
    )
    campaigns = await db.execute(select(func.count()).select_from(OutboundCampaign))
    contacts = await db.execute(select(func.count()).select_from(OutboundContact))
    calls_today = await db.execute(
        select(func.count())
        .select_from(OutboundCall)
        .where(OutboundCall.created_at >= today_start)
    )
    active_calls = await db.execute(
        select(func.count())
        .select_from(OutboundCall)
        .where(OutboundCall.call_status.in_(["registered", "ongoing", "started"]))
    )
    completed_calls = await db.execute(
        select(func.count())
        .select_from(OutboundCall)
        .where(OutboundCall.call_status.in_(["ended", "completed"]))
    )
    return {
        "campaigns": campaigns.scalar() or 0,
        "contacts": contacts.scalar() or 0,
        "calls_today": calls_today.scalar() or 0,
        "active_calls": active_calls.scalar() or 0,
        "completed_calls": completed_calls.scalar() or 0,
    }
