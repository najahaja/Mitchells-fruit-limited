import pytest

from src.api.outbound.utils import (
    validate_phone_number,
    normalize_phone_number,
    parse_csv_contacts,
    parse_json_contacts,
    merge_contact_payload,
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


def test_merge_contact_payload():
    name, company, meta = merge_contact_payload(
        shop_name="Ali Store",
        owner_name="Ali Khan",
        customer_city="Lahore",
        last_order="2x Mango Jam",
        customer_type="existing",
    )
    assert name == "Ali Khan"
    assert company == "Ali Store"
    assert meta["customer_city"] == "Lahore"
    assert meta["customer_type"] == "existing"


def test_parse_csv_with_outbound_columns():
    csv_content = (
        "shop_name,owner_name,phone_number,customer_city,last_order,customer_type\n"
        "Fresh Mart,Sara Ali,+14155551234,Karachi,3x Squash,existing\n"
    )
    contacts = parse_csv_contacts(csv_content)
    assert contacts[0]["company"] == "Fresh Mart"
    assert contacts[0]["name"] == "Sara Ali"
    assert contacts[0]["metadata"]["customer_city"] == "Karachi"
