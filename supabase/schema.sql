-- Esegui questo script nel SQL Editor di Supabase (una sola volta)

create table if not exists dashboard_data (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists dashboard_data_updated_at_idx
  on dashboard_data (updated_at desc);

-- Riga unica condivisa da tutto il team
insert into dashboard_data (id, payload)
values ('main', '{}'::jsonb)
on conflict (id) do nothing;
