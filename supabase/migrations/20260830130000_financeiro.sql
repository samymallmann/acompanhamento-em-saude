-- =============================================================================
-- 0004 — MÓDULO FINANCEIRO / EVENTOS
--
-- Decisões e justificativas em docs/02-financeiro-modelagem.md (F1–F14).
-- Reaproveita a infraestrutura já existente: is_autorizado(), tg_auditoria(),
-- usuarios_autorizados, proibição de hard delete.
--
-- DIFERENÇA CONCEITUAL EM RELAÇÃO AO MÓDULO DE SAÚDE:
-- lá, um registro é snapshot imutável e editar é excepcional. Aqui, um
-- lançamento é um fato corrigível — errou o preço, corrige. Por isso não há
-- confirmação especial de edição nem versionamento. O que continua igual:
-- soft delete, auditoria e RLS, porque prestação de contas é documento.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- eventos
-- -----------------------------------------------------------------------------
create table public.eventos (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,

  -- F9: SEM check de data futura, ao contrário de registros.data_atendimento.
  -- Um atendimento futuro é impossível; um evento futuro é o caso normal —
  -- cadastrar "Páscoa 2026" em janeiro e ir acumulando gastos até lá.
  data_evento  date,

  ativo        boolean not null default true,
  created_by   uuid not null default auth.uid() references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id),
  updated_at   timestamptz not null default now(),

  constraint eventos_nome_nao_vazio check (length(btrim(nome)) > 0)
);

-- F12: lista mostra ativos, do mais recente ao mais antigo.
-- `nulls last` porque o padrão do Postgres em `desc` é jogar NULL para o topo,
-- e evento sem data no começo da lista ficaria estranho.
create index eventos_ativo_data_idx
  on public.eventos (ativo, data_evento desc nulls last, nome);

comment on table public.eventos is
  'Agrupa os gastos de um evento para prestação de contas. Sem coluna de total: ver vw_totais_evento.';


-- -----------------------------------------------------------------------------
-- produtos_evento — itens lançados um a um
-- -----------------------------------------------------------------------------
create table public.produtos_evento (
  id              uuid primary key default gen_random_uuid(),
  evento_id       uuid not null references public.eventos(id) on delete restrict,

  nome            text not null,

  -- F7: inteiro, como especificado. Item por peso ("2 kg de batata") vai com
  -- a unidade no próprio nome e quantidade 1, ou entra numa compra em lote.
  quantidade      integer not null,

  -- DINHEIRO É `numeric`, NUNCA `float`.
  -- Ponto flutuante binário não representa 0,10 exatamente: em qualquer
  -- linguagem, 0.1 + 0.2 dá 0.30000000000000004. Numa prestação de contas isso
  -- vira centavo que não fecha — erro pequeno, silencioso e cumulativo.
  -- `numeric` no Postgres é decimal exato. (12,2) = até R$ 9.999.999.999,99.
  valor_unitario  numeric(12,2) not null,

  -- F1: calculado pelo BANCO, sempre.
  -- `generated always as ... stored` é recalculado pelo Postgres a cada insert
  -- e a cada update. Não é uma coluna que pode ficar velha: é IMPOSSÍVEL ela
  -- discordar de quantidade × valor_unitario, porque ninguém consegue escrever
  -- nela — tentar gravar dá erro. E a multiplicação acontece em `numeric`,
  -- exata, em vez de no float do JavaScript.
  subtotal        numeric(12,2)
                  generated always as (quantidade * valor_unitario) stored,

  ativo           boolean not null default true,
  created_by      uuid not null default auth.uid() references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id),
  updated_at      timestamptz not null default now(),

  constraint produtos_nome_nao_vazio check (length(btrim(nome)) > 0),
  constraint produtos_quantidade_positiva check (quantidade > 0),
  -- F10: >= 0, não > 0. Brinde ou item doado tem custo zero e continua sendo
  -- um item da prestação de contas.
  constraint produtos_valor_nao_negativo check (valor_unitario >= 0)
);

create index produtos_evento_idx
  on public.produtos_evento (evento_id) where ativo = true;


-- -----------------------------------------------------------------------------
-- compras_lote_evento — uma compra inteira, sem detalhar item por item
-- -----------------------------------------------------------------------------
create table public.compras_lote_evento (
  id           uuid primary key default gen_random_uuid(),
  evento_id    uuid not null references public.eventos(id) on delete restrict,

  -- F6: obrigatória. Sem ela a lista viraria uma sequência de valores sem
  -- identificação, inútil para conferir depois.
  descricao    text not null,

  -- F5: opcional. Transcrição da nota, colada pela usuária.
  -- O sistema NÃO interpreta este texto: não extrai itens, não soma valores,
  -- não valida formato, não compara com valor_total. É comprovante em texto
  -- livre. Consequência assumida: se o texto e o valor discordarem, o sistema
  -- não avisa — avisar exigiria interpretar o texto, que é justamente o que
  -- não deve acontecer.
  texto_nota   text,

  valor_total  numeric(12,2) not null,

  ativo        boolean not null default true,
  created_by   uuid not null default auth.uid() references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id),
  updated_at   timestamptz not null default now(),

  constraint lote_descricao_nao_vazia check (length(btrim(descricao)) > 0),
  constraint lote_valor_nao_negativo check (valor_total >= 0)
);

create index compras_lote_evento_idx
  on public.compras_lote_evento (evento_id) where ativo = true;


-- -----------------------------------------------------------------------------
-- TRIGGERS DE AUDITORIA — reaproveitados sem alteração
-- -----------------------------------------------------------------------------
create trigger eventos_auditoria
  before update on public.eventos
  for each row execute function public.tg_auditoria();

create trigger produtos_evento_auditoria
  before update on public.produtos_evento
  for each row execute function public.tg_auditoria();

create trigger compras_lote_evento_auditoria
  before update on public.compras_lote_evento
  for each row execute function public.tg_auditoria();


-- -----------------------------------------------------------------------------
-- vw_totais_evento — F2: soma no banco, não no navegador
--
-- ⚠️  `with (security_invoker = true)` É OBRIGATÓRIO.
--
-- Por padrão, uma view no Postgres executa com as permissões de QUEM A CRIOU,
-- não de quem consulta. Uma view comum sobre estas tabelas passaria POR CIMA
-- do RLS e devolveria tudo para qualquer pessoa autenticada — um buraco na
-- parede que construímos com tanto cuidado nas tabelas.
--
-- security_invoker inverte isso: a view roda com as permissões de quem está
-- consultando, e o RLS das tabelas de baixo continua valendo.
--
-- REGRA PARA ESTE PROJETO: toda view criada aqui precisa disto. Sem exceção.
-- -----------------------------------------------------------------------------
create view public.vw_totais_evento
with (security_invoker = true)
as
select
  e.id                                        as evento_id,
  coalesce(p.total, 0)::numeric(12,2)         as total_produtos,
  coalesce(l.total, 0)::numeric(12,2)         as total_lotes,
  (coalesce(p.total, 0) + coalesce(l.total, 0))::numeric(12,2) as total_geral
from public.eventos e
left join (
  select evento_id, sum(subtotal) as total
    from public.produtos_evento
   where ativo
   group by evento_id
) p on p.evento_id = e.id
left join (
  select evento_id, sum(valor_total) as total
    from public.compras_lote_evento
   where ativo
   group by evento_id
) l on l.evento_id = e.id;

comment on view public.vw_totais_evento is
  'Totais por evento, somados em numeric (exato). Nunca somar dinheiro em JavaScript.';


-- -----------------------------------------------------------------------------
-- RLS — mesmo padrão das tabelas de saúde
-- -----------------------------------------------------------------------------
alter table public.eventos             enable row level security;
alter table public.produtos_evento     enable row level security;
alter table public.compras_lote_evento enable row level security;

-- eventos
create policy eventos_select on public.eventos
  for select to authenticated using (public.is_autorizado());
create policy eventos_insert on public.eventos
  for insert to authenticated
  with check (public.is_autorizado() and created_by = auth.uid());
create policy eventos_update on public.eventos
  for update to authenticated
  using (public.is_autorizado()) with check (public.is_autorizado());

-- produtos_evento
create policy produtos_select on public.produtos_evento
  for select to authenticated using (public.is_autorizado());
create policy produtos_insert on public.produtos_evento
  for insert to authenticated
  with check (public.is_autorizado() and created_by = auth.uid());
create policy produtos_update on public.produtos_evento
  for update to authenticated
  using (public.is_autorizado()) with check (public.is_autorizado());

-- compras_lote_evento
create policy lote_select on public.compras_lote_evento
  for select to authenticated using (public.is_autorizado());
create policy lote_insert on public.compras_lote_evento
  for insert to authenticated
  with check (public.is_autorizado() and created_by = auth.uid());
create policy lote_update on public.compras_lote_evento
  for update to authenticated
  using (public.is_autorizado()) with check (public.is_autorizado());

-- SEM policy de DELETE em nenhuma das três. "Excluir" faz ativo = false.


-- -----------------------------------------------------------------------------
-- GRANTS — camada separada do RLS
--
-- Lembrete do erro cometido na Etapa 2 deste projeto: GRANT e RLS são camadas
-- diferentes, avaliadas nesta ordem. Sem GRANT, a consulta é barrada com erro
-- 42501 e nem chega ao RLS. Com GRANT, o RLS decide linha a linha, e nenhuma
-- policy casando significa zero linhas, sem erro.
--
-- DELETE não é concedido a ninguém: somado à ausência de policy de DELETE, a
-- proibição de hard delete fica registrada nas duas camadas.
-- -----------------------------------------------------------------------------
grant select, insert, update on public.eventos             to authenticated;
grant select, insert, update on public.produtos_evento     to authenticated;
grant select, insert, update on public.compras_lote_evento to authenticated;
grant select                 on public.vw_totais_evento    to authenticated;

grant select on public.eventos             to anon;
grant select on public.produtos_evento     to anon;
grant select on public.compras_lote_evento to anon;
grant select on public.vw_totais_evento    to anon;
