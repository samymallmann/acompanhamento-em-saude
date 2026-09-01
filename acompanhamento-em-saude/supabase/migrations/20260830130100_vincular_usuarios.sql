-- =============================================================================
-- 0005 — VINCULAR usuarios_autorizados.user_id (F3)
--
-- PROBLEMA QUE ISTO RESOLVE:
-- as tabelas guardam `created_by`, que é o UUID de quem lançou — algo como
-- 'a3f2c1...'. O e-mail correspondente mora em `auth.users`, uma tabela do
-- sistema do Supabase que o frontend NÃO pode ler (e nem deveria).
--
-- Sem esta vinculação, a tela mostraria o código em vez de "by mae@email.com".
--
-- A coluna `user_id` foi criada lá na Etapa 2, marcada como "hoje é
-- documental". É agora que ela ganha uso.
--
-- Depois disto, o frontend lê `usuarios_autorizados` (que já tem policy de
-- SELECT) e monta um mapa user_id → nome/e-mail. Nenhuma tabela do sistema
-- fica exposta, e a identificação do autor continua 100% automática — a
-- usuária nunca digita quem lançou.
-- =============================================================================

update public.usuarios_autorizados u
   set user_id = a.id
  from auth.users a
 where lower(a.email) = lower(u.email)
   and u.user_id is null;


-- Conferência: todos os autorizados devem ficar com user_id preenchido.
-- Quem sobrar com NULL é e-mail autorizado que ainda não tem conta criada em
-- Authentication > Users — o que é normal, mas essa pessoa apareceria como
-- "autor não identificado" se lançasse algo (o que ela não consegue fazer
-- sem conta, então na prática não acontece).
--
--   select email, nome, user_id is not null as vinculado
--     from public.usuarios_autorizados order by email;


-- -----------------------------------------------------------------------------
-- Manter a vinculação automática dali em diante.
--
-- Sem isto, toda vez que você criasse uma conta nova e a adicionasse à lista
-- branca, precisaria lembrar de rodar o update acima de novo. Um trigger
-- resolve na origem: ao inserir um e-mail autorizado, ele já procura a conta
-- correspondente sozinho.
-- -----------------------------------------------------------------------------
create or replace function public.tg_vincular_usuario()
returns trigger
language plpgsql
security definer          -- precisa ler auth.users, que o papel comum não lê
set search_path = public  -- obrigatório junto com security definer
as $$
begin
  if new.user_id is null then
    select a.id into new.user_id
      from auth.users a
     where lower(a.email) = lower(new.email)
     limit 1;
  end if;
  return new;
end;
$$;

create trigger usuarios_autorizados_vincular
  before insert or update of email on public.usuarios_autorizados
  for each row execute function public.tg_vincular_usuario();
