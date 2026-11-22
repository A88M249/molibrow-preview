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
