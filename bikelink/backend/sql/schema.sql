-- One row = one purchasable variant (a size of a colourway), identified by SKU.
CREATE TABLE IF NOT EXISTS products (
  id          SERIAL PRIMARY KEY,
  sku         TEXT UNIQUE NOT NULL,
  slug        TEXT NOT NULL,
  name        TEXT NOT NULL,
  size        TEXT,
  description TEXT NOT NULL DEFAULT '',
  price_ore   INTEGER NOT NULL CHECK (price_ore >= 0),
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url   TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS products_slug_idx ON products (slug);

CREATE TABLE IF NOT EXISTS orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','fulfilled','cancelled')),
  provider        TEXT NOT NULL CHECK (provider IN ('stripe','vipps')),
  email           TEXT NOT NULL,
  total_ore       INTEGER NOT NULL,
  delivery_method TEXT NOT NULL DEFAULT 'home' CHECK (delivery_method IN ('home','dealer')),
  dealer_id       TEXT,
  provider_ref    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  order_id   UUID NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  price_ore  INTEGER NOT NULL,
  PRIMARY KEY (order_id, product_id)
);

-- ───────────── B2B dealer portal ─────────────
CREATE TABLE IF NOT EXISTS b2b_accounts (
  id            SERIAL PRIMARY KEY,
  company       TEXT NOT NULL,
  org_nr        TEXT NOT NULL,
  contact_name  TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT NOT NULL,
  address       TEXT NOT NULL,
  business_type TEXT NOT NULL,
  website       TEXT,
  message       TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  discount_pct  NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 90),
  password_hash TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at   TIMESTAMPTZ
);

-- One-time links to set or reset a password (only a hash is stored).
CREATE TABLE IF NOT EXISTS b2b_tokens (
  id         SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES b2b_accounts(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  purpose    TEXT NOT NULL CHECK (purpose IN ('invite','reset')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ
);

-- Optional per-SKU wholesale price (excl. VAT). Without a row: retail excl. VAT minus the account discount.
CREATE TABLE IF NOT EXISTS wholesale_prices (
  sku       TEXT PRIMARY KEY REFERENCES products(sku),
  price_ore INTEGER NOT NULL CHECK (price_ore >= 0)
);

CREATE TABLE IF NOT EXISTS b2b_orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no         SERIAL,
  account_id       INTEGER NOT NULL REFERENCES b2b_accounts(id),
  status           TEXT NOT NULL DEFAULT 'placed' CHECK (status IN ('placed','confirmed','shipped','cancelled')),
  reference        TEXT,
  note             TEXT,
  delivery_address TEXT NOT NULL,
  subtotal_ore     INTEGER NOT NULL,          -- excl. VAT
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS b2b_order_items (
  order_id   UUID NOT NULL REFERENCES b2b_orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  price_ore  INTEGER NOT NULL,                -- unit price excl. VAT at order time
  PRIMARY KEY (order_id, product_id)
);
CREATE INDEX IF NOT EXISTS b2b_orders_account_idx ON b2b_orders (account_id, created_at DESC);

-- ───────────── Daily stock sync (CSV from MMR by email) ─────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS stock_imports (
  id             SERIAL PRIMARY KEY,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  as_of          TIMESTAMPTZ NOT NULL,                 -- when the file was sent (orders after this are not in it yet)
  source         TEXT NOT NULL CHECK (source IN ('email','upload')),
  sender         TEXT,
  filename       TEXT,
  checksum       TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applied','rejected','failed')),
  message        TEXT,
  rows_total     INTEGER NOT NULL DEFAULT 0,
  matched        INTEGER NOT NULL DEFAULT 0,
  unmatched      INTEGER NOT NULL DEFAULT 0,
  changed        INTEGER NOT NULL DEFAULT 0,
  unmatched_skus TEXT[] NOT NULL DEFAULT '{}',
  parsed         JSONB NOT NULL DEFAULT '{}',          -- { sku: quantity } for the matched rows
  applied_at     TIMESTAMPTZ,
  applied_by     TEXT
);
CREATE INDEX IF NOT EXISTS stock_imports_created_idx ON stock_imports (created_at DESC);

-- ───────────── Back-office staff accounts (password + authenticator app) ─────────────
CREATE TABLE IF NOT EXISTS admin_users (
  id              SERIAL PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  name            TEXT,
  role            TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','staff')),
  password_hash   TEXT,
  totp_secret_enc TEXT,                                -- AES-256-GCM encrypted, never stored in plain text
  totp_enabled    BOOLEAN NOT NULL DEFAULT false,
  totp_last_step  BIGINT NOT NULL DEFAULT 0,           -- a code can only be used once
  recovery_hashes TEXT[] NOT NULL DEFAULT '{}',
  disabled        BOOLEAN NOT NULL DEFAULT false,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  session_version INTEGER NOT NULL DEFAULT 0,          -- bump to sign the user out everywhere
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_tokens (
  id         SERIAL PRIMARY KEY,
  admin_id   INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  purpose    TEXT NOT NULL CHECK (purpose IN ('invite','reset')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS admin_audit (
  id       BIGSERIAL PRIMARY KEY,
  at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  admin_id INTEGER,
  email    TEXT,
  action   TEXT NOT NULL,
  detail   JSONB NOT NULL DEFAULT '{}',
  ip       TEXT
);
CREATE INDEX IF NOT EXISTS admin_audit_at_idx ON admin_audit (at DESC);
