-- =============================================================================
-- 0003 — CORREÇÃO DE PERMISSÕES (erro 42501)
--
-- CONTEXTO DO ERRO:
-- a migration de RLS terminava com um bloco `revoke all ... from anon`,
-- justificado como "explícito é melhor". Era redundante — as policies já
-- restringem `to authenticated` — e teve dois efeitos ruins:
--
--   1. Se a requisição chegar como `anon` (sessão expirada, token não enviado),
--      o Postgres devolve 42501 "permissão negada" em vez de simplesmente uma
--      lista vazia. Erro opaco no lugar de comportamento previsível.
--   2. Mascara o diagnóstico real: fica impossível distinguir "não autorizado"
--      de "tabela sem grant".
--
-- LIÇÃO GERAL (vale anotar):
-- em Postgres, GRANT e RLS são DUAS camadas diferentes, avaliadas nessa ordem.
--   - Sem GRANT  -> erro 42501, a consulta nem chega no RLS.
--   - Com GRANT e sem policy que case -> 0 linhas, sem erro.
-- Confundir as duas é a causa mais comum de "meu RLS não funciona".
-- O correto é: GRANT amplo para o papel, e RLS decidindo linha a linha.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Desfaz o revoke problemático e concede explicitamente ao papel logado.
--
-- Conceder DELETE não é perigoso aqui: não existe policy de DELETE em nenhuma
-- das tabelas, então o RLS continua barrando qualquer exclusão. O GRANT abre a
-- porta; a policy é quem decide se alguém passa — e para DELETE não há policy.
-- Mesmo assim, não concedo DELETE: sem grant e sem policy, a proibição fica
-- registrada nas duas camadas.
-- ---------------------------------------------------------------------------
grant select, insert, update on public.idosos              to authenticated;
grant select, insert, update on public.registros           to authenticated;
grant select                 on public.usuarios_autorizados to authenticated;

-- Permite executar a função de autorização.
grant execute on function public.is_autorizado() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. O papel anônimo continua sem acesso — mas agora pela via correta.
--
-- Em vez de revogar o grant (que gerava 42501), deixamos o RLS fazer o
-- trabalho: as policies são `to authenticated`, então uma requisição anônima
-- simplesmente não casa com nenhuma policy e recebe ZERO LINHAS.
-- Mesmo resultado prático, erro nenhum, e o diagnóstico fica limpo.
-- ---------------------------------------------------------------------------
grant select on public.idosos              to anon;
grant select on public.registros           to anon;
grant select on public.usuarios_autorizados to anon;

-- Confirmação: sem sessão válida, isto deve devolver 0 linhas (e não erro).
-- Para testar de fato, use o app deslogado ou um curl sem Authorization.


-- =============================================================================
-- CHECAGEM RÁPIDA — deve listar 'authenticated' com SELECT nas três tabelas.
-- =============================================================================
-- select table_name, grantee, privilege_type
--   from information_schema.role_table_grants
--  where table_schema = 'public' and grantee in ('anon','authenticated')
--  order by table_name, grantee;
