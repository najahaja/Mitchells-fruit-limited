# RETELL AI VOICE AGENT INTEGRATION SERVICE
# This module implements the integration client with the Retell AI REST API.
# It manages agent configurations, conversational flow charts, prompt injections,
# and verifies HMAC call log webhooks signatures.

import os
import hashlib
import hmac

import httpx
from src.utils.db import Caller

# Webhook secret to verify incoming event payloads from Retell AI
RETELL_WEBHOOK_SECRET = os.getenv("RETELL_WEBHOOK_SECRET", "")
BASE_URL = "https://api.retellai.com"

# The LOCKED_PROMPT_TAIL is appended to every prompt configuration update.
# It acts as a system definition injection that instructs the Retell LLM agent
# on what variables it can reference (e.g. caller name, menus, open settings).
LOCKED_PROMPT_TAIL = (
    "\n\nDYNAMIC VARIABLES AVAILABLE (do not edit this section):\n"
    "- {{customer_name}} — caller's saved name, or empty string if new\n"
    "- {{is_returning_customer}} — 'true' if caller has called before, 'false' if new\n"
    "- {{customer_phone}} — caller's phone number in E.164 format\n"
    "- {{kitchen_is_open}} — 'true' if the warehouse/fulfillment operations are currently open and accepting sales orders, 'false' if not\n"
    "- {{store_is_open}} — 'true' if the corporate/sales offices are currently open, 'false' if closed\n"
    "- {{menu}} — the complete catalog of Mitchell's products (jams, squashes, ketchups, confectionery, etc.) with available stock, pricing, and active deals. This is your ONLY source of truth for product availability and pricing. Never reference products not listed in {{menu}}.\n"
    "- {{restaurant_info}} — general information about Mitchell's Fruit Farms, its history, specialties, and policies."
)


def assemble_global_prompt(instructions: str) -> str:
    """
    Appends the locked system definition properties to the user's custom instructions text.
    """
    return instructions.rstrip() + LOCKED_PROMPT_TAIL


def _headers() -> dict:
    """Helper: Returns authentication header credentials for Retell API queries."""
    api_key = os.getenv("RETELL_API_KEY", "")
    return {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}


async def get_call(call_id: str) -> dict:
    """
    Queries Retell for call metadata (recordings, duration, status).
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/v2/get-call/{call_id}", headers=_headers())
        response.raise_for_status()
        return response.json()


async def get_agent() -> dict:
    """
    Queries Retell details for our configured Voice Agent ID.
    """
    agent_id = os.getenv("RETELL_AGENT_ID", "")
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{BASE_URL}/get-agent/{agent_id}",
            headers=_headers(),
        )
        response.raise_for_status()
        return response.json()


async def get_conversation_flow() -> dict:
    """
    Queries Retell details for our configured conversation flow chart graphs.
    """
    flow_id = os.getenv("RETELL_CONVERSATION_FLOW_ID", "")
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{BASE_URL}/get-conversation-flow/{flow_id}",
            headers=_headers(),
        )
        response.raise_for_status()
        return response.json()


async def update_conversation_flow(payload: dict) -> dict:
    """
    Updates the agent's prompts and conversation graph configuration on Retell.
    
    Why this is complex:
    When updating prompt nodes in a conversation flow graph, we retrieve the current
    graph list, locate the specific nodes by ID, and update their individual prompt
    instructions, while preserving all other node attributes.
    """
    flow_id = os.getenv("RETELL_CONVERSATION_FLOW_ID", "")
    patch_body: dict = {}
    
    # 1. Mount standard configurations
    if "global_prompt" in payload:
        patch_body["global_prompt"] = payload["global_prompt"]
    if "default_dynamic_variables" in payload:
        patch_body["default_dynamic_variables"] = payload["default_dynamic_variables"]
    if "model_choice" in payload:
        patch_body["model_choice"] = payload["model_choice"]
    if "model_temperature" in payload:
        patch_body["model_temperature"] = payload["model_temperature"]
    if "knowledge_base_ids" in payload:
        patch_body["knowledge_base_ids"] = payload["knowledge_base_ids"]
    if payload.get("begin_message") is not None:
        patch_body["begin_message"] = payload["begin_message"]
        
    # 2. Handle sub-node diagram updates if present
    if "nodes" in payload and payload["nodes"]:
        current = await get_conversation_flow()
        existing_nodes = {n["id"]: n for n in current.get("nodes", [])}
        
        for updated_node in payload["nodes"]:
            node_id = updated_node["id"]
            if node_id in existing_nodes and "instruction" in updated_node:
                # Merge custom node prompt texts
                existing_nodes[node_id]["instruction"] = updated_node["instruction"]
            elif node_id not in existing_nodes:
                # Add node if it's completely new
                existing_nodes[node_id] = updated_node
        patch_body["nodes"] = list(existing_nodes.values())
        
    async with httpx.AsyncClient() as client:
        response = await client.patch(
            f"{BASE_URL}/update-conversation-flow/{flow_id}",
            headers=_headers(),
            json=patch_body,
        )
        response.raise_for_status()
        return response.json()


async def update_agent_voice_settings(**kwargs) -> dict:
    """
    Updates the physical voice parameters of the agent (e.g. speed, responsiveness).
    """
    agent_id = os.getenv("RETELL_AGENT_ID", "")
    payload = {k: v for k, v in kwargs.items() if v is not None}
    async with httpx.AsyncClient() as client:
        response = await client.patch(
            f"{BASE_URL}/update-agent/{agent_id}",
            headers=_headers(),
            json=payload,
        )
        response.raise_for_status()
        return response.json()


async def list_voices() -> list[dict]:
    """
    Retrieves available voices (from ElevenLabs, PlayHT, etc.) supported by Retell AI.
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{BASE_URL}/list-voices",
            headers=_headers(),
        )
        response.raise_for_status()
        return response.json()


async def list_knowledge_bases() -> dict:
    """
    Lists uploaded PDF/text vector stores from Retell.
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/list-knowledge-bases", headers=_headers())
        response.raise_for_status()
        return response.json()


async def add_knowledge_base_to_flow(kb_id: str) -> dict:
    """
    Attaches a vector knowledge base store to the agent's conversation flow engine.
    """
    current = await get_conversation_flow()
    kb_ids = current.get("knowledge_base_ids", [])
    if kb_id not in kb_ids:
        kb_ids = kb_ids + [kb_id]
    return await update_conversation_flow({"knowledge_base_ids": kb_ids})


async def remove_knowledge_base_from_flow(kb_id: str) -> dict:
    """
    Detaches a vector knowledge base store from the agent's conversation flow engine.
    """
    current = await get_conversation_flow()
    kb_ids = [k for k in current.get("knowledge_base_ids", []) if k != kb_id]
    return await update_conversation_flow({"knowledge_base_ids": kb_ids})


async def list_agents() -> list[dict]:
    """
    Retrieves all Voice Agents registered under this developer account.
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{BASE_URL}/list-agents",
            headers=_headers(),
        )
        response.raise_for_status()
        return response.json()


async def create_agent(agent_name: str, voice_id: str) -> dict:
    """
    Creates a new voice agent profile.
    Automatically binds the conversation flow diagram if defined in the env variables.
    """
    flow_id = os.getenv("RETELL_CONVERSATION_FLOW_ID", "")
    payload = {
        "agent_name": agent_name,
        "voice_id": voice_id,
    }
    if flow_id:
        payload["response_engine"] = {
            "type": "conversation-flow",
            "conversation_flow_id": flow_id
        }
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{BASE_URL}/create-agent",
            headers=_headers(),
            json=payload,
        )
        response.raise_for_status()
        return response.json()


def verify_webhook_signature(payload_bytes: bytes, signature_header: str, secret: str | None = None) -> bool:
    """
    Validates webhook calls to ensure they originated from Retell, not an attacker.
    
    Why hmac.compare_digest:
    Standard '==' string comparisons are vulnerable to Timing Attacks because they fail
    earlier or later depending on character match. 'hmac.compare_digest' runs in constant
    time, securing signature verification against hackers.
    """
    key = secret if secret is not None else RETELL_WEBHOOK_SECRET
    expected = hmac.new(
        key.encode(),
        payload_bytes,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)


def build_caller_dynamic_variables(caller: Caller | None, from_number: str) -> dict:
    """
    Helper: Prepares the dynamic parameters dictionary about a caller
    to feed into Retell at the beginning of an inbound call.
    """
    return {
        "customer_name": caller.customer_name if caller and caller.customer_name else "",
        "customer_phone": from_number,
        "is_returning_customer": "true" if caller else "false",
    }
