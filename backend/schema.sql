-- ============================================================
-- FinTrack PostgreSQL Schema
-- Production-ready DDL with all constraints, indexes, and cascade rules
-- Currency: INR (Indian Rupee) — configurable per user
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Table: users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         VARCHAR(255) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name     VARCHAR(255),
    currency      VARCHAR(3) NOT NULL DEFAULT 'INR',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_users_email UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS ix_users_email ON users (email);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Table: bank_items
-- Stores secure connections to bank/UPI providers (Plaid, Setu, NPCI)
-- IMPORTANT: access_token must be AES-256 encrypted before storage
-- ============================================================
CREATE TABLE IF NOT EXISTS bank_items (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL,
    -- SECURITY: This column must store AES-256 encrypted ciphertext ONLY. Never plaintext.
    access_token     TEXT NOT NULL,
    item_id          VARCHAR(255) NOT NULL,  -- Provider's unique bank link identifier
    institution_name VARCHAR(255) NOT NULL,  -- e.g., 'SBI', 'HDFC', 'ICICI', 'Paytm'
    -- Status: ACTIVE | DISCONNECTED | ERROR | PENDING_REAUTH
    status           VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_synced_at   TIMESTAMPTZ,

    CONSTRAINT fk_bank_items_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_bank_items_item_id UNIQUE (item_id)
);

CREATE INDEX IF NOT EXISTS ix_bank_items_user_id ON bank_items (user_id);

-- ============================================================
-- Table: accounts
-- A bank_item can have multiple sub-accounts (checking, savings, credit)
-- bank_item_id is nullable to support manual accounts (cash, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bank_item_id        UUID,               -- NULL = manual account
    user_id             UUID NOT NULL,
    account_provider_id VARCHAR(255),       -- Bank's internal account ID (nullable for manual)
    name                VARCHAR(255) NOT NULL,
    -- Account type: depository | credit | wallet | upi | manual
    type                VARCHAR(50) NOT NULL DEFAULT 'manual',
    -- Payment method: UPI | CARD | WALLET | SUBSCRIPTION | CASH
    payment_method      VARCHAR(50) NOT NULL DEFAULT 'UPI',
    balance             NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    currency            VARCHAR(3) NOT NULL DEFAULT 'INR',
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_accounts_bank_item FOREIGN KEY (bank_item_id)
        REFERENCES bank_items(id) ON DELETE SET NULL,
    CONSTRAINT fk_accounts_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_accounts_provider_id UNIQUE (account_provider_id)
);

CREATE INDEX IF NOT EXISTS ix_accounts_user_id ON accounts (user_id);
CREATE INDEX IF NOT EXISTS ix_accounts_bank_item_id ON accounts (bank_item_id);

CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Table: transactions
-- Handles both manual entries and auto-synced bank transactions
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID NOT NULL,
    account_id              UUID,
    -- Bank/UPI provider transaction ID for deduplication (NULL for manual entries)
    provider_transaction_id VARCHAR(255),
    -- Amount is always POSITIVE. Direction determined by 'type'.
    amount                  NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    -- Transaction direction: INCOME | EXPENSE
    type                    VARCHAR(20) NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
    -- Payment method: UPI | CARD | WALLET | SUBSCRIPTION | CASH
    payment_method          VARCHAR(50) NOT NULL DEFAULT 'UPI',
    -- User-edited or cleaned merchant name
    description             VARCHAR(500) NOT NULL,
    -- Raw string from bank feed (kept for audit/ML training)
    raw_merchant_name       VARCHAR(500),
    -- Primary category: FOOD | TRAVEL | MISCELLANEOUS | SUBSCRIPTION | SALARY | RENT | BILLS | SERVICE | PAYROLL
    category                VARCHAR(100) NOT NULL DEFAULT 'MISCELLANEOUS',
    -- Sub-category (user-defined): RESTAURANTS | DELIVERY | FUEL | RENT | etc.
    subcategory             VARCHAR(100),
    -- AI Categorization Engine output (future ML model integration hook)
    ai_suggested_category   VARCHAR(100),
    transaction_date        DATE NOT NULL,
    -- True if bank transaction is still pending settlement
    is_pending              BOOLEAN NOT NULL DEFAULT FALSE,
    -- Soft delete: NULL = active record, timestamp = deleted
    deleted_at              TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_transactions_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_transactions_account FOREIGN KEY (account_id)
        REFERENCES accounts(id) ON DELETE SET NULL
);

-- Standard indexes for high-performance queries
CREATE INDEX IF NOT EXISTS ix_transactions_user_id ON transactions (user_id);
CREATE INDEX IF NOT EXISTS ix_transactions_account_id ON transactions (account_id);
CREATE INDEX IF NOT EXISTS ix_transactions_date ON transactions (transaction_date DESC);
CREATE INDEX IF NOT EXISTS ix_transactions_category ON transactions (category);
CREATE INDEX IF NOT EXISTS ix_transactions_payment_method ON transactions (payment_method);
CREATE INDEX IF NOT EXISTS ix_transactions_provider_id ON transactions (provider_transaction_id);

-- Partial index for active (non-deleted) transactions — most frequent query pattern
CREATE INDEX IF NOT EXISTS ix_transactions_active
    ON transactions (user_id, transaction_date DESC)
    WHERE deleted_at IS NULL;

-- ============================================================
-- IDEMPOTENCY CONSTRAINT
-- Prevents duplicate transactions during sequential bank sync webhooks.
-- Only enforced when provider_transaction_id is NOT NULL.
-- Uses a partial unique index (more correct than a full unique constraint).
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_transaction_account_provider
    ON transactions (account_id, provider_transaction_id)
    WHERE provider_transaction_id IS NOT NULL;

-- ============================================================
-- Table: budgets
-- Per-category monthly budget limits with real-time spending tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS budgets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL,
    category        VARCHAR(100) NOT NULL,
    payment_method  VARCHAR(50),         -- Optional: scope budget to a specific payment method
    limit_amount    NUMERIC(12, 2) NOT NULL CHECK (limit_amount > 0),
    current_spent   NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    -- Format: 'YYYY-MM' (e.g., '2026-06')
    month_year      VARCHAR(7) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_budgets_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_budgets_user_id ON budgets (user_id);
CREATE INDEX IF NOT EXISTS ix_budgets_user_month ON budgets (user_id, month_year);

CREATE TRIGGER update_budgets_updated_at
    BEFORE UPDATE ON budgets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Sample seed data (development only — comment out for production)
-- ============================================================
-- INSERT INTO users (email, hashed_password, full_name, currency)
-- VALUES ('demo@fintrack.app', '$2b$12$...bcrypt_hash...', 'Demo User', 'INR');
