# FinTrack Backend — FastAPI

> **Currency**: INR (₹) | **Runtime**: Python 3.11+ | **DB**: PostgreSQL 15+

---

## Overview

FinTrack is a personal expense-tracking API built with **FastAPI**, **SQLAlchemy 2.0 (async)**, and **PostgreSQL**. It provides:

- JWT-based authentication (7-day tokens)
- Transaction management with soft-delete and deduplication
- Multi-account support (UPI, Card, Wallet, Cash, Manual)
- Budget tracking per category / payment method / month
- Analytics endpoints (dashboard, trends, category breakdown, comparisons)
- AI categorisation scaffold ready for ML model integration

---

## Project Structure

```
backend/
├── app/
│   ├── main.py                  # FastAPI app factory, CORS, routers
│   ├── core/
│   │   ├── config.py            # Pydantic settings (reads .env)
│   │   ├── security.py          # JWT creation/verification, password hashing
│   │   └── database.py          # Async SQLAlchemy engine + session factory
│   ├── models/                  # SQLAlchemy ORM models
│   ├── schemas/                 # Pydantic v2 request/response schemas
│   ├── routers/                 # FastAPI route handlers
│   └── services/                # Business logic layer
├── alembic/                     # Database migration scripts
├── alembic.ini
├── schema.sql                   # Raw PostgreSQL DDL (reference)
├── requirements.txt
└── .env.example
```

---

## Quick Start

### 1. Prerequisites

- Python 3.11+
- PostgreSQL 15+ running locally (or via Docker)
- `pip` or `uv`

### 2. Clone & install

```bash
git clone <repo-url>
cd backend

# Create a virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

pip install -r requirements.txt
```

### 3. Configure environment

```bash
copy .env.example .env
```

Edit `.env` with your real values:

| Variable | Description |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@host:5432/fintrack` |
| `SECRET_KEY` | Random 32+ character string |
| `ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_DAYS` | `7` |
| `CORS_ORIGINS` | JSON array of allowed origins |

### 4. Create the database

```bash
# Using psql
psql -U postgres -c "CREATE DATABASE fintrack;"

# Apply raw DDL (optional, Alembic preferred)
psql -U postgres -d fintrack -f schema.sql
```

### 5. Run Alembic migrations

```bash
# Generate first migration from models
alembic revision --autogenerate -m "initial schema"

# Apply migrations
alembic upgrade head
```

### 6. Start the server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs available at:
- Swagger UI → http://localhost:8000/docs
- ReDoc     → http://localhost:8000/redoc

---

## API Reference

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login (returns JWT) |
| GET  | `/api/v1/auth/me` | Get current user profile |

### Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/v1/transactions` | Paginated list with filters |
| POST | `/api/v1/transactions` | Create transaction |
| GET  | `/api/v1/transactions/{id}` | Get single transaction |
| PUT  | `/api/v1/transactions/{id}` | Update transaction |
| DELETE | `/api/v1/transactions/{id}` | Soft-delete transaction |
| POST | `/api/v1/transactions/upload` | Upload bank statement (PDF/CSV/Excel) |

#### Transaction filter query params

| Param | Type | Description |
|-------|------|-------------|
| `start_date` | `YYYY-MM-DD` | Filter from date |
| `end_date` | `YYYY-MM-DD` | Filter to date |
| `category` | string | e.g. `FOOD`, `TRAVEL` |
| `payment_method` | string | e.g. `UPI`, `CARD` |
| `type` | string | `INCOME` or `EXPENSE` |
| `page` | int | Page number (default 1) |
| `page_size` | int | Items per page (default 20, max 100) |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/analytics/dashboard-summary` | Key financial KPIs |
| GET | `/api/v1/analytics/spending-trends` | Daily/weekly/monthly aggregates |
| GET | `/api/v1/analytics/category-breakdown` | Spending % per category |
| GET | `/api/v1/analytics/payment-method-breakdown` | Spending % per payment method |
| GET | `/api/v1/analytics/comparison` | Period-over-period comparison |

#### Spending trends `period` values

`daily` | `weekly` | `fortnightly` | `monthly` | `quarterly` | `half_yearly` | `yearly` | `custom`

### Budgets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/budgets` | List budgets with progress |
| POST | `/api/v1/budgets` | Create budget |
| PUT | `/api/v1/budgets/{id}` | Update budget |
| DELETE | `/api/v1/budgets/{id}` | Delete budget |

---

## Authentication

All protected endpoints require a `Bearer` token:

```http
Authorization: Bearer <access_token>
```

Tokens expire after **7 days**. Refresh by calling `/api/v1/auth/login` again.

---

## Transaction Categories

| Category | Subcategories |
|----------|--------------|
| `FOOD` | user-defined |
| `TRAVEL` | user-defined |
| `SUBSCRIPTION` | user-defined |
| `SALARY` | `PAYROLL` |
| `MISCELLANEOUS` | `BILLS`, `RENT`, `EXPENSES`, `SERVICE` |

---

## Payment Methods

`UPI` | `CARD` | `WALLET` | `SUBSCRIPTION` | `CASH`

---

## AI Categorisation (Scaffold)

`app/services/transaction_service.py` contains `ai_suggest_category()` — a heuristic stub ready for ML model integration. See the docstring for integration notes.

---

## Docker (optional)

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```yaml
# docker-compose.yml (minimal)
version: "3.9"
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: fintrack
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports: ["5432:5432"]

  api:
    build: .
    ports: ["8000:8000"]
    depends_on: [db]
    env_file: .env
```

---

## Running Tests

```bash
pip install pytest pytest-asyncio httpx
pytest tests/ -v
```

---

## Production Checklist

- [ ] Set a strong `SECRET_KEY` (32+ random chars)
- [ ] Encrypt `bank_items.access_token` at rest (AES-256)
- [ ] Use environment-specific `DATABASE_URL` (RDS / Cloud SQL)
- [ ] Enable HTTPS / TLS termination
- [ ] Set `CORS_ORIGINS` to your real frontend domain
- [ ] Set up Alembic migration CI step before deploy
- [ ] Configure connection pool limits in `database.py`
- [ ] Integrate real ML model in `ai_suggest_category()`

---

## License

MIT
