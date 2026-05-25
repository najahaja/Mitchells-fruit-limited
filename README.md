# Mitchell's Fruit Farms — Voice AI Sales Agent Platform

A unified, full-stack platform that integrates a **Retell AI Voice Agent** with a **Clover POS System** to automate inbound customer calls, B2B wholesale orders, international export inquiries, customer complaint logging, and callback requests for **Mitchell's Fruit Farms** (a historic and trusted food manufacturer in Pakistan since 1933).

---

## 📖 Project Overview

This repository consists of two main components:
1. **`backend` (FastAPI Backend)**: Serves as the central API orchestrator. It manages database persistence, processes Retell AI webhook life cycle events (e.g., call completion, live state retrieval), syncs product catalogs from Clover POS, auto-extracts order items from natural conversation transcripts, and pushes orders to Clover POS with automatic warehouse printing.
2. **`frontend` (React + TypeScript Frontend)**: An admin dashboard portal designed to monitor call logs, play call recordings, read transcripts, review and edit order drafts before final POS submission, reprint receipts, sync Clover menu items, and manage agent voice/business configurations.

---

## 🛠️ Tech Stack

### Backend (`backend`)
- **Framework**: FastAPI (Asynchronous Python)
- **Database ORM**: SQLAlchemy 2.0 (Asyncio) with `asyncpg`
- **Database**: PostgreSQL
- **Migration & Schema Setup**: Automatic DDL migrations integrated directly into the application lifespan
- **Voice Agent Gateway**: Retell AI REST API & Webhooks
- **POS & Print Engine**: Clover POS Merchant API
- **Auth**: JWT Bearer Tokens with `python-jose` and `passlib` for password hashing

### Frontend (`frontend`)
- **Runtime & Bundler**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4 with modern CSS configurations
- **Icons**: Lucide React
- **Routing**: React Router DOM v7
- **HTTP Client**: Axios with interceptors for JWT injection

---

## 📂 Project Architecture

```
Mitchell's/
├── backend/                                 # FastAPI Backend Service
│   ├── main.py                              # Application entry point with Lifespan & background tasks
│   ├── requirements.txt                     # Backend python dependencies
│   ├── retell_agent_config.json             # Pre-configured Retell Agent Conversation Graph
│   ├── src/
│   │   ├── api/                             # API Routers (auth, retell, menu, settings, prompts)
│   │   ├── services/                        # Integrations (Clover API client, Retell API client)
│   │   └── utils/                           # Core utilities (DB schemas, parsing logic, seed scripts)
│   └── .env                                 # Backend configuration (ignored by Git)
│
├── frontend/                                # React + TypeScript Admin Portal
│   ├── package.json                         # Node dependencies & npm scripts
│   ├── index.html                           # Single page application entry point
│   ├── src/
│   │   ├── api/                             # Axios clients and API request modules
│   │   ├── components/                      # Common UI components (Navbar, Modal, Loader)
│   │   ├── pages/                           # Views (Login, Dashboard Overview, CallLogs, Menu, Settings)
│   │   └── App.tsx                          # App Routing and Private Route Guards
│   └── .env                                 # Frontend base URL config (ignored by Git)
```

---

## ⚙️ Key Features

### 🎙️ 1. Retell AI Voice Agent Integration ("Alex")
- Built using Retell's **Conversation Flow** graph engine. The agent responds to caller types programmatically (Consumer Inquiries, B2B Trade, Exports, Complaints, Callback requests).
- **Dynamic Context Injection**: During inbound webhooks, the system queries the database to inject dynamic context, including:
  - Custom user parameters (returning caller name, returning status).
  - Business hours validation (verifying if warehouse/corporate operations are open in `Asia/Karachi` timezone).
  - A serialized, up-to-date **Product Catalog** with pricing and active promotions.

### 💳 2. Clover POS Sync & Atomic Order Processing
- **Inventory Syncing**: A background task (`_clover_menu_sync_loop`) runs every 5 minutes, fetching items from Clover's inventory API, filtering out internal internal/service skus (e.g. print-service, test-cards), and updating the local menu.
- **Automated Order Creation**: Submits line items to Clover POS using the Atomic Orders endpoint, converting currency representations from float dollars to cents.
- **Auto-Printing**: Triggers physical printer events via Clover's `/print_event` endpoints on order placement or manual reprint requests.

### 📝 3. Webhook & AI Parsing Engine
- Automatically processes the `call_ended` webhook.
- Features a **Natural Language Processing Regex Parser** (`auto_extract_order_items`) that parses free-text conversation summaries to match items against the database, extracting numbers/quantities written before or after item names, resolving plural/singular variants, and drafting orders.

### 📊 4. Admin Management Dashboard
- **Live Monitoring & Logs**: Allows listening to call recordings, reading full transcripts, and filtering call logs by status or order booking success.
- **Draft Review & Order Placement**: Enables agents to edit drafted orders extracted from calls and manually submit them to Clover POS.
- **Dynamic Configuration**: UI interface to modify business hours, timezone, greetings, and Retell voice parameters (temperature, speed, interruption sensitivity).
- **Reporting Analytics**: Visual breakdown of calls/orders over time, repeat callers, and user sentiment.

---

## 🚀 Installation & Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL Database

---

### 1. Database Setup
Create a PostgreSQL database on your system:
```sql
CREATE DATABASE mitchells_db;
```

---

### 2. Backend Installation (`backend`)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # macOS/Linux:
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure Environment Variables:
   Create a `.env` file based on `.env.example`:
   ```ini
   DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/mitchells_db
   SECRET_KEY=your_super_secret_jwt_key
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=200
   REFRESH_TOKEN_EXPIRE_DAYS=7

   RETELL_API_KEY=your_retell_api_key_here
   RETELL_WEBHOOK_SECRET=your_retell_webhook_secret_here
   RETELL_AGENT_ID=your_retell_agent_id_here
   RETELL_CONVERSATION_FLOW_ID=your_retell_flow_id_here

   CORS_ORIGINS=*

   CLOVER_API_TOKEN=your_clover_token_here
   CLOVER_MERCHANT_ID=your_clover_merchant_id_here
   CLOVER_BASE_URL=https://api.clover.com/v3
   CLOVER_ORDER_TYPE_ID=your_order_type_id
   CLOVER_PRINTER_ID=your_printer_id
   ```
5. Seed Database (Optional - to insert mock data if Clover is not configured):
   ```bash
   python -m src.utils.seed_mitchells_products
   ```
6. Run Backend Server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

---

### 3. Frontend Installation (`frontend`)

1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install Node packages:
   ```bash
   npm install
   ```
3. Create a `.env` file:
   ```ini
   VITE_BASE_URL=http://localhost:8000/api
   ```
4. Run Development Server:
   ```bash
   npm run dev
   ```
5. Access the application at [http://localhost:5173](http://localhost:5173).

---

## 🧠 Key Challenges & Solutions

During the implementation of this system, several technical challenges were encountered and resolved:

### 1. Real-time NLP Transcription Parsing
* **Challenge**: When a customer finishes a call, their order summary is sent as free-text (e.g., *"two orange squashes and a Mixed Fruit Jam"*). Mapping these strings to strict POS database models is error-prone.
* **Solution**: Implemented `auto_extract_order_items`, which performs case-insensitive regex matching. It handles singularization (converting "berries" to "berry", "jams" to "jam") and uses bidirectional search patterns to capture quantity numbers written both before the item (e.g., `3x Mango Jam`) and after the item (e.g., `Mango Jam: 3`).

### 2. Prompt Bloat vs. Context Limitations
* **Challenge**: Passing the full product catalogue directly into the LLM system prompt for every call consumes excessive tokens and adds high latency to real-time conversations.
* **Solution**: Developed a local SQL cache sync with Clover POS. The background loop fetches data, cleanses internal POS items (using prefix filtering), formats the product structure compactly, and injects it as a dynamic E.164-dependent variable *only* when the webhook triggers the inbound call.

### 3. POS Synchronization & Financial Safety
* **Challenge**: Clover's API expects order line items in cents and will fail if price discrepancies exist between what the customer was quoted and what is sent to the POS, or if a sync fails mid-transit.
* **Solution**: Configured database price-mapping functions (`get_menu_items_prices`). The app pulls current prices directly from verified SQL models, enforces clean float-to-int multiplication (dollars * 100), and records synching failures (`clover_error` field in order records) so managers can review the drafts and perform manual overrides in the admin panel.

### 4. Timezone-Aware Operating States
* **Challenge**: Orders should only be accepted if the warehouse is open. However, servers operate in UTC, while the client operates in Pakistan (`Asia/Karachi`).
* **Solution**: Leveraged the `zoneinfo` module combined with dynamic database settings. During the inbound webhook, current local times are computed using the merchant's chosen timezone, evaluating open/closed business rules to adjust the voice agent's dialogue tree dynamically on the fly.
