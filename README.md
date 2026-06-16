# FinTrack — Smart Expense Tracker

> Stop wondering where your money goes. FinTrack gives you a unified, intelligent view of all spending across UPI, cards, wallets, subscriptions, and cash.

![FinTrack Dashboard](https://img.shields.io/badge/Status-Production%20Ready-6366f1?style=for-the-badge)
![Currency](https://img.shields.io/badge/Currency-INR%20%E2%82%B9-10b981?style=for-the-badge)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge)

---

## 📐 Architecture

```
fintrack/
├── frontend/          # React 18 + Tailwind CSS + Recharts (CDN, no Node required)
│   └── index.html     # Complete single-file application
└── backend/           # FastAPI + SQLAlchemy 2.0 + PostgreSQL
    ├── app/
    │   ├── core/          # config, security, database
    │   ├── models/        # SQLAlchemy ORM models (5 tables)
    │   ├── schemas/       # Pydantic v2 request/response schemas
    │   ├── routers/       # auth, transactions, analytics, budgets
    │   └── services/      # business logic layer
    ├── alembic/           # database migrations
    ├── schema.sql         # raw PostgreSQL DDL
    └── requirements.txt
```

---

## 🚀 Quick Start

### Frontend (No Node.js required!)

Simply open `frontend/index.html` in any modern browser. It uses CDN imports for React, Tailwind, and Recharts.

```bash
# Option 1: Direct file open
start frontend\index.html

# Option 2: Python simple server (recommended — avoids CORS issues)
python -m http.server 5173 --directory frontend
# Then open: http://localhost:5173
```

### Backend (Python 3.13+)

**Prerequisites:** Python 3.13+, PostgreSQL 14+

```bash
cd backend

# 1. Create virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux/Mac

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
copy .env.example .env
# Edit .env: set DATABASE_URL and SECRET_KEY

# 4. Create the database
psql -U postgres -c "CREATE DATABASE fintrack;"

# 5. Run migrations
alembic revision --autogenerate -m "initial schema"
alembic upgrade head

# 6. Start the API server
uvicorn app.main:app --reload --port 8000

# API docs: http://localhost:8000/docs
# ReDoc:    http://localhost:8000/redoc
```

---

## 💳 Payment Hierarchy

```
Top Level
├── UPI           → Food, Travel, Miscellaneous
├── CARD          → Food, Travel, Miscellaneous  
├── WALLET        → Food, Travel, Miscellaneous
├── SUBSCRIPTION  → flat category
└── CASH          → manual entry (form in Settings)

Miscellaneous sub-categories (user-customizable):
BILLS | RENT | EXPENSES | SERVICE | PAYROLL
```

---

## ⏱️ Time Periods Supported

| Period | Description |
|--------|-------------|
| Daily | Single day view |
| Weekly | Last 7 days |
| Fortnightly | Last 14 days |
| Monthly | Calendar month |
| Quarterly | Last 3 months |
| Half-yearly | Last 6 months |
| Yearly | Last 12 months |
| Custom | Any date range |

---

## 🔌 API Reference

### Authentication
```
POST /api/v1/auth/register    Register new user
POST /api/v1/auth/login       Login, returns JWT token
GET  /api/v1/auth/me          Get current user profile
```

### Transactions (all require Bearer token)
```
GET    /api/v1/transactions                  List (paginated, filtered)
POST   /api/v1/transactions                  Create transaction
GET    /api/v1/transactions/{id}             Get single
PUT    /api/v1/transactions/{id}             Update
DELETE /api/v1/transactions/{id}             Soft delete
POST   /api/v1/transactions/upload          Import PDF/CSV/Excel statement
```

#### Transaction Filter Parameters
| Param | Type | Example |
|-------|------|---------|
| `start_date` | date | `2026-06-01` |
| `end_date` | date | `2026-06-30` |
| `category` | string | `FOOD` |
| `payment_method` | string | `UPI` |
| `type` | string | `EXPENSE` |
| `page` | int | `1` |
| `page_size` | int | `20` |

### Analytics (protected)
```
GET /api/v1/analytics/dashboard-summary       Total balance, monthly income/expenses
GET /api/v1/analytics/spending-trends         Daily aggregated over period
GET /api/v1/analytics/category-breakdown      Spending % by category
GET /api/v1/analytics/payment-method-breakdown Spending by UPI/Card/Wallet/etc.
GET /api/v1/analytics/comparison              Compare two custom time periods
```

### Budgets (protected)
```
GET    /api/v1/budgets          List budgets with spending progress
POST   /api/v1/budgets          Create budget limit
PUT    /api/v1/budgets/{id}     Update limit
DELETE /api/v1/budgets/{id}     Delete budget
```

---

## 🗄️ Database Schema

### 5 Tables

| Table | Purpose |
|-------|---------|
| `users` | Auth, profile, currency preference |
| `bank_items` | Bank/UPI provider connections (encrypted tokens) |
| `accounts` | Sub-accounts (checking, credit, wallet, manual) |
| `transactions` | All transactions with soft-delete and AI category |
| `budgets` | Per-category monthly limits with auto-tracking |

### Key Design Decisions

1. **Soft Delete** — `deleted_at IS NULL` filter on all queries; deleted transactions are never removed from DB
2. **Idempotency** — `UNIQUE(account_id, provider_transaction_id) WHERE provider_transaction_id IS NOT NULL` prevents duplicate syncs
3. **Multi-tenancy** — Every query is scoped to `current_user.id`; users cannot see each other's data
4. **Positive Amounts** — `amount` is always positive; direction is given by `type` (INCOME/EXPENSE)
5. **AI Hook** — `ai_suggested_category` field populated by `ai_suggest_category()` scaffold in `transaction_service.py`

---

## 🤖 AI Categorization (ML Scaffold)

Located in `app/services/transaction_service.py`:

```python
async def ai_suggest_category(description: str, amount: float, payment_method: str) -> str:
    """
    AI Categorization Engine - Scaffold Hook
    
    Current: Heuristic keyword matching
    Future:  Replace with trained scikit-learn / TensorFlow model
    
    Special rules (must be preserved in ML model):
    - Regular recurring amounts → NOT flagged as anomalies
    - Gradually increasing amounts (rent inflation) → normal
    - Only sudden spikes or new categories → flagged as concerns
    """
```

To integrate a real ML model, replace the keyword heuristics with your model's `predict()` call.

---

## 🔒 Security

- **JWT tokens** expire in 7 days (configurable via `ACCESS_TOKEN_EXPIRE_DAYS`)
- **Passwords** hashed with bcrypt (12 rounds)
- **Access tokens** stored encrypted — never in `localStorage` (use `httpOnly` cookies in production)
- **Bank access_token** field in `bank_items` table **MUST** be AES-256 encrypted before storage
- **CORS** restricted to configured origins only
- **SQL injection** impossible via SQLAlchemy ORM parameterized queries

---

## 📥 Statement Import

The frontend includes a drag-and-drop statement uploader supporting:
- **PDF** — bank statements, UPI statements (pdfplumber in backend)
- **CSV** — exported from any UPI app (Paytm, PhonePe, GPay)
- **Excel (.xlsx)** — exported from net banking

Backend import endpoint: `POST /api/v1/transactions/upload`

Supported banks/UPI apps: HDFC, SBI, ICICI, Axis, Kotak, Paytm, PhonePe, Google Pay, Amazon Pay

---

## 🏗️ Production Checklist

- [ ] Change `SECRET_KEY` to a cryptographically random 64-char string
- [ ] Enable HTTPS / TLS termination (nginx/caddy)
- [ ] Encrypt `bank_items.access_token` with AES-256 using `cryptography` package
- [ ] Use `DATABASE_URL` with SSL: `?ssl=require`
- [ ] Set `DEBUG=False`
- [ ] Configure proper CORS origins (no localhost)
- [ ] Add rate limiting (e.g., `slowapi`)
- [ ] Enable database connection pooling (PgBouncer)
- [ ] Set up Alembic for migrations (not `create_all`)
- [ ] Add monitoring (Sentry, Datadog)

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Tailwind CSS, Recharts |
| Backend | FastAPI 0.115, Python 3.13 |
| ORM | SQLAlchemy 2.0 (AsyncSession) |
| Database | PostgreSQL 14+ |
| Migrations | Alembic |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| Config | Pydantic v2 BaseSettings |
| Statement Parsing | pdfplumber, pandas, openpyxl |

---

## 📝 License

MIT License — built for FinTrack by a Senior Full-Stack Engineer.
