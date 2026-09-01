-- =============================================================================
-- DIAGNÓSTICO — rode no SQL Editor do Supabase e me mande o resultado.
-- Só faz leitura, não altera nada.
-- =============================================================================

-- 1) As tabelas existem?
select 'tabelas' as checagem, table_name
  from information_schema.tables
 where table_schema = 'public'
 order by table_name;

-- 2) Quais papéis têm permissão em cada tabela?
--    É AQUI que o erro 42501 se explica: se 'authenticated' não aparecer com
--    SELECT, a consulta é barrada antes mesmo de o RLS ser avaliado.
select 'grants' as checagem, table_name, grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public'
   and grantee in ('anon', 'authenticated', 'PUBLIC')
 order by table_name, grantee, privilege_type;

-- 3) O RLS está ligado?
select 'rls' as checagem, relname as tabela, relrowsecurity as rls_ligado
  from pg_class
 where relnamespace = 'public'::regnamespace
   and relname in ('idosos', 'registros', 'usuarios_autorizados');

-- 4) As policies foram criadas?
select 'policies' as checagem, tablename, policyname, cmd, roles
  from pg_policies
 where schemaname = 'public'
 order by tablename, policyname;

-- 5) A função de autorização existe?
select 'funcao' as checagem, proname, prosecdef as security_definer
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname = 'is_autorizado';

-- 6) Quais contas existem e quais e-mails estão autorizados?
--    Compare as duas listas: o e-mail com que você faz login precisa aparecer
--    nas DUAS, escrito igual.
select 'contas' as checagem, email, created_at from auth.users order by created_at;

select 'autorizados' as checagem, email, ativo from public.usuarios_autorizados;
