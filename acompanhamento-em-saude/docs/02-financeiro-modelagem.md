# Módulo Financeiro / Eventos — Modelagem e Arquitetura

**Status:** proposta para aprovação. Nenhuma tabela criada, nenhum código escrito.
**Base:** reaproveita integralmente a infraestrutura do sistema de idosos — mesmo Supabase, mesma `usuarios_autorizados`, mesmo `is_autorizado()`, mesmo trigger `tg_auditoria`, mesma proibição de hard delete.

---

## 0. O que muda em relação ao módulo de saúde

Vale começar pela diferença conceitual, porque ela justifica quase todas as escolhas abaixo.

No módulo de saúde, **registro é snapshot imutável**: cada atendimento congela o que era verdade naquele dia, e por isso a edição é excepcional e pede confirmação.

No financeiro é o oposto: **um lançamento é um fato corrigível**. Se o vaso custou R$ 12,90 e foi digitado R$ 1,29, isso é erro de digitação, não mudança de realidade — corrigir é o comportamento certo, sem cerimônia. Foi exatamente o que você pediu no item 3 ("sem popup de confirmação especial"), e a modelagem acompanha: nada de versionamento, nada de modal ao editar produto.

O que **não** muda: soft delete, auditoria e RLS. Prestação de contas é documento; apagar linha de prestação de contas é apagar prova.

---

## 1. Modelagem

### 1.1 Visão geral

```
eventos ──┬──1:N──► produtos_evento       (nome, qtd, valor unitário)
          │
          └──1:N──► compras_lote_evento   (descrição, texto da nota, valor total)

Total do evento = Σ subtotais dos produtos + Σ valores das compras em lote
```

Três tabelas, como você propôs. Não há tabela de categorias, fornecedores ou formas de pagamento — nada disso está no escopo e inventar agora seria criar campo que ninguém preenche.

---

### 1.2 Tabela `eventos`

```sql
create table public.eventos (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  data_evento  date,

  ativo        boolean not null default true,
  created_by   uuid not null default auth.uid() references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id),
  updated_at   timestamptz not null default now(),

  constraint eventos_nome_nao_vazio check (length(btrim(nome)) > 0)
);

create index eventos_ativo_data_idx
  on public.eventos (ativo, data_evento desc nulls last, nome);
```

**Justificativas**

- **`data_evento` nullable e SEM restrição de data futura.** Aqui está uma diferença deliberada em relação a `registros.data_atendimento`, que proíbe data futura. Um atendimento futuro é impossível — não aconteceu ainda. Um evento futuro é normal: "Páscoa 2026" pode ser cadastrada em janeiro para ir acumulando gastos antes da data. Bloquear seria impedir o uso principal. **Confirmar em F9.**
- **Índice `(ativo, data_evento desc nulls last, nome)`**: a lista mostra eventos ativos, do mais recente para o mais antigo. `nulls last` põe eventos sem data no fim em vez do topo, que é o padrão do Postgres para `desc` e ficaria estranho.
- **Sem coluna de total.** Guardar o total gasto seria criar um número que envelhece: bastaria editar um produto para o total ficar mentindo até alguém recalcular. Ver §1.5.

---

### 1.3 Tabela `produtos_evento`

```sql
create table public.produtos_evento (
  id              uuid primary key default gen_random_uuid(),
  evento_id       uuid not null references public.eventos(id) on delete restrict,

  nome            text not null,
  quantidade      integer not null,
  valor_unitario  numeric(12,2) not null,

  -- Calculado pelo BANCO, sempre. Ver justificativa abaixo (F1).
  subtotal        numeric(12,2)
                  generated always as (quantidade * valor_unitario) stored,

  ativo           boolean not null default true,
  created_by      uuid not null default auth.uid() references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id),
  updated_at      timestamptz not null default now(),

  constraint produtos_nome_nao_vazio check (length(btrim(nome)) > 0),
  constraint produtos_quantidade_positiva check (quantidade > 0),
  constraint produtos_valor_nao_negativo check (valor_unitario >= 0)
);

create index produtos_evento_idx
  on public.produtos_evento (evento_id) where ativo = true;
```

#### `numeric(12,2)` para dinheiro — nunca `float`

É a regra mais importante desta modelagem. Ponto flutuante binário **não representa 0,10 exatamente**. Em qualquer linguagem, `0.1 + 0.2` dá `0.30000000000000004`. Numa prestação de contas, isso vira centavo que não fecha — e o pior tipo de bug: pequeno, silencioso e cumulativo.

`numeric` no Postgres é decimal exato. `(12,2)` significa 12 dígitos no total, 2 depois da vírgula: até R$ 9.999.999.999,99. Folgado de sobra, e o `,2` deixa registrado no schema que centavo é a menor unidade.

Mesma família de decisão do `numeric(4,1)` da temperatura, no módulo de saúde: valor que uma pessoa lê e confere não pode ser float.

> **Cuidado que isso NÃO resolve sozinho:** o JavaScript só tem float. Quando os valores chegam no navegador, somar `12.90 + 4.35` em JS pode devolver `17.249999999999996`. Por isso os totais são somados **no banco**, não no front — §1.5.

#### Subtotal como coluna `GENERATED` — sugestão minha, precisa de OK (F1)

Você pediu subtotal calculado na aplicação ou numa view, "não armazenado como coluna fixa — evita inconsistência se um valor for editado depois". Concordo integralmente com a preocupação. Proponho uma terceira opção que resolve melhor:

`generated always as (quantidade * valor_unitario) stored` é uma coluna que o **Postgres recalcula sozinho** a cada insert e a cada update. Não é uma coluna fixa: é impossível ela discordar de `quantidade × valor_unitario`, porque ninguém pode escrever nela — nem a aplicação, nem uma query manual, nem eu por engano. Tentar gravar dá erro.

Comparando as três:

| | Calcular no app | View | **Coluna GENERATED** |
|---|---|---|---|
| Pode ficar inconsistente | Não | Não | Não |
| Precisa lembrar de recalcular | Sim (em cada tela) | Não | Não |
| Aparece pronto no painel do Supabase | Não | Só na view | **Sim** |
| Dá para indexar / somar direto | Não | Indireto | **Sim** |
| Multiplicação exata (decimal) | Não (float do JS) | Sim | **Sim** |

O último ponto é o que me convence: a multiplicação acontece em `numeric`, no banco, exata. Se fosse no JS, `3 × 12.90` já entraria com risco de resíduo.

Se preferir seguir estritamente o que estava no seu texto, eu removo a coluna e calculo em JS — mas registro que seria uma escolha pior.

#### Demais justificativas

- **`quantidade integer` com `check > 0`**, como você especificou. **Atenção, F7:** isso impede lançar "1,5 kg de bala" ou "0,5 m de fita". Se a compra de mercado tiver itens por peso, eles não cabem como produto individual — teriam que ir numa compra em lote. Vale confirmar se isso é aceitável.
- **`valor_unitario >= 0`, não `> 0`.** Permite lançar brinde ou item doado com valor zero, que continua sendo um item da prestação de contas. **F10.**
- **Índice parcial `where ativo = true`**: a tela do evento só lista ativos.

---

### 1.4 Tabela `compras_lote_evento`

```sql
create table public.compras_lote_evento (
  id           uuid primary key default gen_random_uuid(),
  evento_id    uuid not null references public.eventos(id) on delete restrict,

  descricao    text not null,
  -- Transcrição da nota, colada pela usuária. O sistema NÃO interpreta este
  -- texto: não extrai itens, não soma valores, não valida formato.
  -- É comprovante em texto livre, nada mais.
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
```

**Justificativas**

- **`texto_nota` é `text` puro e nullable.** Sem limite de tamanho (o `text` do Postgres não tem), sem parsing, sem validação de formato. Você foi explícito: o sistema guarda como está. Isso também significa que **o valor total é sempre o que ela digitar** — o sistema nunca vai discordar do texto colado, nem avisar que "a soma da nota não bate". Fazer isso seria interpretar o texto, que é justamente o que não deve acontecer.
- **`descricao` obrigatória.** Sem ela, a lista de compras em lote viraria uma sequência de valores sem identificação. **F6.**
- **Por que não uma tabela única de "lançamentos" com um campo `tipo`.** Seria possível unificar produtos e lotes numa tabela só. Não vale: os dois têm campos diferentes (quantidade/valor unitário versus texto/valor total), e unificar obrigaria metade das colunas a ficarem nulas em cada linha, mais um `check` para garantir qual conjunto é válido em cada caso. Duas tabelas com propósitos claros são mais simples de ler e de validar.

---

### 1.5 Totais — view com `security_invoker`

```sql
create view public.vw_totais_evento
with (security_invoker = true)
as
select
  e.id as evento_id,
  coalesce(p.total, 0)  as total_produtos,
  coalesce(l.total, 0)  as total_lotes,
  coalesce(p.total, 0) + coalesce(l.total, 0) as total_geral
from public.eventos e
left join (
  select evento_id, sum(subtotal) as total
    from public.produtos_evento where ativo group by evento_id
) p on p.evento_id = e.id
left join (
  select evento_id, sum(valor_total) as total
    from public.compras_lote_evento where ativo group by evento_id
) l on l.evento_id = e.id;
```

**Por que somar no banco e não no JavaScript**

Já mencionado acima, mas é o ponto central: JS só tem ponto flutuante. Somar dez lançamentos em JS pode produzir `1234.5699999999997`, e arredondar na exibição esconde o problema sem resolvê-lo — dois totais calculados em ordens diferentes podem divergir no centavo. No Postgres, `sum()` sobre `numeric` é decimal exato.

**`with (security_invoker = true)` — e por que isso é obrigatório aqui**

Este é um detalhe de segurança que engana muita gente, e vale entender bem.

Por padrão, uma view no Postgres é executada **com as permissões de quem a criou**, não de quem a consulta. Ou seja: uma view comum sobre `produtos_evento` **passaria por cima do RLS** e devolveria dados de todo mundo, para qualquer pessoa autenticada. A view viraria um buraco na parede que construímos com tanto cuidado nas tabelas.

`security_invoker = true` (Postgres 15+, que é o do Supabase) inverte isso: a view roda com as permissões de **quem está consultando**, então o RLS das tabelas de baixo continua valendo normalmente.

Regra prática para guardar: **toda view criada neste projeto precisa de `security_invoker = true`.** Sem exceção. **F2** confirma se você quer a view mesmo.

---

### 1.6 O "by nome@email.com" — o problema que precisa de decisão (F3)

Você pediu para mostrar quem lançou cada item. As tabelas guardam `created_by`, que é o **UUID** do usuário — não o e-mail. E o e-mail mora em `auth.users`, uma tabela do sistema do Supabase que **o frontend não pode ler**: não há política de RLS que nos dê acesso a ela, e nem deveria haver.

Três caminhos:

| | Como funciona | Prós | Contras |
|---|---|---|---|
| **A) Vincular `user_id`** | Preencher `usuarios_autorizados.user_id` e ler o e-mail de lá | Usa coluna que **já existe**; sem duplicação; e-mail sempre atual | Exige um `update` de vinculação, uma vez |
| B) Gravar o e-mail junto | Coluna `created_by_email` em cada tabela | Simples | Duplica o dado; fica velho se o e-mail mudar |
| C) Função `security definer` | Função que lê `auth.users` | Flexível | Abre acesso indireto a uma tabela do sistema — evito |

**Recomendo A.** Quando desenhei `usuarios_autorizados`, deixei a coluna `user_id` justamente prevendo isso ("hoje é documental"). É a hora de usá-la:

```sql
-- Roda uma vez. Vincula cada e-mail autorizado à conta correspondente.
update public.usuarios_autorizados u
   set user_id = a.id
  from auth.users a
 where lower(a.email) = lower(u.email)
   and u.user_id is null;
```

Depois disso, o front lê `usuarios_autorizados` (que já tem policy de SELECT) e monta um mapa `user_id → nome/e-mail`. Quem não estiver vinculado aparece como "autor não identificado" em vez de quebrar.

**Bônus:** resolvido aqui, isso passa a valer também para o módulo de saúde, se um dia você quiser mostrar quem lançou cada atendimento.

---

### 1.7 RLS e permissões

Mesmo padrão das tabelas existentes, **incluindo os GRANTs** — que é a lição que já custou caro neste projeto:

```sql
alter table public.eventos             enable row level security;
alter table public.produtos_evento     enable row level security;
alter table public.compras_lote_evento enable row level security;

-- Para cada uma das três tabelas:
create policy X_select on public.X
  for select to authenticated using (public.is_autorizado());

create policy X_insert on public.X
  for insert to authenticated
  with check (public.is_autorizado() and created_by = auth.uid());

create policy X_update on public.X
  for update to authenticated
  using (public.is_autorizado()) with check (public.is_autorizado());

-- SEM policy de DELETE. "Excluir" na interface faz ativo = false.

grant select, insert, update on public.X to authenticated;
grant select                 on public.X to anon;
```

**Lembrete do erro que cometi na Etapa 2**, para não repetir: `GRANT` e `RLS` são camadas diferentes, avaliadas nessa ordem. Sem `GRANT`, a consulta é barrada com erro 42501 e nem chega ao RLS. Com `GRANT`, o RLS decide linha a linha, e nenhuma policy casando significa zero linhas, sem erro. O `anon` recebe SELECT de propósito: sem sessão ele não casa com nenhuma policy e recebe lista vazia, em vez de um erro de permissão confuso.

E o trigger de auditoria, reaproveitado sem alteração:

```sql
create trigger eventos_auditoria before update on public.eventos
  for each row execute function public.tg_auditoria();
-- idem para produtos_evento e compras_lote_evento
```

---

## 2. Arquitetura de pastas e rotas

### 2.1 Pastas

A pasta `src/features/financeiro/` já existe com o placeholder. Ela cresce seguindo o mesmo padrão de `idosos/` e `registros/` — nada de estrutura nova:

```
src/features/financeiro/
├─ api/
│  ├─ eventos.api.ts          listar, buscar, criar, atualizar, desativar
│  ├─ lancamentos.api.ts      produtos e compras em lote (escrita e leitura)
│  ├─ totais.api.ts           leitura da view vw_totais_evento
│  ├─ useEventos.ts
│  ├─ useLancamentos.ts
│  └─ useSalvarEvento.ts
├─ components/
│  ├─ EventoForm.tsx          nome + data
│  ├─ ListaProdutos.tsx       tabela/cartões + ações de editar e excluir
│  ├─ ListaComprasLote.tsx
│  ├─ ProdutoFormModal.tsx    formulário em modal (F8)
│  ├─ CompraLoteFormModal.tsx
│  ├─ ResumoTotais.tsx        o bloco de totais, sempre visível
│  └─ AutorEtiqueta.tsx       o "by fulano@email.com"
├─ pages/
│  ├─ ListaEventosPage.tsx
│  ├─ EventoPage.tsx          detalhe: lançamentos + totais
│  └─ FormEventoPage.tsx      novo / editar
├─ schemas/
│  ├─ evento.schema.ts
│  └─ lancamento.schema.ts
└─ types.ts
```

Peças reaproveitadas sem cópia: `Button`, `Input`, `Textarea`, `Modal`, `Alerta`, `Card`, `CabecalhoPagina`, `EstadoVazio`, `mensagemDeErro`, `formatarData` e o padrão de `useQuery`/`useMutation` com invalidação por prefixo.

**Uma peça nova, em `lib/`:** `formatarMoeda()` e `mascararMoeda()`, no mesmo arquivo `format.ts` do resto. Reaproveitam a ideia da máscara de telefone que acabamos de fazer — digitar `1290` mostra `R$ 12,90`, e o que vai para o banco é o número limpo. Sem isso, a usuária teria que acertar vírgula e ponto na mão, e "12.90" versus "12,90" viraria uma fonte constante de erro.

### 2.2 Rotas

```
/financeiro                    lista de eventos            (substitui o placeholder)
/financeiro/novo               cadastrar evento
/financeiro/:id                tela do evento — lançamentos e totais
/financeiro/:id/editar         editar nome e data do evento
```

**Por que produtos e compras em lote NÃO têm rota própria.** Eles são formulários curtos (3 campos e 3 campos) que só fazem sentido dentro de um evento. Abrir uma página nova para cadastrar "Vaso de flor, 2, R$ 12,90" custaria uma navegação de ida e outra de volta a cada item — e lançar vários itens seguidos é o uso principal desta tela. Em modal, ela lança, salva, o modal fecha, a lista e o total atualizam na hora, e ela lança o próximo.

É a mesma prioridade que guiou o resto do sistema: poucos cliques. Se preferir páginas separadas, é fácil trocar — **F8**.

### 2.3 Interface da tela do evento

```
┌──────────────────────────────────────────────┐
│ ← Voltar        Chá de bebê · 14/03/2026     │
│                              [Editar evento] │
├──────────────────────────────────────────────┤
│  Produtos      Compras em lote     TOTAL     │
│  R$ 248,50     R$ 412,30        R$ 660,80    │
├──────────────────────────────────────────────┤
│ Produtos individuais      [+ Adicionar]      │
│ ─────────────────────────────────────────    │
│ Vaso de flor    2 × R$ 12,90    R$ 25,80     │
│ by mae@email.com               [editar] [x]  │
│ …                                            │
├──────────────────────────────────────────────┤
│ Compras em lote           [+ Adicionar]      │
│ ─────────────────────────────────────────    │
│ Mercado Extra — lembrancinhas   R$ 412,30    │
│ by mae@email.com               [editar] [x]  │
│ ▸ ver texto da nota                          │
└──────────────────────────────────────────────┘
```

- Totais no topo, sempre visíveis, sem precisar rolar.
- Duas seções empilhadas, não abas — abas esconderiam metade da prestação de contas e exigiriam um clique a mais para conferir o total.
- O texto da nota fica recolhido (`▸ ver texto da nota`), porque uma transcrição de nota fiscal ocupa muitas linhas e empurraria tudo para baixo.
- No celular, as linhas viram cartões empilhados, como na lista de idosos.
- Sem gráfico, sem dashboard, como você pediu.

---

## 3. Decisões — ✅ TODAS FECHADAS

| # | Decisão | Efeito |
|---|---|---|
| **F1** | ✅ Subtotal calculado pelo banco | Coluna `generated always as … stored` |
| **F2** | ✅ Totais somados no banco | View `vw_totais_evento` com `security_invoker` |
| **F3** | ✅ Autor automático via `usuarios_autorizados.user_id` | Migration de vinculação, rodada uma vez |
| **F5** | ✅ Texto da nota opcional | `texto_nota` nullable |
| **F6** | ✅ Descrição da compra em lote obrigatória | `not null` + check de não vazio |
| **F7** | ✅ Quantidade inteira; peso vai no nome ou em lote | `integer check > 0` |
| **F8** | ✅ Formulários em modal | Sem rota própria para lançamentos |
| **F9** | ✅ Data do evento editável e podendo ser futura | Sem check de data |
| **F10** | ✅ Valor pode ser zero | `check >= 0` |
| **F11** | ✅ Confirmação antes de excluir lançamento | Modal simples |
| **F12** | ✅ Eventos do mais novo ao mais antigo, sem data no fim | `order by data_evento desc nulls last` |
| **F13** | ✅ Evento inativo acessível por link direto | Mesmo padrão do idoso |
| **F14** | ✅ 2 eventos fictícios no seed | Adicionados ao `seed.sql` |

**Requisito de interface adicional:** a etiqueta de autor ("by fulano@email.com")
fica no **canto inferior direito** da caixa de cada produto e de cada compra em
lote. É preenchida sozinha pelo sistema — a usuária nunca digita nada.

### Registro das perguntas originais

| # | Pergunta | Minha recomendação |
|---|---|---|
| **F1** | Subtotal como coluna `GENERATED` do Postgres, em vez de calcular no app? É recalculada sozinha e impossível de ficar inconsistente (§1.3) | **Sim** |
| **F2** | Criar a view `vw_totais_evento` para somar no banco, em vez de somar em JavaScript? Evita erro de centavo por ponto flutuante (§1.5) | **Sim** |
| **F3** | Para o "by fulano@email.com": vincular `usuarios_autorizados.user_id` às contas e ler o e-mail de lá (§1.6)? | **Sim, opção A** |
| **F7** | Quantidade só aceita inteiro, como você pediu. Isso impede lançar "1,5 kg". Tudo bem, ou precisa aceitar fracionado? | Manter inteiro; peso vai em compra em lote |
| **F9** | Evento pode ter data **futura**? (diferente do atendimento, que não pode) | **Sim** — cadastrar antes do evento é o uso normal |
| **F10** | Produto pode ter valor **zero** (brinde, doação)? | **Sim** |
| **F5** | O texto da nota é **opcional**? (dá para lançar uma compra em lote só com descrição e valor) | **Sim, opcional** |
| **F6** | A descrição da compra em lote é **obrigatória**? | **Sim** |

### Travam a interface

| # | Pergunta | Minha recomendação |
|---|---|---|
| **F8** | Formulário de produto e de compra em lote em **modal** dentro do evento, ou em página separada? (§2.2) | **Modal** — menos cliques ao lançar vários itens |
| **F11** | Excluir um lançamento pede confirmação, ou exclui direto? É soft delete, dá para reverter no banco, mas não pela tela | **Pedir confirmação simples** |
| **F12** | Lista de eventos ordenada por **data mais recente primeiro**, com os sem data no fim? | Sim |
| **F13** | Um evento inativo deve continuar acessível por link direto, como acontece com idoso inativo? | Sim, mesmo padrão |
| **F14** | Quer **dados fictícios** de financeiro no `seed.sql`, para testar as telas? | Sim, 2 eventos de exemplo |

### Não vou fazer sem você pedir

Registrando para não haver invenção de requisito:

- Nenhuma exportação para Excel ou PDF, nenhum relatório, nenhum filtro por período.
- Nenhum total geral somando todos os eventos.
- Nenhuma leitura, interpretação ou validação do texto da nota colado.
- Nenhuma categoria, fornecedor, forma de pagamento ou orçamento previsto.
- Nenhum gráfico.

---

## 4. Como fica o plano de execução

1. Você responde F1–F14.
2. **Etapa F1** — migration com as três tabelas, view, RLS, grants, triggers e o `update` de vinculação do `user_id`. Validada num Postgres real antes de você rodar, como na Etapa 2.
3. **Etapa F2** — telas: lista de eventos, cadastro, tela do evento com os dois tipos de lançamento e os totais.
4. **Etapa F3** — verificação: build, lint e testes das regras novas (cálculo de subtotal, soma de totais, máscara de moeda).

O placeholder atual de `/financeiro` continua no ar até a Etapa F2 substituí-lo.
