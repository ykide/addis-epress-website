CREATE TABLE IF NOT EXISTS delivery_requests (
  id UUID PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  pickup_address TEXT NOT NULL,
  dropoff_address TEXT NOT NULL,
  package_type TEXT NOT NULL,
  weight_kg NUMERIC(10,2) NOT NULL,
  notes TEXT,
  dimension_length_cm NUMERIC(10,2) NOT NULL,
  dimension_width_cm NUMERIC(10,2) NOT NULL,
  dimension_height_cm NUMERIC(10,2) NOT NULL,
  distance_km NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'RECEIVED',
  total_before_vat NUMERIC(12,2) NOT NULL,
  vat_amount NUMERIC(12,2) NOT NULL,
  grand_total NUMERIC(12,2) NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS status_history (
  id UUID PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES delivery_requests(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  note TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_requests_status ON delivery_requests(status);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_created_at ON delivery_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_status_history_request_id ON status_history(request_id);
