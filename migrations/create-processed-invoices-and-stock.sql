-- Auditoría de facturas procesadas
create table if not exists processed_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  supplier_id uuid,
  source_url text,
  content_hash text,
  status text default 'processed',
  header_json jsonb,
  ocr_text text,
  created_at timestamptz default now()
);

create index if not exists idx_processed_invoices_user on processed_invoices(user_id);
create index if not exists idx_processed_invoices_supplier on processed_invoices(supplier_id);
create index if not exists idx_processed_invoices_hash on processed_invoices(content_hash);
-- Idempotencia por usuario + hash de contenido
create unique index if not exists ux_processed_invoices_user_hash on processed_invoices(user_id, content_hash);

-- Ítems extraídos de la factura
create table if not exists processed_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references processed_invoices(id) on delete cascade,
  line_number int,
  description text,
  unit text,
  quantity numeric,
  unit_price_net numeric,
  total_net numeric
);

create index if not exists idx_invoice_items_invoice on processed_invoice_items(invoice_id);

-- Stock por proveedor (mínimo necesario)
create table if not exists stock_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  provider_id uuid not null,
  name text not null,
  unit text,
  last_price_net numeric,
  last_quantity numeric,
  updated_at timestamptz default now(),
  unique(user_id, provider_id, name)
);

create index if not exists idx_stock_items_provider on stock_items(provider_id);
create index if not exists idx_stock_items_user on stock_items(user_id);


