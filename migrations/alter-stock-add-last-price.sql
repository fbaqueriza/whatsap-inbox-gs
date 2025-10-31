-- Añadir columna de precio unitario neto a la tabla de stock usada por el frontend
alter table if exists stock
  add column if not exists last_price_net numeric;


