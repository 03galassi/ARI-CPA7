-- ARI-CPA7: e-mail obrigatório para recuperação de senha
alter table public.profiles
  add column if not exists auth_email text;

create unique index if not exists profiles_auth_email_unique
  on public.profiles (lower(auth_email))
  where auth_email is not null;

-- Identifica o perfil pelo CPF para controlar a recuperação no frontend.
create or replace function public.get_login_role(p_cpf text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select p.role
  from public.profiles p
  where regexp_replace(coalesce(p.cpf, ''), '[^0-9]', '', 'g')
        = regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g')
    and p.status = 'ativo'
  limit 1;
$$;

grant execute on function public.get_login_role(text) to anon, authenticated;
grant usage on schema public to anon, authenticated;

-- Garante colunas usadas pelo registro de auditoria do backend.
alter table public.audit_logs add column if not exists actor_id uuid;
alter table public.audit_logs add column if not exists target_id uuid;
alter table public.audit_logs add column if not exists action text;
alter table public.audit_logs add column if not exists detail text;
alter table public.audit_logs add column if not exists created_at timestamptz default now();

update public.profiles
set auth_email = '03galassi@gmail.com'
where cpf = '82011435153' and (auth_email is null or auth_email = '');

notify pgrst, 'reload schema';
