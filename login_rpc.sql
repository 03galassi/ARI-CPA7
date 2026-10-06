-- Adiciona o e-mail de autenticação ao perfil e permite que o login por CPF
-- descubra o e-mail correspondente sem expor a tabela auth.users diretamente.
alter table public.profiles add column if not exists auth_email text;

update public.profiles
set auth_email = '03galassi@gmail.com'
where cpf = '82011435153';

create or replace function public.get_login_email(p_cpf text)
returns text
language sql
security definer
set search_path = public, auth
stable
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.cpf = regexp_replace(coalesce(p_cpf,''), '\\D', '', 'g')
    and p.status = 'ativo'
  limit 1;
$$;

grant execute on function public.get_login_email(text) to anon, authenticated;
