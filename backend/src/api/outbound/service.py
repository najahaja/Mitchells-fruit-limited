import asyncio
import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.services import retell_service
from src.utils.db import AsyncSessionLocal
from src.api.outbound import repository as repo
from src.api.outbound.utils import (
    validate_phone_number,
    CAMPAIGN_STATUSES,
)

_logger = logging.getLogger("outbound_calling")


class OutboundCallingService:

    async def create_campaign(
        self,
        db: AsyncSession,
        name: str,
        created_by: str,
        description: str | None = None,
        agent_id: str | None = None,
    ):
        return await repo.create_campaign(
            db, name, created_by, description, agent_id
        )

    async def update_campaign(
        self,
        db: AsyncSession,
        campaign_id: str,
        **kwargs,
    ):
        campaign = await repo.get_campaign(db, campaign_id)
        if not campaign:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Campaign not found",
            )
        if kwargs.get("status") and kwargs["status"] not in CAMPAIGN_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid campaign status",
            )
        return await repo.update_campaign(db, campaign, **kwargs)

    async def add_contact(
        self,
        db: AsyncSession,
        campaign_id: str,
        phone_number: str,
        name: str | None = None,
        email: str | None = None,
        company: str | None = None,
        metadata: dict | None = None,
    ):
        campaign = await repo.get_campaign(db, campaign_id)
        if not campaign:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Campaign not found",
            )
        try:
            normalized = validate_phone_number(phone_number)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            )
        return await repo.create_contact(
            db,
            campaign_id,
            normalized,
            name,
            email,
            company,
            metadata,
        )

    async def bulk_import_contacts(
        self,
        db: AsyncSession,
        campaign_id: str,
        contacts: list[dict],
    ) -> list:
        campaign = await repo.get_campaign(db, campaign_id)
        if not campaign:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Campaign not found",
            )
        created = []
        errors = []
        for idx, item in enumerate(contacts):
            try:
                normalized = validate_phone_number(item["phone_number"])
                contact = await repo.create_contact(
                    db,
                    campaign_id,
                    normalized,
                    item.get("name"),
                    item.get("email"),
                    item.get("company"),
                    item.get("metadata"),
                )
                created.append(contact)
            except (ValueError, KeyError) as exc:
                errors.append({"index": idx, "error": str(exc)})
        if errors and not created:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": "Import failed", "errors": errors},
            )
        return created

    async def start_call(
        self,
        db: AsyncSession,
        contact_id: str,
    ):
        contact = await repo.get_contact(db, contact_id)
        if not contact:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Contact not found",
            )
        if contact.status not in ("pending", "failed"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Contact status is {contact.status}, cannot call",
            )
        campaign = await repo.get_campaign(db, contact.campaign_id)
        if not campaign:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Campaign not found",
            )
        return await self._dial_contact(db, campaign, contact)

    async def start_campaign(
        self,
        db: AsyncSession,
        campaign_id: str,
    ):
        campaign = await repo.get_campaign(db, campaign_id)
        if not campaign:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Campaign not found",
            )
        if campaign.status == "completed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Campaign is already completed",
            )
        await repo.update_campaign(db, campaign, status="active")
        contacts = await repo.get_pending_contacts(db, campaign_id)
        if not contacts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No pending contacts to call",
            )
        asyncio.create_task(self._run_campaign_calls(campaign_id))
        return {
            "campaign_id": campaign_id,
            "queued_contacts": len(contacts),
            "status": "active",
        }

    async def _run_campaign_calls(self, campaign_id: str):
        async with AsyncSessionLocal() as db:
            campaign = await repo.get_campaign(db, campaign_id)
            if not campaign:
                return
            contacts = await repo.get_pending_contacts(db, campaign_id)
            for contact in contacts:
                campaign = await repo.get_campaign(db, campaign_id)
                if not campaign or campaign.status != "active":
                    break
                try:
                    await self._dial_contact(db, campaign, contact)
                except Exception as exc:
                    _logger.error(
                        "Campaign %s call to %s failed: %s",
                        campaign_id,
                        contact.phone_number,
                        exc,
                    )
                    await repo.update_contact_status(
                        db, contact.id, "failed"
                    )
                await asyncio.sleep(2)
            campaign = await repo.get_campaign(db, campaign_id)
            if campaign and campaign.status == "active":
                stats = await repo.get_campaign_contact_stats(db, campaign_id)
                if stats["pending"] == 0 and stats["calling"] == 0:
                    await repo.update_campaign(
                        db, campaign, status="completed"
                    )

    async def _dial_contact(self, db, campaign, contact):
        await repo.update_contact_status(db, contact.id, "calling")
        agent_id = campaign.agent_id
        dynamic_vars = {
            "customer_name": contact.name or "",
            "customer_phone": contact.phone_number,
            "company_name": contact.company or "",
        }
        try:
            retell_response = await retell_service.create_phone_call(
                to_number=contact.phone_number,
                override_agent_id=agent_id,
                metadata={
                    "campaign_id": campaign.id,
                    "contact_id": contact.id,
                },
                dynamic_variables=dynamic_vars,
            )
        except Exception as exc:
            await repo.update_contact_status(db, contact.id, "failed")
            _logger.error("Retell dial failed for %s: %s", contact.id, exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to initiate call: {exc}",
            )
        retell_call_id = retell_response.get("call_id", "")
        call = await repo.create_outbound_call(
            db,
            campaign.id,
            contact.id,
            contact.phone_number,
            retell_call_id=retell_call_id,
            call_status=retell_response.get("call_status", "registered"),
        )
        _logger.info(
            "Outbound call started campaign=%s contact=%s retell=%s",
            campaign.id,
            contact.id,
            retell_call_id,
        )
        return call

    async def sync_call_status(self, db: AsyncSession, call_id: str):
        call = await repo.get_outbound_call(db, call_id)
        if not call:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Call not found",
            )
        if not call.retell_call_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No Retell call ID",
            )
        try:
            retell_data = await retell_service.get_call(call.retell_call_id)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to sync: {exc}",
            )
        updates = {
            "call_status": retell_data.get("call_status", call.call_status),
            "duration": retell_data.get("duration_ms"),
            "recording_url": retell_data.get("recording_url"),
            "transcript": retell_data.get("transcript"),
        }
        analysis = retell_data.get("call_analysis") or {}
        if analysis.get("call_summary"):
            updates["summary"] = analysis["call_summary"]
        if retell_data.get("end_timestamp"):
            updates["ended_at"] = datetime.fromtimestamp(
                retell_data["end_timestamp"] / 1000, tz=timezone.utc
            )
        return await repo.update_outbound_call(db, call, **updates)

    async def process_webhook(self, db: AsyncSession, event: dict):
        event_type = event.get("event", "")
        call_data = event.get("call", {})
        retell_call_id = call_data.get("call_id", "")
        if not retell_call_id:
            return
        call = await repo.get_outbound_call_by_retell_id(db, retell_call_id)
        if not call:
            metadata = call_data.get("metadata") or {}
            contact_id = metadata.get("contact_id")
            campaign_id = metadata.get("campaign_id")
            if contact_id and campaign_id:
                call = await repo.create_outbound_call(
                    db,
                    campaign_id,
                    contact_id,
                    call_data.get("to_number", ""),
                    retell_call_id=retell_call_id,
                    call_status="registered",
                )
            else:
                return
        updates = {}
        if event_type in ("call_started",):
            updates["call_status"] = "ongoing"
            updates["started_at"] = datetime.now(timezone.utc)
            await repo.update_contact_status(db, call.contact_id, "calling")
        elif event_type in ("call_ended",):
            updates["call_status"] = "ended"
            updates["duration"] = call_data.get("duration_ms")
            updates["transcript"] = call_data.get("transcript")
            updates["recording_url"] = call_data.get("recording_url")
            if call_data.get("end_timestamp"):
                updates["ended_at"] = datetime.fromtimestamp(
                    call_data["end_timestamp"] / 1000, tz=timezone.utc
                )
            await repo.update_contact_status(db, call.contact_id, "completed")
        elif event_type in ("transcript_ready",):
            updates["transcript"] = call_data.get("transcript")
        elif event_type in ("recording_ready",):
            updates["recording_url"] = call_data.get("recording_url")
        elif event_type in ("post_call_analysis", "call_analyzed"):
            analysis = call_data.get("call_analysis") or {}
            updates["summary"] = analysis.get("call_summary")
            if analysis.get("user_sentiment"):
                pass
            if call_data.get("call_status") == "ended":
                await repo.update_contact_status(
                    db, call.contact_id, "completed"
                )
        if updates:
            await repo.update_outbound_call(db, call, **updates)
            _logger.info(
                "Webhook %s processed for retell_call=%s",
                event_type,
                retell_call_id,
            )


outbound_service = OutboundCallingService()
