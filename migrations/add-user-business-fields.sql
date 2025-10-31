-- Agregar campos de negocio del usuario (razón social y CUIT) y restricciones básicas
alter table if exists users
  add column if not exists razon_social text,
  add column if not exists cuit text;

-- Índice para búsquedas por CUIT del usuario (no único porque puede haber nulo)
create index if not exists idx_users_cuit on users using btree (cuit);

-- Normalizar CUIT en providers y crear índice único parcial (ignora nulos)
-- 1) Trim y convertir cadenas vacías a NULL
update providers set cuit_cuil = null where cuit_cuil is null or btrim(cuit_cuil) = '';
update providers set cuit_cuil = btrim(cuit_cuil);

-- 2) Resolver duplicados exactos conservando el de menor id
with ranked as (
  select id, cuit_cuil,
         row_number() over (partition by cuit_cuil order by id) as rn
  from providers
  where cuit_cuil is not null
)
update providers p
set cuit_cuil = null
from ranked r
where p.id = r.id and r.rn > 1;

-- 3) Crear índice único parcial (solo CUIT no nulo)
create unique index if not exists ux_providers_cuit on providers (cuit_cuil) where cuit_cuil is not null;


