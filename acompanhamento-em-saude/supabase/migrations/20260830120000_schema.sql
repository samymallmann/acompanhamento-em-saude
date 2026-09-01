-- =============================================================================
-- 0001 — SCHEMA
-- Sistema de Acompanhamento de Idosos — associação comunitária
--
-- Decisões e justificativas completas em docs/01-arquitetura-e-modelagem.md
-- Referências (Qn) apontam para o questionário fechado na seção 4 daquele doc.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TIPOS
-- -----------------------------------------------------------------------------

-- Lista fechada, veio da ficha física: ( )F ( )M ( )outros.
-- Enum em vez de text+check porque o gerador de tipos do Supabase transforma
-- isso em uma union type no TypeScript ('Feminino' | 'Masculino' | 'Outros'),
-- ou seja, o autocomplete do editor passa a impedir valor errado.
create type public.genero_enum as enum ('Feminino', 'Masculino', 'Outros');

-- Q8. Três estados explícitos + NULL = quatro situações distinguíveis:
--   'Sim'    -> estava em jejum
--   'Nao'    -> não estava
--   'NaoSei' -> foi perguntado, a pessoa não soube responder
--   NULL     -> não foi perguntado
-- Um boolean nullable colapsaria 'NaoSei' e NULL na mesma coisa, quebrando a
-- convenção estabelecida na Q5 (NULL sempre significa "não perguntado").
create type public.jejum_enum as enum ('Sim', 'Nao', 'NaoSei');


-- -----------------------------------------------------------------------------
-- usuarios_autorizados — lista branca de acesso
--
-- Esta tabela responde uma única pergunta: "este e-mail pode ver os dados?".
-- Ela NÃO guarda senha e NÃO autentica ninguém — isso é 100% do Supabase Auth.
-- É a base de todas as políticas de RLS (ver 0002_rls.sql).
-- -----------------------------------------------------------------------------
create table public.usuarios_autorizados (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  nome        text,
  -- Preenchido manualmente depois que a conta é criada no painel. Hoje é
  -- documental; no futuro permite migrar a checagem de RLS de e-mail para UUID.
  user_id     uuid references auth.users(id) on delete set null,
  -- Revogar acesso = update ativo=false. Nunca deletar a linha (mantém histórico).
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),

  constraint ua_email_valido check (position('@' in email) > 1)
);

-- Índice em lower(email), não em email: impede que 'Maria@x.com' e 'maria@x.com'
-- coexistam como duas linhas diferentes. Bug clássico e silencioso de lista branca.
create unique index usuarios_autorizados_email_uidx
  on public.usuarios_autorizados (lower(email));

comment on table public.usuarios_autorizados is
  'Lista branca de e-mails com permissão de acesso. Gerenciada apenas pelo painel do Supabase (service_role).';


-- -----------------------------------------------------------------------------
-- idosos — identidade básica
--
-- Separada de `registros` porque tem ciclo de vida oposto: identidade é ESTADO
-- ATUAL (quando o telefone muda, o antigo não interessa); dado clínico é EVENTO
-- DATADO (o valor antigo é exatamente o que interessa).
-- -----------------------------------------------------------------------------
create table public.idosos (
  id                uuid primary key default gen_random_uuid(),

  -- Q6: único campo obrigatório. Os demais podem faltar na ficha de papel, e
  -- bloquear o cadastro empurraria a usuária a inventar dado — pior que dado ausente.
  nome              text not null,
  data_nascimento   date,
  genero            public.genero_enum,
  -- text, nunca número: zeros à esquerda, DDD, parênteses. Telefone é
  -- identificador, não quantidade. (Regra: só é número se fizer sentido somar.)
  telefone          text,
  -- Campo único, não decomposto em rua/número/bairro/CEP: não há busca nem
  -- filtro por endereço no escopo, decompor criaria 5 campos e zero benefício.
  endereco          text,

  -- Q25: reservado. Hoje sempre NULL (um grupo só). Quando existir a tabela
  -- `grupos`, adiciona-se a FK sem precisar mexer nas linhas já gravadas.
  -- Sem FK agora porque a tabela alvo ainda não existe.
  grupo_id          uuid,

  -- Q3 / LGPD: hard delete é proibido. "Excluir" na interface faz ativo=false.
  ativo             boolean not null default true,

  -- Auditoria (LGPD, dado sensível de saúde)
  created_by        uuid not null default auth.uid() references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_by        uuid references auth.users(id),
  updated_at        timestamptz not null default now(),

  constraint idosos_nome_nao_vazio
    check (length(btrim(nome)) > 0),
  -- Barra só o absurdo (nascimento no futuro, século errado), não julga nada.
  constraint idosos_nascimento_plausivel
    check (data_nascimento is null
           or (data_nascimento > date '1900-01-01' and data_nascimento <= current_date))
);

-- A consulta padrão da tela de lista é "ativos, ordenados por nome".
-- Um índice composto atende filtro e ordenação de uma vez só.
create index idosos_ativo_nome_idx on public.idosos (ativo, nome);

-- Busca por nome: por ora `ilike '%termo%'` sem índice especial. Com algumas
-- centenas de linhas o Postgres varre a tabela em menos de 1ms — índice de
-- trigrama aqui seria enfeite. Se um dia passar de alguns milhares:
--   create extension pg_trgm;
--   create index idosos_nome_trgm_idx on public.idosos using gin (nome gin_trgm_ops);

comment on column public.idosos.grupo_id is
  'Reservado (Q25). Sempre NULL hoje. FK para futura tabela grupos.';


-- -----------------------------------------------------------------------------
-- registros — snapshot clínico de cada atendimento
--
-- Cada linha congela o que era verdade naquele dia. Um idoso terá "Diabetes =
-- true" repetido em dezenas de linhas — e isso é CORRETO: é o histórico, não
-- redundância a ser normalizada. Normalizar aqui adicionaria joins para
-- reconstruir uma foto que já era plana. Ver seção 1.4.1 do doc.
-- -----------------------------------------------------------------------------
create table public.registros (
  id                    uuid primary key default gen_random_uuid(),

  -- on delete restrict: reforço estrutural da proibição de hard delete.
  -- Mesmo que alguém tente apagar um idoso, o Postgres recusa se houver registros.
  idoso_id              uuid not null references public.idosos(id) on delete restrict,

  -- Q1: quando o atendimento ACONTECEU (editável, ordena o histórico).
  -- Diferente de created_at, que é quando a linha entrou no banco.
  data_atendimento      date not null default current_date,

  -- --- Condições de saúde ------------------------------------------------
  -- Pré-preenchidas a partir do último registro, editáveis (ver utils/prefill).
  cond_diabetes         boolean not null default false,
  cond_hipertensao      boolean not null default false,
  cond_asma             boolean not null default false,
  cond_dislipidemia     boolean not null default false,
  cond_outros           boolean not null default false,
  cond_outros_desc      text,

  -- --- Histórico familiar ------------------------------------------------
  -- Q4: um "quem" por condição (mais granular que a ficha, que tem um só campo).
  -- Nota: a ficha não tem Dislipidemia no bloco familiar — o modelo reflete isso.
  hf_diabetes           boolean not null default false,
  hf_diabetes_quem      text,
  hf_hipertensao        boolean not null default false,
  hf_hipertensao_quem   text,
  hf_asma               boolean not null default false,
  hf_asma_quem          text,
  hf_outros             boolean not null default false,
  hf_outros_desc        text,
  hf_outros_quem        text,

  -- --- Medicamentos e tabagismo ------------------------------------------
  -- Q5: nullable de propósito. NULL = "não foi perguntado", diferente de false
  -- = "respondeu Não". Típico ao transcrever ficha antiga incompleta.
  usa_medicamentos      boolean,
  medicamentos_quais    text,
  fumante               boolean,
  fumante_passivo       boolean,

  -- --- Rastreamento em saúde ---------------------------------------------
  -- SEMPRE começam vazios num registro novo. Nunca são copiados do anterior.
  -- Todos nullable: nem toda visita mede tudo, e NULL ("não medido") é
  -- semanticamente diferente de 0. Nunca usar 0 como "vazio" aqui.
  pressao_sistolica     smallint,
  pressao_diastolica    smallint,
  frequencia_cardiaca   smallint,
  -- numeric, nunca float: ponto flutuante binário não representa 36,7 exato.
  -- Regra: medição que uma pessoa vai ler e conferir -> numeric.
  temperatura           numeric(4,1),
  saturacao             smallint,
  glicemia              smallint,
  glicemia_jejum        public.jejum_enum,

  descricao             text,

  ativo                 boolean not null default true,

  created_by            uuid not null default auth.uid() references auth.users(id),
  created_at            timestamptz not null default now(),
  updated_by            uuid references auth.users(id),
  updated_at            timestamptz not null default now(),

  -- === Q10, NÍVEL 1: LIMITE DURO =========================================
  -- Barra o fisicamente impossível / erro grosseiro de digitação.
  -- NÃO é avaliação clínica: as faixas são propositalmente amplas e deixam
  -- passar qualquer valor plausível, inclusive alterado.
  -- O nível 2 (aviso, faixa mais estreita) vive só na interface — um banco de
  -- dados não tem o conceito de "avisar", check só sabe aceitar ou recusar.
  constraint reg_sistolica_faixa
    check (pressao_sistolica is null or pressao_sistolica between 40 and 300),
  constraint reg_diastolica_faixa
    check (pressao_diastolica is null or pressao_diastolica between 20 and 200),
  constraint reg_fc_faixa
    check (frequencia_cardiaca is null or frequencia_cardiaca between 20 and 250),
  constraint reg_temp_faixa
    check (temperatura is null or temperatura between 30.0 and 45.0),
  constraint reg_saturacao_faixa
    check (saturacao is null or saturacao between 50 and 100),
  constraint reg_glicemia_faixa
    check (glicemia is null or glicemia between 10 and 900),

  -- Q26: sistólica > diastólica é fato físico, não julgamento clínico.
  -- Pega a inversão dos dois campos na digitação (80/120).
  constraint reg_pressao_coerente
    check (pressao_sistolica is null or pressao_diastolica is null
           or pressao_sistolica > pressao_diastolica),

  constraint reg_data_nao_futura
    check (data_atendimento <= current_date),

  -- === Coerência entre marcação e texto ==================================
  constraint reg_cond_outros_coerente
    check (cond_outros = false
           or (cond_outros_desc is not null and length(btrim(cond_outros_desc)) > 0)),
  constraint reg_hf_outros_coerente
    check (hf_outros = false
           or (hf_outros_desc is not null and length(btrim(hf_outros_desc)) > 0)),
  constraint reg_medicamentos_coerente
    check (usa_medicamentos is not true
           or (medicamentos_quais is not null and length(btrim(medicamentos_quais)) > 0)),
  -- "Em jejum?" só faz sentido se houve glicemia medida.
  constraint reg_jejum_coerente
    check (glicemia_jejum is null or glicemia is not null)
);

-- Índice mestre. Cobre as duas únicas consultas quentes do sistema:
--   1. listar o histórico do idoso (ordenado por data, mais recente primeiro)
--   2. buscar o último registro para pré-preencher o formulário novo
-- O desempate por created_at importa quando há dois atendimentos no mesmo dia.
-- Parcial (where ativo) porque registro inativo nunca aparece nessas telas.
create index registros_idoso_data_idx
  on public.registros (idoso_id, data_atendimento desc, created_at desc)
  where ativo = true;

comment on table public.registros is
  'Snapshot imutável por atendimento. Um novo registro NUNCA sobrescreve os anteriores.';


-- -----------------------------------------------------------------------------
-- TRIGGER DE AUDITORIA
--
-- Por que trigger e não política de RLS: uma policy de UPDATE tem USING (linha
-- antiga) e WITH CHECK (linha nova), mas não consegue comparar as duas na mesma
-- expressão. Garantir "created_by não pode mudar" exige OLD e NEW juntos —
-- território de trigger. É uma limitação do RLS que pega muita gente.
-- -----------------------------------------------------------------------------
create or replace function public.tg_auditoria()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  -- Blindagem: campos de criação são imutáveis, venha o UPDATE de onde vier.
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger idosos_auditoria
  before update on public.idosos
  for each row execute function public.tg_auditoria();

create trigger registros_auditoria
  before update on public.registros
  for each row execute function public.tg_auditoria();
