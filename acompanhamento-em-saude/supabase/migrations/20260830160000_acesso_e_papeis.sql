-- =============================================================================
-- 0008 — CADASTRO COM APROVAÇÃO + PAPEL DE ADMINISTRADOR
--
-- MUDANÇA NO MODELO DE ACESSO:
--
-- Antes: não existia cadastro. As contas eram criadas manualmente no painel.
-- Agora: qualquer pessoa com o link cria a própria conta e escolhe a senha,
--        mas nasce SEM autorização e não vê nada até o administrador aprovar.
--
-- A barreira de segurança NÃO mudou: continua sendo `usuarios_autorizados.ativo`,
-- verificada por is_autorizado() em toda policy. O que mudou é quem faz o
-- trabalho de criar a conta. Uma pessoa que receba o link repassado indevidamente
-- consegue se cadastrar e receberá exatamente ZERO linhas até ser aprovada.
--
-- Por isso o cadastro aberto é seguro aqui: ele não concede acesso, só cria um
-- pedido.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Papel do usuário
-- -----------------------------------------------------------------------------
create type public.papel_enum as enum ('admin', 'operador');

alter table public.usuarios_autorizados
  add column papel public.papel_enum not null default 'operador';

comment on column public.usuarios_autorizados.papel is
  'admin pode excluir atendido permanentemente. operador faz o resto.';

-- O nome já existia como coluna opcional; agora ele é preenchido pelo próprio
-- cadastro e usado na etiqueta "by Fulano de Tal" das telas.
comment on column public.usuarios_autorizados.nome is
  'Nome completo informado no cadastro. Exibido como autor dos lançamentos.';


-- -----------------------------------------------------------------------------
-- 2. Criar o pedido de acesso automaticamente no cadastro
--
-- POR QUE UM TRIGGER, E NÃO UM INSERT PELO FRONTEND:
-- se o app pudesse inserir em usuarios_autorizados, qualquer pessoa poderia
-- chamar a API direto e se inserir já com `ativo = true` e `papel = 'admin'`.
-- Seria um buraco enorme.
--
-- Com o trigger, a linha é criada pelo BANCO, sempre com ativo = false e
-- papel = 'operador'. O frontend não tem — e não precisa ter — permissão de
-- escrita nesta tabela.
-- -----------------------------------------------------------------------------
create or replace function public.tg_criar_pedido_acesso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios_autorizados (email, nome, user_id, ativo, papel)
  values (
    new.email,
    -- Nome completo, enviado pelo formulário de cadastro em options.data.nome.
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'nome', '')), ''),
    new.id,
    false,        -- nasce PENDENTE. Só o admin libera.
    'operador'    -- nunca admin por cadastro.
  )
  on conflict (lower(email)) do update
     set user_id = excluded.user_id,
         nome = coalesce(public.usuarios_autorizados.nome, excluded.nome);
  -- O `on conflict` cobre o caso de o e-mail já ter sido pré-autorizado por
  -- você antes de a pessoa se cadastrar: nesse caso a linha já existe e só
  -- ganha o vínculo com a conta, sem perder o `ativo` que você já tinha dado.
  return new;
end;
$$;

create trigger auth_users_criar_pedido_acesso
  after insert on auth.users
  for each row execute function public.tg_criar_pedido_acesso();


-- -----------------------------------------------------------------------------
-- 3. Deixar a pessoa consultar o PRÓPRIO status
--
-- Sem isto, quem está pendente não consegue ler nem a própria linha (a policy
-- exigia is_autorizado(), que é falso para ela) e o app não teria como mostrar
-- a tela "aguardando aprovação" — só uma tela vazia sem explicação.
--
-- A abertura é mínima: cada pessoa enxerga a linha dela e mais nada.
-- -----------------------------------------------------------------------------
drop policy if exists ua_select on public.usuarios_autorizados;

create policy ua_select on public.usuarios_autorizados
  for select to authenticated
  using (public.is_autorizado() or user_id = auth.uid());


-- -----------------------------------------------------------------------------
-- 4. is_admin()
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer          -- mesmo motivo de is_autorizado(): evita recursão
set search_path = public
as $$
  select exists (
    select 1
      from public.usuarios_autorizados u
     where lower(u.email) = lower(auth.jwt() ->> 'email')
       and u.ativo = true
       and u.papel = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;


-- -----------------------------------------------------------------------------
-- 5. Excluir atendido passa a ser exclusivo do administrador
--
-- ISTO É O QUE REALMENTE RESTRINGE. Esconder o botão no React é conforto
-- visual: todo o código do frontend roda no navegador da pessoa e pode ser
-- contornado. A regra que vale é esta linha aqui.
-- -----------------------------------------------------------------------------
drop policy if exists idosos_delete on public.idosos;

create policy idosos_delete on public.idosos
  for delete to authenticated
  using (public.is_admin());

-- Excluir EVENTO continua liberado para qualquer autorizado: é gasto de
-- prestação de contas, não prontuário. Se quiser restringir também, troque
-- is_autorizado() por is_admin() na policy eventos_delete.


-- =============================================================================
-- DEPOIS DE APLICAR — dois passos obrigatórios:
--
-- 1) Torne-se administrador (troque pelo seu e-mail):
--
--      update public.usuarios_autorizados
--         set papel = 'admin', ativo = true
--       where lower(email) = lower('admin@exemplo.com');
--
-- 2) No painel: Authentication → Providers → Email → LIGUE "Enable Signups".
--    Sem isso, a tela de cadastro não funciona.
--
--
-- COMO APROVAR ALGUÉM (painel do Supabase → Table Editor →
-- usuarios_autorizados, ou por SQL):
--
--      update public.usuarios_autorizados set ativo = true
--       where email = 'pessoa@exemplo.com';
--
-- COMO REVOGAR:
--
--      update public.usuarios_autorizados set ativo = false
--       where email = 'pessoa@exemplo.com';
--
-- Revogar tem efeito imediato na próxima consulta que a pessoa fizer: ela
-- continua logada, mas passa a receber listas vazias.
--
-- VER QUEM ESTÁ AGUARDANDO:
--
--      select email, nome, created_at from public.usuarios_autorizados
--       where ativo = false order by created_at desc;
-- =============================================================================
