-- ARI-CPA7: adicionar local/equipe ao cadastro de perfis
alter table public.profiles
  add column if not exists location text;

-- Definir a equipe de cada agente já cadastrado antes de tornar o campo obrigatório.
-- Exemplo:
-- update public.profiles set location = 'ALI Jardim - MS' where id = '<UUID>';
-- update public.profiles set location = 'ALI Bonito - MS' where id = '<UUID>';

-- Depois de preencher todos os perfis, opcionalmente exigir valor:
-- alter table public.profiles alter column location set not null;

