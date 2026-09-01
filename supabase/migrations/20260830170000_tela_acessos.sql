-- =============================================================================
-- 0009 — PERMISSÕES PARA A TELA DE ACESSOS
--
-- Até aqui, aprovar alguém exigia entrar no painel do Supabase e rodar SQL.
-- Funciona, mas não é lugar para uma tarefa de rotina — e é justamente a
-- tarefa que acontece toda vez que entra gente nova.
--
-- Esta migration abre o mínimo necessário para existir uma tela de "Acessos"
-- DENTRO do sistema, visível só para o administrador.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Administrador pode ler TODA a lista
--
-- A policy atual deixa cada pessoa ver a própria linha (para a tela de espera)
-- e os autorizados verem todos. Reescrevo deixando explícitos os três casos,
-- porque agora eles têm propósitos diferentes.
-- -----------------------------------------------------------------------------
drop policy if exists ua_select on public.usuarios_autorizados;

create policy ua_select on public.usuarios_autorizados
  for select to authenticated
  using (
    -- Administrador: vê todo mundo, inclusive quem está aguardando.
    public.is_admin()

    -- Autorizado comum: vê apenas quem JÁ está liberado. É o suficiente para
    -- montar a etiqueta "by Fulano de Tal" nos lançamentos.
    -- O `and ativo` é o detalhe que importa: sem ele, qualquer operadora
    -- enxergaria o nome e o e-mail de todo mundo que pediu acesso e não foi
    -- aprovado — informação que ela não precisa e que não é dela.
    or (public.is_autorizado() and ativo = true)

    -- Pendente: só a própria linha, para a tela "aguardando aprovação".
    or user_id = auth.uid()
  );


-- -----------------------------------------------------------------------------
-- 2. Só o administrador altera a lista
--
-- Sem policy de INSERT: a única forma de entrar na lista continua sendo o
-- trigger do cadastro. Nem o admin insere pela aplicação — assim não existe
-- caminho para criar um autorizado sem que exista a conta correspondente.
--
-- Sem policy de DELETE: revogar é `ativo = false`, mesmo padrão do resto.
-- -----------------------------------------------------------------------------
create policy ua_update on public.usuarios_autorizados
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant update on public.usuarios_autorizados to authenticated;


-- -----------------------------------------------------------------------------
-- 3. Trava contra tiro no pé
--
-- Dois acidentes possíveis, ambos irreversíveis pela própria tela:
--
--   a) o admin revoga o próprio acesso e fica de fora;
--   b) o admin se rebaixa a operador e o sistema fica SEM nenhum admin —
--      aí ninguém consegue aprovar ninguém, nunca mais, sem voltar ao painel.
--
-- A policy sozinha não pega isso, porque quem faz a ação É admin e portanto
-- passa na checagem. Precisa de trigger, que enxerga OLD e NEW.
-- -----------------------------------------------------------------------------
create or replace function public.tg_proteger_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admins_restantes integer;
begin
  -- (a) não deixa mexer no próprio acesso pela tela
  if old.user_id is not null and old.user_id = auth.uid() then
    if new.ativo is distinct from old.ativo then
      raise exception 'Você não pode revogar o próprio acesso.';
    end if;
    if new.papel is distinct from old.papel then
      raise exception 'Você não pode alterar o próprio papel.';
    end if;
  end if;

  -- (b) precisa sobrar pelo menos um administrador ativo
  if (old.papel = 'admin' and new.papel <> 'admin')
     or (old.papel = 'admin' and old.ativo and not new.ativo) then
    select count(*) into v_admins_restantes
      from public.usuarios_autorizados
     where papel = 'admin' and ativo = true and id <> old.id;

    if v_admins_restantes = 0 then
      raise exception 'O sistema precisa de pelo menos um administrador ativo.';
    end if;
  end if;

  return new;
end;
$$;

create trigger usuarios_autorizados_proteger_admin
  before update on public.usuarios_autorizados
  for each row execute function public.tg_proteger_admin();


-- =============================================================================
-- Depois disto, aprovar alguém é clicar em "Liberar acesso" no menu Acessos.
-- O SQL manual continua funcionando, mas deixa de ser necessário.
-- =============================================================================
