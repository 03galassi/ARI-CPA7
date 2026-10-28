-- ARI-CPA7 — migração para adicionar o campo Codinome
-- Execute uma única vez no Supabase SQL Editor.
alter table public.profiles
  add column if not exists codinome text not null default '';
