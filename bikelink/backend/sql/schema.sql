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
