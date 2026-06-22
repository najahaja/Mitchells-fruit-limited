import pytest

from src.api.outbound.utils import (
    validate_phone_number,
    normalize_phone_number,
    parse_csv_contacts,
    parse_json_contacts,
)


def test_normalize_phone_adds_plus():
    assert normalize_phone_number("14155551234") == "+14155551234"


def test_validate_phone_e164():
    assert validate_phone_number("+14155551234") == "+14155551234"


def test_validate_phone_invalid():
    with pytest.raises(ValueError):
        validate_phone_number("not-a-phone")


def test_parse_csv_contacts():
    csv_content = "name,phone_number,email\nJohn,+14155551234,j@x.com\n"
    contacts = parse_csv_contacts(csv_content)
    assert len(contacts) == 1
    assert contacts[0]["name"] == "John"
    assert contacts[0]["phone_number"] == "+14155551234"


def test_parse_json_contacts_list():
    content = '[{"name": "Jane", "phone_number": "+14155559999"}]'
    contacts = parse_json_contacts(content)
    assert len(contacts) == 1
    assert contacts[0]["name"] == "Jane"


def test_parse_json_contacts_wrapped():
    content = '{"contacts": [{"phone_number": "+14155558888"}]}'
    contacts = parse_json_contacts(content)
    assert len(contacts) == 1
