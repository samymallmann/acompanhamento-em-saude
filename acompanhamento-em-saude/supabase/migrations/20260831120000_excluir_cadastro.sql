-- =============================================================================
-- 0010 — EXCLUIR CADASTRO DE ACESSO (exclusivo do administrador)
--
-- O QUE ISTO RESOLVE:
-- o cadastro é aberto — qualquer pessoa com o link cria uma conta. Ela não vê
-- nada até ser aprovada, então isso não é falha de segurança. Mas a lista de
-- Acessos acumula pedidos de gente que não deveria estar ali (link repassado,
-- teste, e-mail digitado errado), e "Revogar" não limpa: revogar é
-- `ativo = false`, a linha continua na tela.
--
-- Daqui em diante o administrador pode apagar de vez.
--
--
-- POR QUE PRECISA DE UMA FUNÇÃO, E NÃO DE UMA POLICY DE DELETE:
--
-- apagar o cadastro de verdade significa apagar DUAS coisas:
--   1. a linha em public.usuarios_autorizados  (o pedido/permissão)
--   2. a conta em auth.users                   (o login e a senha)
--
-- Só apagar a (1) deixaria a pessoa num limbo: a conta continua existindo, ela
-- consegue logar, cai na tela de espera para sempre, e não consegue se
-- cadastrar de novo porque o e-mail "já existe". Pior que não apagar.
--
-- E a (2) o frontend NÃO pode fazer: auth.users é do sistema do Supabase e a
-- chave pública não tem — nem deve ter — permissão ali. A saída é uma função
-- SECURITY DEFINER: ela roda com os privilégios de quem a criou (postgres),
-- não de quem a chama. Quem chama só consegue fazer exatamente o que está
-- escrito aqui dentro, e nada além.
--
--
-- SECURITY DEFINER É PODEROSO, ENTÃO A PORTA É ESTREITA DE PROPÓSITO:
-- a primeira linha do corpo confere is_admin(). Sem essa checagem, qualquer
-- pessoa logada poderia apagar contas — a função ignora o RLS por natureza.
-- Numa função assim, a checagem de permissão é responsabilidade do código.
-- =============================================================================


create or replace function public.excluir_cadastro(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_papel   public.papel_enum;
  v_ativo   boolean;
  v_email   text;
begin
  -- ---------------------------------------------------------------------
  -- Trava 1 — só administrador.
  -- Esta linha é a segurança de verdade. Esconder o botão no React é só
  -- conforto visual.
  -- ---------------------------------------------------------------------
  if not public.is_admin() then
    raise exception 'Apenas o administrador pode excluir cadastros.';
  end if;

  select user_id, papel, ativo, email
    into v_user_id, v_papel, v_ativo, v_email
    from public.usuarios_autorizados
   where id = p_id;

  if not found then
    raise exception 'Cadastro não encontrado.';
  end if;

  -- ---------------------------------------------------------------------
  -- Trava 2 — não dá para apagar a si mesmo.
  -- Seria irreversível pela própria tela: você perderia o acesso e não
  -- teria mais como se readmitir sem voltar ao painel do Supabase.
  -- ---------------------------------------------------------------------
  if v_user_id is not null and v_user_id = auth.uid() then
    raise exception 'Você não pode excluir o próprio cadastro.';
  end if;

  -- ---------------------------------------------------------------------
  -- Trava 3 — tem que sobrar pelo menos um administrador ativo.
  -- Mesma regra do tg_proteger_admin, repetida aqui porque aquele trigger é
  -- `before update` e não enxerga um delete.
  -- ---------------------------------------------------------------------
  if v_papel = 'admin' and v_ativo then
    if (select count(*)
          from public.usuarios_autorizados
         where papel = 'admin' and ativo = true and id <> p_id) = 0 then
      raise exception 'O sistema precisa de pelo menos um administrador ativo.';
    end if;
  end if;

  -- ---------------------------------------------------------------------
  -- Trava 4 — quem já lançou dados não pode ser apagado.
  --
  -- Esta trava não foi escrita agora: ela já existia desde a Etapa 2, na
  -- forma de `created_by uuid not null references auth.users(id)` SEM
  -- `on delete`. Sem cláusula, o Postgres assume NO ACTION, e recusa apagar
  -- a conta enquanto houver qualquer linha apontando para ela.
  --
  -- O efeito é exatamente o que se quer para dado de saúde: a identificação
  -- de quem fez cada lançamento não pode desaparecer por um clique numa
  -- outra tela. Só o que falta é traduzir o erro do banco, que é ilegível.
  --
  -- As duas exclusões ficam na mesma transação (corpo da função): se a
  -- segunda falhar, a primeira volta atrás sozinha. Nunca sobra meio
  -- cadastro apagado.
  -- ---------------------------------------------------------------------
  delete from public.usuarios_autorizados where id = p_id;

  if v_user_id is not null then
    begin
      delete from auth.users where id = v_user_id;
    exception
      when foreign_key_violation then
        raise exception
          'Não é possível excluir %: esta pessoa já lançou dados no sistema, e apagar a conta apagaria a identificação de quem fez esses lançamentos. Use "Revogar acesso" no lugar.',
          coalesce(v_email, 'este cadastro');
    end;
  end if;
end;
$$;


-- -----------------------------------------------------------------------------
-- Quem pode CHAMAR a função.
--
-- ATENÇÃO — aqui o `revoke ... from public` NÃO é redundante, ao contrário do
-- que aconteceu comigo na migration 0003 (onde revogar de `anon` numa TABELA
-- só serviu para transformar um erro de RLS num 42501 indecifrável).
--
-- A diferença: no Postgres, toda função nasce com EXECUTE liberado para PUBLIC,
-- o que inclui o papel `anon` (visitante sem login). Numa função SECURITY
-- DEFINER isso importa de verdade, porque ela ignora o RLS por natureza. Aqui a
-- checagem interna de is_admin() já barraria o anônimo, mas deixar a porta
-- fechada nas duas camadas é o padrão para este tipo de função.
--
-- A regra que separa os dois casos: revogar por revogar esconde diagnóstico;
-- revogar onde o padrão do Postgres é permissivo demais é necessário.
-- -----------------------------------------------------------------------------
revoke all on function public.excluir_cadastro(uuid) from public;
grant execute on function public.excluir_cadastro(uuid) to authenticated;

comment on function public.excluir_cadastro(uuid) is
  'Apaga o pedido de acesso e a conta de login. Só administrador. Recusa se a pessoa já lançou dados.';


-- =============================================================================
-- DIFERENÇA ENTRE AS DUAS AÇÕES DA TELA DE ACESSOS:
--
--   Revogar  -> ativo = false. A pessoa continua na lista, continua existindo,
--               para de ver os dados na hora. Reversível com um clique. É o
--               certo para quem saiu da equipe.
--
--   Excluir  -> some da lista e a conta de login deixa de existir. A pessoa
--               pode se cadastrar de novo do zero. É o certo para cadastro
--               indesejado, teste ou e-mail digitado errado.
--
-- Conferir antes de apagar, se quiser saber se alguém lançou algo:
--
--   select u.email, u.nome,
--          (select count(*) from public.idosos    i where i.created_by = u.user_id) as atendidos,
--          (select count(*) from public.registros r where r.created_by = u.user_id) as registros,
--          (select count(*) from public.eventos   e where e.created_by = u.user_id) as eventos
--     from public.usuarios_autorizados u
--    order by u.created_at desc;
-- =============================================================================
