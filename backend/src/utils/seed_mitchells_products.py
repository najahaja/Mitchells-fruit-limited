import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv

# Load database environment variables first
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
load_dotenv(os.path.join(backend_dir, ".env"))

# Add backend directory to path so imports work correctly
sys.path.append(backend_dir)

from src.utils.db import AsyncSessionLocal, MenuCategory, MenuItem
from sqlalchemy import delete

# Define the products data
PRODUCT_CATALOG = {
    "Jams & Marmalades": {
        "description": "Authentic, rich fruit jams and marmalades prepared from chosen fresh fruits.",
        "items": [
            {
                "name": "Mango Jam",
                "description": "Sweet and luscious mango jam made from premium mangoes.",
                "price": 3.50,
                "allergens": None,
                "prep_time_minutes": 0,
            },
            {
                "name": "Mixed Fruit Jam",
                "description": "A delightful blend of fresh seasonal fruits.",
                "price": 3.25,
                "allergens": None,
                "prep_time_minutes": 0,
            },
            {
                "name": "Strawberry Jam",
                "description": "Juicy strawberries cooked into a rich, sweet spread.",
                "price": 3.99,
                "allergens": None,
                "prep_time_minutes": 0,
            },
            {
                "name": "Golden Mist Marmalade",
                "description": "Classic orange marmalade with fine peel shreds.",
                "price": 3.75,
                "allergens": None,
                "prep_time_minutes": 0,
            },
            {
                "name": "Apple Jelly",
                "description": "Clear and sweet apple jelly.",
                "price": 3.00,
                "allergens": None,
                "prep_time_minutes": 0,
            },
            {
                "name": "Pineapple Jam",
                "description": "Tangy and sweet jam loaded with pineapple bits.",
                "price": 3.60,
                "allergens": None,
                "prep_time_minutes": 0,
            },
        ]
    },
    "Squashes & Cordials": {
        "description": "Refreshing fruit squashes and cordials made with real fruit juice.",
        "items": [
            {
                "name": "Lemon Squash",
                "description": "Refreshing squash made with natural lemon juice concentrate.",
                "price": 4.25,
                "allergens": None,
                "prep_time_minutes": 0,
            },
            {
                "name": "Orange Squash",
                "description": "Zesty orange squash packed with citrus flavor.",
                "price": 4.00,
                "allergens": None,
                "prep_time_minutes": 0,
            },
            {
                "name": "Mango Squash",
                "description": "Rich mango pulp concentrate for a refreshing summer drink.",
                "price": 4.50,
                "allergens": None,
                "prep_time_minutes": 0,
            },
            {
                "name": "Lime Juice Cordial",
                "description": "Clear and sweet lime cordial, perfect for mixing.",
                "price": 4.75,
                "allergens": None,
                "prep_time_minutes": 0,
            },
        ]
    },
    "Tomato Ketchups & Sauces": {
        "description": "Tangy tomato ketchups and spicy specialty sauces to complement your meals.",
        "items": [
            {
                "name": "Tomato Ketchup",
                "description": "Traditional thick tomato ketchup from vine-ripe tomatoes.",
                "price": 2.99,
                "allergens": None,
                "prep_time_minutes": 0,
            },
            {
                "name": "Chili Garlic Sauce",
                "description": "Zesty sauce blending hot red chilies and fresh garlic.",
                "price": 3.25,
                "allergens": None,
                "prep_time_minutes": 0,
            },
            {
                "name": "Tamarind (Imli) Sauce",
                "description": "Traditional sweet and sour tamarind dipping sauce.",
                "price": 3.50,
                "allergens": None,
                "prep_time_minutes": 0,
            },
            {
                "name": "Hot Chili Sauce",
                "description": "Fiery hot red chili sauce to spice up any dish.",
                "price": 2.75,
                "allergens": None,
                "prep_time_minutes": 0,
            },
            {
                "name": "Green Chili Sauce",
                "description": "Sharp and spicy sauce made from fresh green chilies.",
                "price": 2.75,
                "allergens": None,
                "prep_time_minutes": 0,
            },
        ]
    },
    "Pickles (Achar)": {
        "description": "Traditional pickles seasoned with aromatic spices in premium oil.",
        "items": [
            {
                "name": "Mango Pickle in Oil",
                "description": "Tangy green mangoes pickled in mustard oil with traditional spices.",
                "price": 3.80,
                "allergens": "Mustard",
                "prep_time_minutes": 0,
            },
            {
                "name": "Mixed Pickle in Oil",
                "description": "A savory mix of vegetables and mangoes in spiced oil.",
                "price": 3.99,
                "allergens": "Mustard",
                "prep_time_minutes": 0,
            },
            {
                "name": "Garlic Pickle in Oil",
                "description": "Whole garlic cloves pickled with aromatic spices.",
                "price": 4.20,
                "allergens": "Mustard",
                "prep_time_minutes": 0,
            },
        ]
    },
    "Confectionery": {
        "description": "Delightful toffees and sweets loved across generations.",
        "items": [
            {
                "name": "Milk Toffees",
                "description": "Classic rich and chewy milk toffees.",
                "price": 1.99,
                "allergens": "Milk",
                "prep_time_minutes": 0,
            },
            {
                "name": "Butter Scotch",
                "description": "Creamy butterscotch hard candies.",
                "price": 2.25,
                "allergens": "Milk",
                "prep_time_minutes": 0,
            },
            {
                "name": "Menthol Drops",
                "description": "Cool and soothing mint throat-soothers.",
                "price": 1.50,
                "allergens": None,
                "prep_time_minutes": 0,
            },
            {
                "name": "Chocolate Éclairs",
                "description": "Chewy caramels filled with rich chocolate centers.",
                "price": 2.50,
                "allergens": "Milk, Soy",
                "prep_time_minutes": 0,
            },
        ]
    }
}

async def seed():
    async with AsyncSessionLocal() as db:
        print("Clearing existing menu items and categories...")
        # Wiping old data first to avoid mix-ups
        await db.execute(delete(MenuItem))
        await db.execute(delete(MenuCategory))
        await db.commit()
        
        print("Seeding new Mitchell's categories and products...")
        now = datetime.now(timezone.utc)
        
        for cat_index, (cat_name, cat_data) in enumerate(PRODUCT_CATALOG.items()):
            category = MenuCategory(
                id=str(uuid.uuid4()),
                name=cat_name,
                description=cat_data["description"],
                sort_order=cat_index + 1,
                is_available=True,
                created_at=now,
            )
            db.add(category)
            await db.flush()  # to generate category.id
            
            for item_index, item_data in enumerate(cat_data["items"]):
                item = MenuItem(
                    id=str(uuid.uuid4()),
                    category_id=category.id,
                    name=item_data["name"],
                    description=item_data["description"],
                    price=item_data["price"],
                    is_available=True,
                    allergens=item_data["allergens"],
                    prep_time_minutes=item_data["prep_time_minutes"],
                    sort_order=item_index + 1,
                    created_at=now,
                    updated_at=now,
                )
                db.add(item)
        
        await db.commit()
        print("Successfully seeded Mitchell's products catalog!")

if __name__ == "__main__":
    asyncio.run(seed())
