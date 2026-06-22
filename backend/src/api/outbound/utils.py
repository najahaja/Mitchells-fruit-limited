import csv
import io
import json
import re

E164_PATTERN = re.compile(r"^\+[1-9]\d{1,14}$")

CAMPAIGN_STATUSES = {"draft", "active", "paused", "completed"}
CONTACT_STATUSES = {"pending", "calling", "completed", "failed"}


def normalize_phone_number(phone: str) -> str:
    cleaned = phone.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if not cleaned.startswith("+"):
        if cleaned.startswith("00"):
            cleaned = "+" + cleaned[2:]
        elif cleaned.startswith("0"):
            cleaned = "+92" + cleaned[1:]
        elif len(cleaned) == 10:
            cleaned = "+1" + cleaned
        else:
            cleaned = "+" + cleaned
    return cleaned


def validate_phone_number(phone: str) -> str:
    normalized = normalize_phone_number(phone)
    if not E164_PATTERN.match(normalized):
        raise ValueError(f"Invalid phone number format: {phone}")
    return normalized


def parse_csv_contacts(content: str) -> list[dict]:
    reader = csv.DictReader(io.StringIO(content))
    if not reader.fieldnames:
        raise ValueError("CSV must include a header row")
    field_map = {f.lower().strip(): f for f in reader.fieldnames}
    phone_key = field_map.get("phone_number") or field_map.get("phone")
    if not phone_key:
        raise ValueError("CSV must include phone_number or phone column")
    contacts = []
    for row in reader:
        phone = (row.get(phone_key) or "").strip()
        if not phone:
            continue
        name_key = field_map.get("name")
        email_key = field_map.get("email")
        company_key = field_map.get("company")
        contacts.append({
            "name": (row.get(name_key) or "").strip() or None if name_key else None,
            "phone_number": phone,
            "email": (row.get(email_key) or "").strip() or None if email_key else None,
            "company": (row.get(company_key) or "").strip() or None if company_key else None,
            "metadata": None,
        })
    return contacts


def parse_json_contacts(content: str) -> list[dict]:
    data = json.loads(content)
    if isinstance(data, dict) and "contacts" in data:
        data = data["contacts"]
    if not isinstance(data, list):
        raise ValueError("JSON must be a list of contacts or {contacts: [...]}")
    contacts = []
    for item in data:
        if not isinstance(item, dict):
            raise ValueError("Each contact must be an object")
        phone = (item.get("phone_number") or item.get("phone") or "").strip()
        if not phone:
            raise ValueError("Each contact must include phone_number")
        contacts.append({
            "name": item.get("name"),
            "phone_number": phone,
            "email": item.get("email"),
            "company": item.get("company"),
            "metadata": item.get("metadata"),
        })
    return contacts
