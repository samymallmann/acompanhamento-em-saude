-- =============================================================================
-- 0007 — EXCLUSÃO REAL DE ATENDIDOS
--
-- ⚠️  ESTA MIGRATION REVERTE UMA DECISÃO DE PROJETO. LEIA ANTES DE APLICAR.
--
-- O requisito original era: "Proibido hard delete de idosos ou registros —
-- usar soft delete". A razão era LGPD e a natureza do dado: prontuário de
-- saúde é documento, e apagar prontuário é apagar prova.
--
-- Foi reaberto conscientemente para permitir limpar cadastros de TESTE, com
-- duas travas no lugar da proibição:
--   1. a interface exige digitar a palavra EXCLUIR para liberar o botão;
--   2. o aviso diz explicitamente quantos atendimentos serão destruídos.
--
-- O QUE ISSO SIGNIFICA NA PRÁTICA:
-- apagar um atendido apaga TODO o histórico clínico dele junto, sem
-- possibilidade de recuperação pelo sistema. A trilha de auditoria
-- (created_by/created_at) some junto — não existe registro de que aquela
-- pessoa existiu.
--
-- Continua valendo: "marcar como inativo" é o caminho normal. Excluir é para
-- dado de teste e cadastro criado por engano.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Cascata: apagar o atendido apaga os atendimentos dele.
--
-- A FK foi criada com `on delete restrict`, justamente para impedir isso. Sem
-- trocar, excluir só funcionaria em cadastro sem nenhum atendimento.
--
-- Detalhe importante do Postgres: a exclusão em cascata é executada pelo
-- próprio sistema e NÃO passa pelo RLS nem pelos GRANTs da tabela filha. Por
-- isso `registros` continua sem policy e sem grant de DELETE — ninguém
-- consegue apagar um atendimento isolado, só em conjunto com a pessoa toda.
-- -----------------------------------------------------------------------------
alter table public.registros
  drop constraint registros_idoso_id_fkey,
  add constraint registros_idoso_id_fkey
    foreign key (idoso_id) references public.idosos(id) on delete cascade;


-- -----------------------------------------------------------------------------
-- 2. Permissão de excluir — as duas camadas (GRANT + RLS).
-- -----------------------------------------------------------------------------
create policy idosos_delete on public.idosos
  for delete to authenticated
  using (public.is_autorizado());

grant delete on public.idosos to authenticated;


-- =============================================================================
-- CONFERÊNCIA — depois de aplicar, o DELETE deve existir só para estas duas:
--
--   select tablename from pg_policies
--    where schemaname='public' and cmd='DELETE' order by tablename;
--   -- esperado: eventos, idosos
--
--   select distinct table_name from information_schema.role_table_grants
--    where table_schema='public' and privilege_type='DELETE'
--      and grantee='authenticated';
--   -- esperado: eventos, idosos
--
-- `registros`, `produtos_evento` e `compras_lote_evento` continuam FORA das
-- duas listas: eles só somem junto com o pai, pela cascata.
-- =============================================================================
