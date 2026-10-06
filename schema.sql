-- ARI-CPA7 / Supabase
-- Execute no SQL Editor do projeto Supabase.
-- IMPORTANTE: use RLS; não confie em filtros feitos apenas no JavaScript.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  cpf text not null unique,
  role text not null default 'operator' check (role in ('operator','admin')),
  status text not null default 'ativo' check (status in ('ativo','bloqueado')),
  created_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  saida_local text not null,
  saida_data date not null,
  saida_hora time not null,
  viatura text not null,
  km_inicial integer not null check (km_inicial >= 0),
  destino text not null,
  descricao text not null,
  informacao text not null,
  retorno_local text,
  km_final integer check (km_final is null or km_final >= km_inicial),
  retorno_data date,
  retorno_hora time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.activities enable row level security;

-- Usuário só consulta o próprio perfil.
create policy "profile_self_select" on public.profiles
for select using (id = auth.uid());

-- Administrador pode consultar os perfis para identificar a equipe nos relatórios.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.status = 'ativo');
$$;

create policy "profile_admin_select" on public.profiles
for select using (public.is_admin());

-- Usuário só consulta os próprios registros.
create policy "activity_owner_select" on public.activities
for select using (owner_id = auth.uid());

-- Administrador pode consultar todos os relatórios lançados pela equipe.
create policy "activity_admin_select" on public.activities
for select using (public.is_admin());

-- Usuário só cria registro para si mesmo.
create policy "activity_owner_insert" on public.activities
for insert with check (owner_id = auth.uid());

-- Usuário só edita os próprios registros.
create policy "activity_owner_update" on public.activities
for update using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- Não permitir exclusão pelo operador.
-- Exclusão administrativa será implementada separadamente, se desejada.

-- Trigger para preencher owner_id automaticamente e impedir troca do proprietário.
create or replace function public.set_activity_owner()
returns trigger
language plpgsql
security invoker
as $$
begin
  if tg_op = 'INSERT' then
    new.owner_id := auth.uid();
  elsif tg_op = 'UPDATE' then
    new.owner_id := old.owner_id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_activity_owner on public.activities;
create trigger trg_activity_owner
before insert or update on public.activities
for each row execute function public.set_activity_owner();

-- Observação:
-- A criação dos usuários deve ser feita pelo administrador/backend,
-- nunca expondo uma chave service_role no navegador.


-- CADASTRO DE USUÁRIOS
-- Em produção, o administrador original deve chamar uma Edge Function/backend
-- que use service_role para criar auth.users e inserir public.profiles.
-- Nunca coloque service_role no navegador.
-- O perfil admin/operador fica protegido por RLS; o cliente não deve criar usuários diretamente.
