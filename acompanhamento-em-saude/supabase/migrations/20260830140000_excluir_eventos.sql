-- =============================================================================
-- 0006 — EXCLUSÃO REAL DE EVENTOS
--
-- POR QUE AQUI SIM E NO MÓDULO DE SAÚDE NÃO:
--
-- A proibição de hard delete existe por causa da LGPD e da natureza do dado:
-- prontuário de saúde é documento, e apagar prontuário é apagar prova. Nada
-- disso se aplica a um evento de prestação de contas — não há dado pessoal
-- sensível, não há obrigação legal de retenção, e um evento criado por engano
-- ficar para sempre na lista como "inativo" é só entulho.
--
-- As tabelas de saúde (idosos, registros) continuam SEM policy e SEM grant de
-- DELETE. Esta migration não toca nelas.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Cascata: apagar o evento apaga os lançamentos dele.
--
-- As FKs foram criadas com `on delete restrict`, que impede apagar um evento
-- que tenha lançamentos. Sem trocar isto, "excluir evento" só funcionaria em
-- evento vazio — e obrigaria a usuária a apagar item por item antes.
--
-- `cascade` é a escolha certa AQUI porque um lançamento não existe fora do seu
-- evento: não é informação independente que se perderia, é parte dele.
-- -----------------------------------------------------------------------------
alter table public.produtos_evento
  drop constraint produtos_evento_evento_id_fkey,
  add constraint produtos_evento_evento_id_fkey
    foreign key (evento_id) references public.eventos(id) on delete cascade;

alter table public.compras_lote_evento
  drop constraint compras_lote_evento_evento_id_fkey,
  add constraint compras_lote_evento_evento_id_fkey
    foreign key (evento_id) references public.eventos(id) on delete cascade;


-- -----------------------------------------------------------------------------
-- 2. Permissão de excluir — as DUAS camadas.
--
-- Lembrete: GRANT e RLS são independentes. Precisa dos dois, senão dá 42501.
-- -----------------------------------------------------------------------------
create policy eventos_delete on public.eventos
  for delete to authenticated
  using (public.is_autorizado());

grant delete on public.eventos to authenticated;

-- Lançamentos continuam SEM policy de DELETE: eles só somem junto com o
-- evento, pela cascata. Excluir um produto sozinho continua sendo soft delete
-- (ativo = false), como decidido na F11 — assim dá para conferir depois o que
-- foi lançado e retirado durante a organização do evento.


-- =============================================================================
-- CONFERÊNCIA
--
--   select tablename, cmd from pg_policies
--    where schemaname='public' and cmd='DELETE';
--   -- deve listar SOMENTE eventos.
--
--   select table_name from information_schema.role_table_grants
--    where table_schema='public' and privilege_type='DELETE';
--   -- deve listar SOMENTE eventos.
-- =============================================================================
