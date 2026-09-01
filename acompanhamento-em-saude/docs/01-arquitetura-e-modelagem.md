# Sistema de Acompanhamento de Idosos — Etapa 1: Modelagem, Arquitetura e Segurança

**Status:** decisões de modelagem (Q1–Q10) **fechadas** — ver §4.1. Pendentes: stack/infra (Q11–Q16), LGPD/operação (Q17–Q25) e as duas novas (Q26–Q27). Nenhum código de aplicação foi escrito ainda.
**Data:** 30/08/2026
**Stack acordada:** React + TypeScript + Tailwind + Supabase (Postgres + Auth) + React Hook Form + Zod. Deploy Vercel via GitHub.
**Referência:** "Ficha de Atendimento Farmacêutico" — associação comunitária / Associação de Bolsistas da Amazônia. Conferência campo a campo em §0.1.

> O SQL abaixo é **ilustrativo** — serve para você avaliar a modelagem, não para rodar ainda. Nada vai para o Supabase antes do seu OK.

---

## 0. Princípios que guiaram as decisões

Cinco regras que expliquem 90% das escolhas deste documento:

1. **Registro é um snapshot imutável.** Cada atendimento congela o que era verdade naquele dia. Isso empurra a modelagem para *desnormalização deliberada* — o oposto do que se ensina em banco de dados "acadêmico", e por um bom motivo (§1.3).
2. **Projeto pequeno, 2 usuárias, centenas de linhas.** Otimização prematura (índices exóticos, cache agressivo, normalização em 5 tabelas) custa complexidade e não compra performance nenhuma.
3. **Dado sensível de saúde (LGPD Art. 11).** Auditoria e ausência de hard delete não são "nice to have"; são o requisito que mais restringe o desenho.
4. **Segurança mora no banco, não no frontend.** O React é conveniência de interface. Quem barra acesso é o Postgres via RLS. Se alguém abrir o DevTools e chamar a API direto, a resposta tem que ser a mesma: negado.
5. **O código será estudado.** Entre "esperto" e "óbvio", escolhi óbvio.

---

## 0.1 Conferência contra a ficha física de referência

> Ficha recebida: **"FICHA DE ATENDIMENTO FARMACÊUTICO" — associação comunitária / Associação de Bolsistas da Amazônia.**

### Mapeamento campo a campo

| Campo na ficha | Onde está no modelo | Situação |
|---|---|---|
| Nome | `idosos.nome` | ✅ |
| Endereço | `idosos.endereco` | ✅ |
| DN (data de nascimento) | `idosos.data_nascimento` | ✅ |
| Gênero ( )F ( )M ( )outros | `idosos.genero` (enum) | ✅ |
| Telefone | `idosos.telefone` | ✅ |
| Problemas de saúde: Diabetes / Hipertensão / Asma / Dislipidemia / outro(s)___ | `registros.cond_*` + `cond_outros_desc` | ✅ |
| Tem alguém na família com: Diabetes / Hipertensão / Asma / outro(s)___ | `registros.hf_*` + `hf_outros_desc` | ✅ |
| Quem? ___ | `registros.hf_*_quem` | ⚠️ ver D1 |
| Faz uso de algum medicamento? Sim/Não | `registros.usa_medicamentos` | ✅ |
| Medicamentos em uso: ___ | `registros.medicamentos_quais` | ✅ |
| Você fuma? Sim/Não | `registros.fumante` | ✅ |
| Fumante passivo? Sim/Não | `registros.fumante_passivo` | ✅ |
| Data ___/___/___ (colunas da grade) | `registros.data_atendimento` | ✅ ver D3 |
| Pressão arterial (mmHg) | `pressao_sistolica` + `pressao_diastolica` | ⚠️ ver D2 |
| Freq. cardíaca (bpm) | `frequencia_cardiaca` | ✅ |
| Temperatura (°C) | `temperatura` | ✅ |
| Saturação (%) | `saturacao` | ✅ |
| Glicemia capilar (mg/dL) | `glicemia` | ✅ |
| OBS: | `registros.descricao` | ✅ ver D4 |
| Cabeçalho institucional (associação comunitária) | — | ⚠️ ver D5 |

**Nenhum campo de dado da ficha ficou de fora do modelo.** Os pontos marcados com ⚠️ são divergências deliberadas de estrutura, não omissões. Uma observação confirmada: **Dislipidemia aparece em "Problemas de saúde" mas não em "Tem alguém na família com"** — o modelo já reflete isso (existe `cond_dislipidemia`, não existe `hf_dislipidemia`).

**Conferido também contra a imagem da ficha**, que confirmou três coisas que a transcrição não deixava explícitas:

- O **"Quem?"** é um único campo que ocupa a linha inteira, abaixo de todo o bloco familiar — confirma D1.
- As **unidades vêm pré-impressas em cada célula** da grade (mmHg, bpm, °C, %, mg/dL) e batem exatamente com os tipos escolhidos no modelo.
- A grade tem coluna "Parâmetro" e sub-cabeçalho "Resultado" sob cada data — estrutura de planilha, sem campo extra de dado.

### O que existe no sistema e não existe na ficha

| No sistema | Na ficha | Observação |
|---|---|---|
| `created_by` (quem lançou o atendimento) | não existe | A ficha não tem campo de responsável nem assinatura. Ganho de auditoria, exigido pela LGPD |
| `glicemia_jejum` (Sim/Não/Não sei) | não existe | **Adição sua na Q8**, além do papel |
| Data por registro individual | data por coluna da grade | Equivalente |
| Consentimento do titular | não existe | Nada na ficha registra base legal — reforça a **Q17** |

### Divergências entre a ficha e o sistema (todas intencionais)

**D0 — Estrutura do documento: ficha "1 pessoa = 1 folha" vs. sistema "1 pessoa = N registros".**
Esta é a diferença conceitual mais importante, e ela é **requisito seu, mantido como pedido.**

Na ficha de papel, o cabeçalho (identidade, problemas de saúde, histórico familiar, medicamentos, tabagismo) é preenchido **uma única vez**, e só a grade de medições se repete por data. É um documento com uma parte estática e uma parte cronológica.

No sistema, condições de saúde, histórico familiar, medicamentos e tabagismo **pertencem a cada registro**, sendo pré-preenchidos a partir do último atendimento e livremente editáveis.

Por que a mudança faz sentido (e não é só capricho de software): na ficha de papel, quando alguém é diagnosticado com hipertensão dois anos depois, a única saída é rabiscar o cabeçalho — e a informação de que aquilo *não* existia nos atendimentos anteriores se perde para sempre. No sistema, cada registro guarda o que era verdade naquele dia; a evolução do quadro fica visível e nada é sobrescrito. O pré-preenchimento é o que preserva a comodidade do papel (não redigitar tudo) sem o custo (perder o histórico).

Consequência prática para quem vai usar: quem preenche vê os mesmos campos que já conhece, com as respostas anteriores já marcadas — a experiência se parece com "continuar a mesma ficha", mas o banco está guardando versões.

**D1 — "Quem?" único na ficha vs. um por condição no sistema.**
A ficha tem **um só** campo "Quem?" para todo o bloco de histórico familiar. O modelo proposto tem um campo por condição (`hf_diabetes_quem`, `hf_hipertensao_quem`, ...), o que é *mais* granular que o papel e casa com o exemplo que você deu no requisito ("Diabetes — mãe").
Vantagem: a associação condição↔pessoa fica explícita, sem depender da usuária escrever no formato certo.
Desvantagem: mais campos na tela.
*Alternativa:* um único `hf_quem text` fiel à ficha. **Decisão sua — Q4.**

**D2 — Pressão arterial: uma linha na ficha, duas colunas no banco.**
Na ficha, "Pressão arterial (mmHg)" é uma célula onde se escreve `120/80`. No banco, são dois `smallint`, conforme seu requisito — e a interface exibe `120/80 mmHg`. A digitação continua sendo em dois campos pequenos lado a lado, com a barra entre eles, então visualmente é quase igual ao papel.
Guardar como número é o que permite validar faixa, e é o que tornaria possível um gráfico de evolução no futuro; guardar `"120/80"` como texto travaria as duas coisas de forma irreversível.

**D3 — Grade de 7 colunas × 2 vs. registros ilimitados.**
A ficha comporta 14 atendimentos (duas grades de 7 datas); depois disso, começa-se uma folha nova e o vínculo entre as folhas é físico. No sistema não há limite e o histórico é contínuo. Nada a decidir — é ganho puro.

**D4 — "OBS:" por grade vs. observação por registro.**
Na ficha há um campo OBS por grade, ou seja, uma observação para até 7 atendimentos. No sistema, `descricao` é por atendimento. Mais granular e mais útil; sem perda.

**D5 — Cabeçalho institucional (associação comunitária / Associação de Bolsistas da Amazônia).**
Não é dado de paciente, então não vai para o banco. Mas deve aparecer na identidade visual do sistema (cabeçalho/sidebar) e, principalmente, **em uma eventual impressão de registro**, se um dia o documento impresso precisar ser reconhecido como da organização. Preciso saber se você tem o logo em arquivo — **Q24**.

---

## 1. Modelagem do banco

### 1.1 Visão geral

Quatro tabelas. Só isso.

```
auth.users (Supabase, gerenciada)
      │
      │ (email)
      ▼
usuarios_autorizados ──── lista branca; base de todas as políticas de RLS
      
idosos ──────1:N──────► registros
  (identidade,            (snapshot clínico de
   muda raramente)         cada atendimento)
```

**Por que separar `idosos` de `registros`:** identidade (nome, endereço, telefone) é *estado atual* — quando muda, o valor antigo não interessa. Dado clínico é *evento datado* — o valor antigo é exatamente o que interessa. São ciclos de vida opostos, então são tabelas diferentes. Foi a decisão estrutural mais importante e vem direto do seu requisito "registros nunca sobrescrevem os anteriores".

---

### 1.2 Tabela `usuarios_autorizados`

```sql
create table public.usuarios_autorizados (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  nome        text,
  user_id     uuid references auth.users(id) on delete set null, -- preenchido depois, opcional
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

create unique index usuarios_autorizados_email_uidx
  on public.usuarios_autorizados (lower(email));
```

**Justificativas**

- **Índice único em `lower(email)`**, não em `email`. Evita que `Maria@x.com` e `maria@x.com` coexistam como registros distintos — bug clássico e silencioso em lista branca.
- **`ativo boolean`** em vez de deletar a linha: revogar acesso vira `update`, com histórico preservado. Consistente com a política de soft delete do resto do sistema.
- **`user_id` opcional**: a conta no Supabase Auth é criada por você, manualmente, e pode ser criada *depois* da linha aqui. Guardar o vínculo permite, no futuro, migrar a checagem de RLS de e-mail para UUID (mais robusto, ver §3.2). Por ora é documental.
- **Não tem senha, não tem role.** Autenticação é 100% do Supabase Auth. Esta tabela responde só uma pergunta: "este e-mail pode ver os dados?".

---

### 1.3 Tabela `idosos`

```sql
create type public.genero_enum as enum ('Feminino', 'Masculino', 'Outros');

create table public.idosos (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null,
  data_nascimento   date,
  genero            public.genero_enum,
  telefone          text,
  endereco          text,
  ativo             boolean not null default true,
  created_by        uuid not null references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_by        uuid references auth.users(id),
  updated_at        timestamptz not null default now(),
  constraint idosos_nome_nao_vazio check (length(btrim(nome)) > 0),
  constraint idosos_nascimento_plausivel
    check (data_nascimento is null
           or (data_nascimento > '1900-01-01' and data_nascimento <= current_date))
);

create index idosos_ativo_nome_idx on public.idosos (ativo, nome);
```

**Justificativas**

- **`uuid` como PK, não `serial`/`bigint`.** Padrão do Supabase; o ID aparece na URL (`/idosos/:id`) e um inteiro sequencial expõe quantos idosos existem e permite adivinhar vizinhos por incremento. Com RLS ativo isso não é falha de segurança, mas é vazamento gratuito de informação. Custo: UUID ocupa 16 bytes e não ordena cronologicamente — irrelevante nesta escala.
- **`enum` para gênero, não `text` + `check`.** As três opções são fechadas e vieram de você. O enum documenta o domínio no próprio schema e o gerador de tipos do Supabase produz `'Feminino' | 'Masculino' | 'Outros'` no TypeScript automaticamente — o autocomplete passa a te proteger. Custo real: adicionar valor exige `alter type` (fácil); **remover** valor é chato. Se achar que a lista pode mudar, migro para `text` + `check`; me avise.
- **`telefone` como `text`, nunca número.** Zeros à esquerda, DDD, parênteses. Telefone é identificador, não quantidade. Regra geral: só é número se fizer sentido somar.
- **`endereco` como `text` único, não decomposto** em rua/número/bairro/CEP. Você não pediu busca ou filtro por endereço. Decompor agora criaria 5 campos de formulário e zero benefício.
- **`data_nascimento` nullable.** Nas fichas físicas esse campo pode vir em branco. Bloquear o cadastro por falta dele empurraria a usuária a inventar uma data — e dado inventado é pior que dado ausente. O `check` só barra o absurdo (nascimento no futuro, 1800).
- **Sem CPF.** LGPD, princípio da minimização (Art. 6º, III): não coletar o que não se usa. CPF não é necessário para nenhum fluxo descrito e aumentaria muito o dano de um eventual vazamento. Se você precisar de chave anti-duplicidade, sugiro `nome + data_nascimento` — ver pergunta Q7.
- **Índice `(ativo, nome)`**: a consulta padrão da tela de lista é "ativos, ordenados por nome". O índice composto atende filtro e ordenação de uma vez.
- **Busca por nome**: na Fase 1, `ilike '%termo%'` sem índice especial. Com algumas centenas de linhas o Postgres faz varredura sequencial em menos de um milissegundo — índice de trigrama aqui seria enfeite. Se um dia passar de alguns milhares de registros, aí sim: `pg_trgm` + função `unaccent` imutável (resolve também "José" vs "jose"). Documento a evolução, não a implemento agora.

---

### 1.4 Tabela `registros` — o coração do sistema

```sql
-- Três estados explícitos (Q8). Ver justificativa em §1.4.2.
create type public.jejum_enum as enum ('Sim', 'Nao', 'NaoSei');

create table public.registros (
  id                    uuid primary key default gen_random_uuid(),
  idoso_id              uuid not null references public.idosos(id) on delete restrict,
  data_atendimento      date not null default current_date,

  -- Condições de saúde (snapshot; pré-preenchido a partir do último registro)
  cond_diabetes         boolean not null default false,
  cond_hipertensao      boolean not null default false,
  cond_asma             boolean not null default false,
  cond_dislipidemia     boolean not null default false,
  cond_outros           boolean not null default false,
  cond_outros_desc      text,

  -- Histórico familiar (condição + quem na família)
  hf_diabetes           boolean not null default false,
  hf_diabetes_quem      text,
  hf_hipertensao        boolean not null default false,
  hf_hipertensao_quem   text,
  hf_asma               boolean not null default false,
  hf_asma_quem          text,
  hf_outros             boolean not null default false,
  hf_outros_desc        text,
  hf_outros_quem        text,

  -- Medicamentos
  usa_medicamentos      boolean,
  medicamentos_quais    text,

  -- Tabagismo
  fumante               boolean,
  fumante_passivo       boolean,

  -- Rastreamento em saúde (SEMPRE preenchido do zero a cada atendimento)
  pressao_sistolica     smallint,
  pressao_diastolica    smallint,
  frequencia_cardiaca   smallint,
  temperatura           numeric(4,1),
  saturacao             smallint,
  glicemia              smallint,
  glicemia_jejum        public.jejum_enum,        -- Q8

  descricao             text,

  ativo                 boolean not null default true,
  created_by            uuid not null references auth.users(id),
  created_at            timestamptz not null default now(),
  updated_by            uuid references auth.users(id),
  updated_at            timestamptz not null default now(),

  -- LIMITE DURO (Q10, nível 1). NÃO é interpretação clínica — só barra o
  -- fisicamente impossível. O nível 2 (aviso) vive só na interface, ver §1.6.
  constraint reg_sistolica_faixa   check (pressao_sistolica   is null or pressao_sistolica   between 40 and 300),
  constraint reg_diastolica_faixa  check (pressao_diastolica  is null or pressao_diastolica  between 20 and 200),
  constraint reg_fc_faixa          check (frequencia_cardiaca is null or frequencia_cardiaca between 20 and 250),
  constraint reg_temp_faixa        check (temperatura         is null or temperatura         between 30.0 and 45.0),
  constraint reg_saturacao_faixa   check (saturacao           is null or saturacao           between 50 and 100),
  constraint reg_glicemia_faixa    check (glicemia            is null or glicemia            between 10 and 900),
  constraint reg_data_nao_futura   check (data_atendimento <= current_date),

  -- Sistólica sempre maior que diastólica: fato físico, não avaliação clínica.
  -- Pega a inversão dos dois campos na digitação. NOVO — ver Q26.
  constraint reg_pressao_coerente
    check (pressao_sistolica is null or pressao_diastolica is null
           or pressao_sistolica > pressao_diastolica),

  -- "Em jejum?" só faz sentido se houve glicemia medida
  constraint reg_jejum_coerente
    check (glicemia_jejum is null or glicemia is not null),

  -- Coerência entre flag e texto
  constraint reg_cond_outros_coerente
    check (cond_outros = false or (cond_outros_desc is not null and length(btrim(cond_outros_desc)) > 0)),
  constraint reg_medicamentos_coerente
    check (usa_medicamentos is not true
           or (medicamentos_quais is not null and length(btrim(medicamentos_quais)) > 0))
);

-- Índice mestre: serve a lista do histórico E a busca do "último registro" para pré-preenchimento
create index registros_idoso_data_idx
  on public.registros (idoso_id, data_atendimento desc, created_at desc)
  where ativo = true;
```

#### 1.4.1 A decisão que você pediu para eu analisar: colunas vs. jsonb vs. tabelas separadas

Três caminhos eram viáveis para condições de saúde e histórico familiar:

| Critério | **A) Colunas booleanas** | **B) `jsonb` / `text[]`** | **C) Tabelas normalizadas** |
|---|---|---|---|
| Nº de tabelas | 2 | 2 | 5–6 |
| Salvar um registro | 1 `insert` | 1 `insert` | 1 `insert` + N `insert` em transação |
| Ler o histórico | `select` direto | `select` direto | `select` + 2 joins + agregação |
| Tipagem no TS | Automática e forte | `any` / tipo manual | Forte, mas com montagem manual |
| Zod | Trivial, schema plano | `useFieldArray`, schema aninhado | Aninhado + mapeamento |
| Validação no banco | `check` constraints | Nenhuma | FK garante integridade |
| Pré-preencher do último | Cópia direta de campos | Cópia direta | Buscar filhos e recriar |
| Adicionar 6ª condição | Migração (`add column`) | Nenhuma | 1 `insert` no catálogo |
| Consultar "todos com diabetes" | `where cond_diabetes` | Operador jsonb + índice GIN | Join |

**Recomendação: A (colunas booleanas), tanto para condições quanto para histórico familiar.**

O raciocínio:

- **A lista é fechada e curta.** Diabetes, Hipertensão, Asma, Dislipidemia + "Outros" com texto livre. O "Outros" já é a válvula de escape que a normalização (C) resolveria — e resolve com uma coluna, não com três tabelas.
- **Normalizar serve para evitar redundância em dados que mudam.** Aqui os dados **devem** ser redundantes: cada registro é um snapshot congelado. A tabela `registros` vai ter, sim, "Diabetes = true" repetido em 30 linhas do mesmo idoso — e isso é *correto*, é o histórico. A normalização não estaria eliminando duplicação; estaria adicionando joins para reconstruir uma foto que já era plana.
- **jsonb (B) troca segurança por flexibilidade que você não vai usar.** Perde-se `check`, tipagem gerada e legibilidade no editor de tabelas do Supabase (onde você vai depurar). Um typo `"Hipertensao"` vs `"Hipertensão"` passa silenciosamente. Só valeria a pena se a lista de condições fosse editável pelas usuárias — não é.
- **Custo assumido de A:** adicionar uma condição nova exige migração e mexer no formulário. Com 2 usuárias e uma lista clínica estável, isso vai acontecer raramente. Aceito conscientemente.

**Sobre o histórico familiar especificamente** — considerei um `jsonb` do tipo `[{"condicao":"Diabetes","parentesco":"mãe"}]`. Ficaria mais enxuto (1 coluna em vez de 9). Descartei porque exigiria `useFieldArray` do React Hook Form (lista dinâmica com adicionar/remover) logo no primeiro formulário do projeto, enquanto colunas pareadas dão uma UI muito mais previsível: **checkbox marcado revela um input "quem?"**. Menos cliques, menos estado, e o schema Zod continua plano — o que também torna o pré-preenchimento uma cópia de objeto trivial.

*Quando eu mudaria de ideia:* se você quiser registrar grau de parentesco estruturado (mãe/pai/avô), múltiplas pessoas por condição de forma separável, ou filtros do tipo "idosos com parente de primeiro grau diabético". Nenhum desses está no escopo. Se algum estiver, me avise agora — **Q4**.

#### 1.4.2 Demais justificativas de `registros`

- **`data_atendimento` separada de `created_at` — sugestão minha, precisa do seu OK (Q1).** `created_at` é quando a linha entrou no banco; `data_atendimento` é quando o atendimento aconteceu. São diferentes sempre que alguém digitar hoje uma ficha de ontem — e vão ser diferentes em massa se vocês transcreverem as fichas de papel antigas. Sem esse campo, o histórico ficaria com todas as datas iguais ao dia da digitação. `created_at` continua existindo, imutável, para auditoria.
- **`on delete restrict` na FK.** Reforço estrutural da proibição de hard delete: mesmo que alguém consiga apagar um idoso, o Postgres recusa enquanto houver registros. Cinto e suspensório junto com a ausência de política de DELETE no RLS (§3.4).
- **`smallint` para os sinais vitais** (range −32.768 a 32.767): cabe folgado e documenta a ordem de grandeza esperada. Um `integer` sugeriria que 2 milhões de bpm é concebível.
- **`numeric(4,1)` para temperatura, nunca `float`.** Ponto flutuante binário não representa 36,7 exatamente; `numeric` é decimal exato. Regra: medição que uma pessoa vai ler e conferir → `numeric`.
- **Pressão em duas colunas** (`sistolica`, `diastolica`), como você pediu. A string `"120/80 mmHg"` é montada na apresentação. Guardar números permite validar, comparar e — no futuro — gerar gráfico de evolução; guardar texto travaria tudo isso.
- **Todos os sinais vitais são `null`-áveis.** Nem toda visita mede tudo. `NULL` significa "não foi medido" e é semanticamente diferente de `0`. Nunca usar `0` como "vazio" aqui.
- **`boolean` nullable em `usa_medicamentos`, `fumante`, `fumante_passivo`** (diferente das condições, que são `not null default false`). Motivo: para condições, não marcar o checkbox = "não tem". Para essas três perguntas, existe a diferença real entre "respondeu Não" e "não foi perguntado" — típico ao transcrever ficha antiga incompleta. Se você preferir simplificar para sempre Sim/Não obrigatório, é uma linha de mudança — **Q5**.
- **`glicemia_jejum` é `enum` de 3 valores, não `boolean` nullable.** Tentador usar `true`/`false`/`NULL` e economizar um tipo. Não dá: a Q5 já estabeleceu a convenção `NULL = "não foi perguntado"`. Se "Não sei" também virasse `NULL`, duas coisas diferentes ficariam indistinguíveis — "a usuária perguntou e o idoso não soube responder" versus "ninguém perguntou". Com o enum, os quatro estados são explícitos: `Sim`, `Nao`, `NaoSei`, `NULL`. É o tipo de detalhe que parece pedantismo até o dia em que alguém precisa contar quantos exames foram em jejum.
- **`check` constraints são sanidade, não diagnóstico.** As faixas são propositalmente amplas: barram 1200 de sistólica (dedo escorregou) e deixam passar qualquer valor clinicamente plausível ou alarmante. O sistema **não** interpreta, não classifica, não alerta. Registra.
- **O índice parcial `where ativo = true`** cobre as duas únicas consultas quentes: listar o histórico do idoso e buscar o registro mais recente para pré-preencher (`order by data_atendimento desc, created_at desc limit 1`). O desempate por `created_at` importa quando há dois atendimentos no mesmo dia.

---

### 1.5 Triggers de integridade

```sql
-- 1. updated_at/updated_by automáticos + campos de criação imutáveis
create or replace function public.tg_auditoria()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  new.created_by := old.created_by;   -- não pode ser reescrito
  new.created_at := old.created_at;
  return new;
end $$;
```

**Por que trigger e não política de RLS:** uma política de `UPDATE` tem `USING` (avalia a linha antiga) e `WITH CHECK` (avalia a nova), mas não consegue comparar as duas na mesma expressão. Garantir "created_by não pode mudar" exige acesso simultâneo a `OLD` e `NEW` — território de trigger. Vale a pena saber disso: é uma limitação do RLS que pega muita gente.

Um segundo trigger, opcional, forçaria `created_by = auth.uid()` no `INSERT`, mas o `default auth.uid()` + `WITH CHECK` da política já cobrem (§3.4).

---

## 1.6 Validação em dois níveis (Q10)

### Onde cada nível mora

| Nível | Comportamento | Onde é implementado | Por quê ali |
|---|---|---|---|
| **Duro** — impossível | Bloqueia o salvamento | `check` no Postgres **+** Zod | Zod dá o erro na hora; o banco é a última linha de defesa, válida mesmo se alguém chamar a API direto |
| **Aviso** — incomum | Pede confirmação, salva mesmo assim | **Só na interface** | Um banco de dados não tem o conceito de "avisar". `check` só sabe aceitar ou recusar |

Esse é um bom exemplo de por que validação é duplicada de propósito: **Zod protege a experiência, `check` protege o dado.** Se um dia o Zod tiver um bug, o banco segura. Se o banco fosse a única barreira, a usuária só descobriria o erro depois de preencher a tela inteira e clicar em salvar.

### Faixas propostas

| Campo | Bloqueia fora de | Avisa fora de |
|---|---|---|
| Pressão sistólica | 40–300 | **70–220** |
| Pressão diastólica | 20–200 | **40–130** |
| Freq. cardíaca | 20–250 | **40–150** |
| Temperatura | 30,0–45,0 | **34,0–40,0** |
| Saturação | 50–100 | **85–100** |
| Glicemia | 10–900 | **40–400** |

### Um cuidado importante sobre as faixas de aviso

Aqui existe uma tensão real que vale explicitar antes de eu implementar, porque ela toca a regra de que **o sistema não faz avaliação clínica**.

Se a faixa de aviso for apertada demais, o aviso deixa de pegar erro de digitação e vira alerta clínico disfarçado. Exemplo concreto: um idoso hipertenso com sistólica 190 é um valor **real e esperado** para ele. Se o sistema disser "esse valor está fora do comum, confirma?" toda visita, ele está, na prática, sinalizando "pressão alta" — que é exatamente o julgamento que combinamos que o sistema não faz. Além disso, aviso que aparece sempre vira ruído e as usuárias passam a clicar "confirmar" no automático, o que anula a proteção justamente quando ela seria útil.

Por isso propus faixas de aviso **largas**. O critério que usei não é "clinicamente normal", é **"plausível de ter sido digitado errado"**: sistólica 70 e 220 são valores que acontecem de verdade; 25 ou 320 quase sempre são o dedo escorregando. A pergunta que a interface faz também importa — sugiro **"Confirma que o valor digitado está correto?"** em vez de "esse valor está fora do comum", porque a primeira pergunta é sobre digitação e a segunda insinua um juízo sobre a saúde da pessoa.

Vale sua mãe e sua tia olharem essas faixas com esse critério em mente — **Q27**.

### Comportamento na interface

1. Ao sair do campo (blur), valor em faixa de aviso ganha uma marca discreta em âmbar, com texto curto ao lado. Nunca em vermelho: vermelho é a cor do erro que bloqueia, e misturar as duas coisas ensina a usuária a ignorar as duas.
2. Ao clicar em salvar, se ainda houver avisos pendentes, um modal lista só os campos em questão ("Frequência cardíaca: 38 bpm") e pergunta se confirma. Confirmou, salva.
3. Erro duro nunca chega ao modal — bloqueia no próprio campo, em vermelho, e o botão salvar não prossegue.

**A confirmação não é gravada no banco.** Guardar "a usuária confirmou este valor atípico" exigiria uma coluna por campo e não muda nada no dado registrado, que é o que importa. Se você quiser essa rastreabilidade, me diga — é fácil, mas é escopo novo.

### Confirmação ao editar registro salvo (Q2)

Mesmo mecanismo de modal, gatilho diferente: qualquer edição de um registro já salvo pede *"Tem certeza que deseja salvar essa alteração no registro de 23/08/2026?"*, com a data do atendimento no texto para a usuária perceber se abriu a ficha errada.

Uma consequência que vale você saber, já que a decisão foi não versionar: a edição **substitui o valor definitivamente** e o valor anterior não é recuperável. O que fica registrado é `updated_at` e `updated_by` — ou seja, o sistema sabe dizer **que** o registro foi alterado, **quando** e **por quem**, mas não *o que* mudou. Para o volume e o contexto deste projeto isso é uma troca defensável, e a confirmação explícita reduz bem o risco de alteração acidental. Registro aqui só para a decisão ficar consciente e documentada; se um dia isso incomodar, dá para adicionar uma tabela `registros_historico` alimentada por trigger sem mexer em nada do que já existir.

---

## 2. Arquitetura do projeto React + TypeScript

### 2.1 Duas mudanças de stack que eu recomendo (com o motivo antes)

Você pediu explicitamente que eu justificasse antes. Nenhuma das duas é implementada sem seu OK.

#### (a) Vite em vez de Next.js — **recomendo Vite**

| | Vite (SPA) | Next.js |
|---|---|---|
| SEO / SSR | Não tem | Tem |
| Conceitos a aprender | Componentes, rotas | + Server/Client Components, route handlers, middleware, cache |
| Auth com Supabase | `supabase-js` no browser, direto | Sincronizar sessão via cookies entre server e client |
| Deploy Vercel | Build estático, funciona igual | Nativo |
| Velocidade de dev server | Muito rápida | Boa |

**Motivo:** Next.js resolve SEO, renderização no servidor e proteção de segredos no backend. Este sistema é **fechado atrás de login** — não há página pública para indexar, e não há segredo no servidor (a `anon key` é pública por design; quem protege é o RLS). Você pagaria toda a complexidade do App Router sem colher nenhum dos benefícios. Pior: a parte mais chata do Next.js com Supabase é justamente sincronizar sessão de auth entre servidor e cliente — bug garantido num projeto de aprendizado.

*Quando eu reconsideraria:* se algum dia surgir uma área pública (site institucional) ou necessidade de lógica com `service_role` no servidor.

#### (b) TanStack Query — **recomendo adicionar**

Sem ele, cada tela vira `useState` de dados + `useState` de loading + `useState` de erro + `useEffect` para buscar — repetido em cada página, e sem cache. Depois de salvar um registro, você teria que re-buscar manualmente a lista.

Com TanStack Query: `useQuery(['registros', idosoId], fetch)` devolve dados, loading e erro prontos; após um `useMutation`, um `invalidateQueries` atualiza todas as telas afetadas sozinho. Também dá de graça o cache que faz o botão "voltar" ser instantâneo.

**Custo honesto:** é mais uma biblioteca e mais um conceito (query keys, invalidação). Mas é a peça que mais elimina código repetitivo neste tipo de app, e é padrão de mercado — vale como aprendizado.

**Roteamento:** React Router v7. Padrão consolidado, integra bem com Vite, e o conceito de rota aninhada + `<Outlet>` resolve o layout com sidebar de forma limpa.

---

### 2.2 Estrutura de pastas

Organização **por funcionalidade** (feature-based), não por tipo de arquivo. Numa organização por tipo (`/components`, `/hooks`, `/services` com tudo junto), mexer em "registros" te obriga a abrir quatro pastas distantes. Por feature, tudo que é de registros está num lugar só — e a pasta `financeiro/` do futuro entra sem tocar em nada existente.

```
projeto/
├─ .env.local                    # NUNCA versionado
├─ .env.example                  # versionado, só os NOMES das variáveis
├─ supabase/
│  └─ migrations/                # SQL versionado no Git (schema é código)
│
└─ src/
   ├─ main.tsx
   ├─ App.tsx
   │
   ├─ app/
   │  ├─ router.tsx              # definição das rotas
   │  ├─ providers.tsx           # QueryClient, AuthProvider
   │  └─ ProtectedRoute.tsx      # guarda de rota (conveniência de UX)
   │
   ├─ lib/
   │  ├─ supabase.ts             # cliente único, exportado
   │  ├─ queryClient.ts
   │  ├─ format.ts               # formatarData, formatarPressao, formatarTelefone
   │  └─ cn.ts                   # merge de classes Tailwind
   │
   ├─ types/
   │  └─ database.types.ts       # GERADO: supabase gen types typescript
   │
   ├─ components/
   │  ├─ ui/                     # sem regra de negócio, reutilizável
   │  │  ├─ Button.tsx  Input.tsx  Select.tsx  Checkbox.tsx
   │  │  ├─ Textarea.tsx  Card.tsx  Modal.tsx  Badge.tsx
   │  │  ├─ Table.tsx  Spinner.tsx  EmptyState.tsx
   │  │  └─ form/                # ligação com React Hook Form
   │  │     ├─ FormField.tsx  FormSection.tsx  FormError.tsx
   │  └─ layout/
   │     ├─ AppLayout.tsx  Sidebar.tsx  Header.tsx  PageHeader.tsx
   │
   ├─ features/
   │  ├─ auth/
   │  │  ├─ api/          useSession.ts, useLogin.ts, useLogout.ts
   │  │  ├─ pages/        LoginPage.tsx, EsqueciSenhaPage.tsx, RedefinirSenhaPage.tsx
   │  │  └─ schemas/      login.schema.ts
   │  │
   │  ├─ idosos/
   │  │  ├─ api/          idosos.api.ts, useIdosos.ts, useIdoso.ts, useSalvarIdoso.ts
   │  │  ├─ components/   IdosoCard.tsx, IdososTable.tsx, BuscaIdosos.tsx, IdosoForm.tsx
   │  │  ├─ pages/        ListaIdososPage.tsx, PerfilIdosoPage.tsx, FormIdosoPage.tsx
   │  │  ├─ schemas/      idoso.schema.ts
   │  │  └─ types.ts
   │  │
   │  ├─ registros/
   │  │  ├─ api/          registros.api.ts, useRegistros.ts,
   │  │  │                useUltimoRegistro.ts, useCriarRegistro.ts
   │  │  ├─ components/   RegistroForm.tsx
   │  │  │                ├─ SecaoCondicoes.tsx
   │  │  │                ├─ SecaoHistoricoFamiliar.tsx
   │  │  │                ├─ SecaoMedicamentos.tsx
   │  │  │                ├─ SecaoTabagismo.tsx
   │  │  │                └─ SecaoRastreamento.tsx
   │  │  │                TimelineRegistros.tsx
   │  │  │                RegistroDetalhe.tsx     # visualização somente leitura
   │  │  │                BlocoUltimaColeta.tsx   # referência visual, não preenche
   │  │  ├─ pages/        NovoRegistroPage.tsx, DetalheRegistroPage.tsx
   │  │  ├─ schemas/      registro.schema.ts
   │  │  ├─ utils/        prefill.ts   # regra de o que copia e o que zera
   │  │  └─ types.ts
   │  │
   │  └─ financeiro/            # 🔒 FUTURO — só o esqueleto
   │     └─ pages/EmBrevePage.tsx
   │
   └─ hooks/
      ├─ useDebounce.ts          # busca por nome sem disparar a cada tecla
      └─ useMediaQuery.ts
```

**Pontos que valem explicação:**

- **`types/database.types.ts` é gerado, não escrito à mão.** O comando `supabase gen types typescript` lê o schema real e produz os tipos. Consequência prática: se você renomear uma coluna e esquecer de ajustar o frontend, o TypeScript acusa erro no build — antes de chegar em produção. É o maior ganho de usar TS com Supabase.
- **`supabase/migrations/` versionado.** Alterar schema clicando no painel funciona, mas vira uma mudança sem histórico e impossível de reproduzir. SQL no Git = você consegue responder "por que essa coluna existe?" seis meses depois.
- **`prefill.ts` isolado.** A regra "copia condições/histórico/medicamentos/tabagismo, zera sinais vitais e descrição" é a lógica mais sutil do sistema e a que mais dói se quebrar em silêncio. Isolada num arquivo puro (entra o último registro, sai o objeto de valores default), ela fica testável sem renderizar nada.
- **`ProtectedRoute` é UX, não segurança.** Ele só evita mostrar uma tela quebrada a quem não está logado. A segurança real está no RLS. Vale internalizar: *nenhuma* proteção de frontend é proteção.
- **`components/ui/` sem regra de negócio.** `Button` não sabe o que é um idoso. Essa separação é o que permite reusar em `financeiro/` depois sem arrastar dependências.

---

### 2.3 Rotas

```
/login                                   pública
/recuperar-senha                         pública
/redefinir-senha                         pública (link do e-mail)
─────────────────────────────────────── daqui pra baixo, protegido
/                                        → redireciona para /idosos
/idosos                                  lista + busca
/idosos/novo                             cadastro
/idosos/:id                              perfil + histórico de registros
/idosos/:id/editar                       edição do cadastro
/idosos/:id/registros/novo               formulário (com pré-preenchimento)
/idosos/:id/registros/:registroId        visualização do registro salvo
/financeiro                              🔒 placeholder ("Em breve")
*                                        404
```

Rotas de registro **aninhadas sob o idoso**. Isso torna o `idoso_id` sempre presente na URL — nenhum registro existe fora do contexto de uma pessoa, e a URL reflete isso. Também dá breadcrumb natural e link compartilhável para um atendimento específico.

---

### 2.4 Notas de interface

Alinhado ao que você pediu (sistema administrativo real, sem firula):

- **Lista de idosos:** tabela no desktop, cartões empilhados no mobile. Busca com debounce de ~300ms. Botão "+ Novo idoso" fixo no topo.
- **Perfil:** cabeçalho com identidade + idade calculada, botão "+ Adicionar registro" em destaque, e abaixo a timeline de registros (data, pressão, alguns sinais) — cada linha abre o registro exato como foi salvo.
- **Formulário de registro:** seções com títulos claros (Condições / Histórico familiar / Medicamentos / Tabagismo / Rastreamento / Observações). O **bloco "Última coleta"** aparece no topo da seção de Rastreamento, visualmente distinto (fundo cinza, borda, rótulo "somente referência"), com os campos vazios logo abaixo. A separação visual é o que impede a usuária de achar que aqueles números já foram lançados.
- **Registro salvo abre em modo leitura**, com layout idêntico ao formulário. Mesma disposição = reconhecimento imediato.
- **Tailwind:** paleta neutra (slate/zinc) + uma cor de ação. Sem gradientes, sem animação além de transições de 150ms em hover e foco.
- **Acessibilidade prática:** alvos de toque ≥ 44px, contraste alto, corpo de texto ≥ 16px. Não é enfeite — as usuárias podem estar usando o celular em pé, em atendimento.

---

## 3. Políticas de RLS (esboço)

### 3.1 Modelo de ameaça, em uma frase

A `anon key` fica no bundle JavaScript e **é pública por definição** — qualquer pessoa lê no DevTools. Ela não é uma senha; é um endereço. A única coisa entre um curioso e os dados de saúde é o RLS. Por isso: toda tabela com RLS ligado, sem exceção, e o teste final é conseguir provar que uma conta autenticada porém não autorizada recebe zero linhas.

### 3.2 Função central de autorização

```sql
create or replace function public.is_autorizado()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.usuarios_autorizados u
     where lower(u.email) = lower(auth.jwt() ->> 'email')
       and u.ativo = true
  );
$$;
```

**Por que assim:**

- **`security definer`**: a função roda com os privilégios de quem a criou, ignorando RLS ao ler `usuarios_autorizados`. Sem isso, a política de `usuarios_autorizados` chamaria a função que lê `usuarios_autorizados` → recursão infinita. É a armadilha número um de RLS no Supabase.
- **`set search_path = public`** é obrigatório junto com `security definer`. Sem fixar o search_path, um atacante com permissão de criar objetos poderia plantar uma tabela homônima em outro schema e sequestrar a função. É a mitigação padrão.
- **`stable`** permite ao Postgres avaliar uma vez por consulta em vez de uma vez por linha. Numa tabela com RLS, isso é a diferença entre uma checagem e mil.
- **Checagem por e-mail do JWT** em vez de `auth.uid()`: você cria as contas manualmente e conhece os e-mails antes dos UUIDs. O e-mail no JWT é assinado pelo Supabase e não é forjável pelo cliente. *Evolução futura:* preencher `user_id` e checar por UUID — imune a troca de e-mail. Fica documentado.

### 3.3 Ativação

```sql
alter table public.usuarios_autorizados enable row level security;
alter table public.idosos              enable row level security;
alter table public.registros           enable row level security;
```

Com RLS ligado e **nenhuma** política criada, o padrão é negar tudo. Ou seja: o estado seguro é o estado inicial. Cada política é uma abertura explícita.

### 3.4 Políticas

```sql
-- ============ usuarios_autorizados ============
-- Leitura: só quem já está autorizado. Sem INSERT/UPDATE/DELETE:
-- a lista branca só se altera pelo painel do Supabase (service_role ignora RLS).
create policy ua_select on public.usuarios_autorizados
  for select to authenticated
  using (public.is_autorizado());

-- ============ idosos ============
create policy idosos_select on public.idosos
  for select to authenticated
  using (public.is_autorizado());

create policy idosos_insert on public.idosos
  for insert to authenticated
  with check (public.is_autorizado() and created_by = auth.uid());

create policy idosos_update on public.idosos
  for update to authenticated
  using (public.is_autorizado())
  with check (public.is_autorizado());

-- SEM policy de DELETE → hard delete impossível para qualquer usuária.

-- ============ registros ============
create policy registros_select on public.registros
  for select to authenticated
  using (public.is_autorizado());

create policy registros_insert on public.registros
  for insert to authenticated
  with check (public.is_autorizado() and created_by = auth.uid());

create policy registros_update on public.registros
  for update to authenticated
  using (public.is_autorizado())
  with check (public.is_autorizado());

-- SEM policy de DELETE.
```

**Notas:**

- **`created_by = auth.uid()` no `WITH CHECK`**: impede que uma usuária insira um registro atribuído à outra. Auditoria só vale se for infalsificável.
- **Ausência de política de DELETE** é o que realmente proíbe o hard delete. "Excluir" na interface faz `update ... set ativo = false`. Combinado com o `on delete restrict` da FK, são duas barreiras independentes.
- **`to authenticated`** exclui explicitamente o papel `anon`. Requisito seu: nada sem sessão válida.
- **Cenário de teste obrigatório:** criar uma conta cujo e-mail **não** está em `usuarios_autorizados`, logar, e confirmar que todas as consultas voltam vazias (não erro — vazias; RLS filtra linhas, não bloqueia a chamada).

### 3.5 Configuração no painel do Supabase

- **Desligar cadastro público** (Authentication → Providers → Email → *Enable Signups* = OFF). É a primeira barreira; o `is_autorizado()` é a segunda.
- Contas criadas manualmente em Authentication → Users, com senha temporária.
- **Recuperação de senha por e-mail** habilitada, com a URL de redirect do domínio Vercel na allow-list.
- Considerar exigir confirmação de e-mail.

### 3.6 Segredos

| Variável | Onde | Pública? |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local` + Vercel | Sim, por design |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` + Vercel | Sim, por design |
| `service_role key` | **Em lugar nenhum deste projeto** | **NUNCA** |

Tudo com prefixo `VITE_` é embutido no bundle e visível para qualquer um. A `service_role key` **ignora o RLS por completo** — se vazar, todos os dados de saúde vazam junto. Ela não tem uso neste sistema; se algum dia precisar (script de importação), roda localmente, nunca no navegador nem em variável de ambiente da Vercel exposta ao cliente. `.env.local` no `.gitignore` desde o primeiro commit.

### 3.7 Ambiente de desenvolvimento

Conforme seu requisito: **dados fictícios em dev/teste**. Duas opções — pergunta **Q11**:

- **(a)** Dois projetos Supabase separados (dev e produção). Isolamento total, dado real nunca aparece em dev. Mais setup.
- **(b)** Um projeto só, com um script de seed de dados fictícios usado durante o desenvolvimento. Mais simples, mas exige disciplina.

Recomendo (a) se você pretende mexer no código com frequência depois do sistema em uso.

---

## 4. Perguntas e decisões que precisam do seu OK

### 4.0 Pendência bloqueante — **RESOLVIDA**

~~**Q0** — A ficha de atendimento farmacêutico não havia chegado.~~
**Recebida e conferida em §0.1.** Todos os campos de dado da ficha estão cobertos pelo modelo; as cinco divergências (D0–D5) são de estrutura e estão documentadas com justificativa. Restam duas decisões derivadas dela: **Q4** (campo "Quem?") e **Q24** (logo institucional).

### 4.1 Modelagem — ✅ FECHADO (respondido em 30/08/2026)

| # | Decisão | Impacto no modelo |
|---|---|---|
| **Q1** | ✅ Duas datas: `data_atendimento` (editável, ordena o histórico) e `created_at` (automática, interna) | Já no modelo |
| **Q2** | ✅ Edição sempre permitida, com modal de confirmação citando a data do registro. **Sem versionamento** — substitui de vez | §1.6; `updated_at`/`updated_by` registram que houve alteração |
| **Q3** | ✅ Soft delete: some da lista, acessível por link direto, marcado "inativo" | `ativo boolean` + ausência de policy DELETE |
| **Q4** | ✅ (a) Um "quem" por condição | `hf_*_quem` — mais granular que a ficha (D1) |
| **Q4b** | ✅ Checkbox + texto fixo, sem lista dinâmica | Colunas pareadas (§1.4.1) |
| **Q5** | ✅ Podem ficar vazios; `NULL` = "não perguntado", ≠ "Não" | `boolean` nullable |
| **Q6** | ✅ Só `nome` obrigatório | Demais colunas nullable |
| **Q7** | ✅ Avisar sem bloquear em nome parecido; sem CPF | Sem coluna nova; busca de similares antes de salvar |
| **Q8** | ✅ Campo "Em jejum? Sim / Não / Não sei" junto da glicemia | **Novo:** `glicemia_jejum public.jejum_enum` |
| **Q9** | ✅ Uma medição de cada tipo por atendimento | Colunas simples, sem tabela filha |
| **Q10** | ✅ Dois níveis: bloqueio (banco + Zod) e aviso (só interface) | **Nova §1.6** |

**Ajustes derivados, aplicados ao modelo:**

- `glicemia_jejum` como enum de 3 valores em vez de boolean nullable, para não colidir com a convenção da Q5 (justificativa em §1.4.2).
- `check` novo garantindo que "Em jejum?" só exista se houver glicemia medida.
- `check` novo garantindo sistólica > diastólica (**Q26**).
- Nova seção §1.6 detalhando os dois níveis de validação e as faixas de aviso.
- O campo "Em jejum?" entra na lista dos que **nunca** são pré-preenchidos — ele pertence ao bloco de medições, que sempre começa vazio.

### 4.2 Stack e infraestrutura

| # | Pergunta | Minha recomendação |
|---|---|---|
| **Q11** | Vite (SPA) em vez de Next.js? (§2.1a) | **Vite** |
| **Q12** | Adicionar TanStack Query? (§2.1b) | **Sim** |
| **Q13** | Projeto Supabase separado para dev, ou um só com seed fictícia? (§3.7) | Dois projetos |
| **Q14** | Nome do repositório e domínio/subdomínio na Vercel? | — |
| **Q15** | Fuso `America/Sao_Paulo` e datas em `dd/MM/yyyy` em toda a interface? | Sim |
| **Q16** | Migrações versionadas via Supabase CLI, ou você prefere aplicar SQL manualmente pelo painel? | CLI (schema versionado no Git) |

### 4.3 LGPD e operação

| # | Pergunta | Minha recomendação |
|---|---|---|
| **Q17** | Qual a **base legal** para tratar esses dados de saúde? (Art. 11 da LGPD — consentimento do titular ou tutela da saúde por profissional). Existe consentimento assinado nas fichas atuais? | Verificar; não é questão técnica, mas afeta o projeto |
| **Q18** | Os idosos/familiares serão informados de que os dados passaram do papel para um sistema online? | Recomendo sim |
| **Q19** | **Backup**: o plano gratuito do Supabase tem retenção limitada. Quer uma rotina de exportação periódica? | Sim — dado insubstituível |
| **Q20** | Migrar os dados históricos das fichas de papel / Excel, ou começar do zero e usar o sistema só daqui pra frente? Se migrar: quantas fichas, e em que formato está o Excel? | Precisa da sua resposta |
| **Q21** | Confirma **duas contas separadas** (uma para sua mãe, uma para sua tia)? Conta compartilhada tornaria `created_by` inútil. | Duas contas |
| **Q22** | Alguma das duas precisa ver/editar tudo enquanto a outra tem acesso restrito, ou ambas têm acesso idêntico? | Assumindo idêntico (sem papéis) |
| **Q23** | Impressão/exportação de um registro em PDF é necessária desde o começo, ou fica para depois? | Depois |
| **Q24** | Você tem o **logo da associação comunitária / Associação de Bolsistas da Amazônia** em arquivo (PNG/SVG)? Usaria no cabeçalho do sistema e numa futura impressão. (§0.1 D5) | Enviar se tiver |
| **Q25** | O sistema atende idosos de **um único grupo/projeto**, ou vai precisar separar por grupo/unidade no futuro? | Assumindo único — se não for, muda a modelagem |

### 4.5 Novas, derivadas das respostas de Q1–Q10

| # | Pergunta | Minha recomendação |
|---|---|---|
| **Q26** | Bloquear salvamento quando **sistólica ≤ diastólica**? É fato físico (não avaliação clínica) e pega a inversão dos dois campos na digitação | **Sim**, como bloqueio duro |
| **Q27** | As **faixas de aviso** de §1.6 estão adequadas? Critério proposto: "plausível de ter sido digitado errado", não "clinicamente anormal" — faixa apertada demais transforma o aviso em alerta clínico, que o sistema não deve dar (§1.6) | Revisar com sua mãe/tia usando esse critério |
| **Q28** | Texto do aviso: **"Confirma que o valor digitado está correto?"** (sobre digitação) em vez de "Esse valor está fora do comum" (insinua juízo clínico) | Primeira opção |

### 4.4 Coisas que eu **não** vou fazer sem você pedir

Registrando explicitamente para não haver invenção de requisito:

- Nenhum dashboard, gráfico, estatística ou indicador agregado.
- Nenhum alerta, classificação ou destaque baseado em valores medidos (pressão "alta", febre etc.) — **o sistema não interpreta dados clínicos**.
- Nenhum campo além dos que você listou.
- Nada de Financeiro/Eventos além da pasta e da rota placeholder.
- Nenhum upload de arquivo, foto ou anexo.
- Nenhuma notificação, e-mail automático ou integração externa.

---

## 5. Próximos passos, depois da sua aprovação

1. Você responde Q0–Q23 (pelo menos as de modelagem, Q1–Q10, que travam o schema).
2. Ajusto este documento com as decisões.
3. **Etapa 2** — SQL de migração: tabelas, enums, índices, triggers, função `is_autorizado()` e políticas de RLS, com comentário explicando cada bloco.
4. **Etapa 3** — Esqueleto do frontend: Vite + TS + Tailwind, cliente Supabase, roteamento, login, layout.
5. **Etapa 4** — CRUD de idosos (lista, busca, criar, editar).
6. **Etapa 5** — Registros: histórico, visualização, formulário com pré-preenchimento e bloco "Última coleta".
7. **Etapa 6** — Refino de responsividade, validações e testes com dados fictícios.
8. **Etapa 7** — Deploy na Vercel + checklist de segurança (incluindo o teste da conta não autorizada, §3.4).

Cada etapa é entregue e revisada antes da seguinte.
