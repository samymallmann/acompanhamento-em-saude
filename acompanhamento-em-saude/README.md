# Acompanhamento em Saúde

Sistema web para o atendimento farmacêutico a idosos de uma associação
comunitária. Substitui as fichas de papel e a planilha de Excel que eram usadas
antes.

> **Sobre este repositório.** É uma cópia pública do código, para portfólio. O
> sistema está em produção com dados reais de saúde, então o endereço e as
> credenciais não estão aqui, e os nomes que aparecem em exemplos, testes e
> dados de teste são fictícios. Rodando localmente, com um projeto Supabase
> seu, ele funciona por inteiro. Sobre reaproveitar o código, veja
> [Direitos de uso](#direitos-de-uso) no fim.

A interface chama as pessoas atendidas de "atendidos". No banco e no código a
tabela ainda se chama `idosos`, porque renomear tabela em produção dá mais
trabalho do que valor.

## O que o sistema faz

Cadastro das pessoas atendidas e histórico de atendimentos, com pressão,
frequência cardíaca, temperatura, saturação, glicemia, condições de saúde,
histórico familiar e medicamentos. Cada atendimento é uma foto do dia: um
registro novo nunca sobrescreve os anteriores.

Tem também um módulo financeiro para os gastos de cada evento, com produtos
comprados individualmente e compras em lote.

Quem entra no sistema precisa de aprovação. Qualquer pessoa cria a conta, mas
ela nasce sem acesso e não vê nada até um administrador liberar na aba Acessos.

E tem a ficha de campo, que é a parte mais incomum daqui. Os eventos acontecem
em lugar sem sinal de internet, então o sistema gera um arquivo HTML que roda
sozinho no computador ou no celular, sem rede. A pessoa anota o dia inteiro,
exporta um texto no fim, e esse texto volta para o sistema pela tela de
importação.

## Stack

React 19 com TypeScript, Vite, Tailwind 4, React Router 7, TanStack Query,
React Hook Form com Zod. Banco e login no Supabase. Publicado na Vercel.

Escolhi Vite e não Next porque o sistema é fechado, sem página pública, sem SEO
e sem necessidade de renderizar no servidor. Next resolveria problemas que este
projeto não tem.

Cuidado ao procurar tutorial: Tailwind 4 e Zod 4 mudaram bastante em relação às
versões 3, que é o que quase todo material antigo ensina. As diferenças estão
comentadas em `vite.config.ts` e `src/features/auth/schemas/auth.schema.ts`.

## Rodando na sua máquina

Instale as dependências:

```bash
npm install
```

Crie um projeto no Supabase, vá em Project Settings → API e copie a Project URL
e a chave anon public. Depois:

```bash
copy .env.example .env.local
```

Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no `.env.local`.

A chave anon é pública por natureza, ela aparece no JavaScript que qualquer
visitante baixa. Quem protege os dados é o RLS. A chave `service_role` nunca
entra neste projeto, nem no código nem nas variáveis da Vercel.

No SQL Editor do Supabase, rode as migrations **na ordem**:

```
20260830120000_schema.sql              tabelas, tipos e trigger de auditoria
20260830120100_rls.sql                 is_autorizado() e as policies
20260830120200_grants.sql              conserto do erro 42501 da primeira versão
20260830130000_financeiro.sql          eventos, produtos, compras em lote
20260830130100_vincular_usuarios.sql   liga usuarios_autorizados a auth.users
20260830140000_excluir_eventos.sql     permite apagar evento
20260830150000_excluir_atendidos.sql   permite apagar atendido
20260830160000_acesso_e_papeis.sql     cadastro com aprovação, papel admin
20260830170000_tela_acessos.sql        permissões da aba Acessos
20260831120000_excluir_cadastro.sql    apagar cadastro de acesso
20260831140000_definir_senha.sql       admin define senha de alguém
20260831150000_importar_ficha_campo.sql   importação da ficha
20260831160000_importar_qualquer_autorizado.sql   libera a importação
```

Depois, em Authentication → Sign In / Providers → Email, ligue **Enable
Signups** e desligue **Confirm email**.

Confirmar e-mail parece uma boa ideia e não é, aqui. O plano gratuito do
Supabase envia pouquíssimos e-mails por hora, e quando várias pessoas se
cadastram no mesmo dia o envio falha. O cadastro é desfeito e a pessoa recebe um
erro genérico. Isso aconteceu de verdade e deixou três pessoas sem entrar por um
dia inteiro. Quem controla o acesso aqui é a aprovação na aba Acessos, não o
e-mail.

Crie sua conta pela tela de cadastro do sistema e, no SQL Editor, se torne
administrador:

```sql
update public.usuarios_autorizados
   set papel = 'admin', ativo = true
 where lower(email) = lower('seu-email@exemplo.com');
```

Daí em diante, aprovar as outras pessoas é clicar em "Liberar acesso" na aba
Acessos. Não precisa mais de SQL.

Para ter dados de brincadeira, rode `supabase/seed.sql` e
`supabase/seed-financeiro.sql`. Só no projeto de teste.

```bash
npm run dev
```

Abre em http://localhost:5173

## Comandos

`npm run dev` sobe o servidor de desenvolvimento.

`npm run build` faz a checagem de tipos e o build de produção.

`npm run lint` roda o oxlint.

`npm run verificar` roda os testes de regra de negócio. São três arquivos em
`src/testes`, cobrindo o pré-preenchimento, os bloqueios e avisos de valor, as
conversões do financeiro e a ficha de campo. Vale rodar depois de mexer em
`prefill.ts`, `avisos.ts`, no schema ou na ficha.

O teste da ficha de campo existe por um motivo específico: o JavaScript de
dentro dela é uma string para o compilador, não passa pelo TypeScript nem pelo
lint. Um erro de sintaxe ali só apareceria no evento, sem internet e sem ninguém
para consertar. O teste gera a ficha, compila o script e ainda executa a página
inteira num DOM simulado.

## O fluxo offline

Na aba Atendidos tem dois botões, "Ficha de campo" e "Importar ficha".

O primeiro gera um arquivo `.html` com os dados embutidos: a lista de atendidos,
o cadastro de cada um, quais campos estão faltando, o histórico dos atendimentos
anteriores e a lista da equipe. Você salva no computador ou manda por WhatsApp
para quem vai atender.

No evento, a pessoa abre o arquivo, escolhe o nome dela numa lista, e só então
consegue começar a atender. A ficha aplica os mesmos limites de valor do sistema
e a mesma regra de pré-preenchimento: copia condições e medicamentos do último
atendimento, nunca copia medição. As anotações ficam guardadas no próprio
aparelho.

No fim, o botão Exportar gera um texto (ou um arquivo `.json` já com o nome da
pessoa e a data). Esse texto volta pela tela de importação, que mostra uma
conferência antes de gravar qualquer coisa: quantos atendimentos, quantos
cadastros novos, quantos já tinham sido importados antes.

Duas coisas que valem saber sobre a importação:

Cada atendimento entra em nome de **quem coletou**, não de quem importou. Essa é
a única exceção do sistema à regra de que ninguém lança nada no nome de outra
pessoa, e ela está explicada na migration 0012.

Se qualquer atendimento for recusado, nenhum entra. Meio importado seria o
estado mais confuso possível. Duplicata é a exceção: ela é pulada em silêncio,
porque o identificador nasce no aparelho, então reimportar o mesmo arquivo é
seguro.

Aviso sobre o arquivo gerado: ele carrega histórico clínico e não tem senha nem
login. Dentro do sistema dá para revogar o acesso de alguém; num arquivo
enviado, não. Quem tiver o arquivo, tem os dados.

## Publicar

O site está na Vercel, ligado ao repositório do GitHub. Para alterar, é commit e
push. A Vercel percebe, roda o build e publica em mais ou menos um minuto. Se o
build falhar ela não publica, e o site continua no ar com a versão anterior.

Se der algo errado depois de publicar, dá para voltar: em Deployments, ache o
deploy que funcionava, clique nos três pontinhos e escolha Promote to
Production. Volta em segundos, sem mexer no código.

As variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` ficam no painel da
Vercel, em Settings → Environment Variables. Nunca num arquivo do repositório.

No Supabase, em Authentication → URL Configuration, o endereço da Vercel precisa
estar no Site URL e em Redirect URLs. Sem isso o link de recuperação de senha
aponta para localhost.

### Sobre o vercel.json

Tem uma linha só e sem ela o site quebra de um jeito confuso.

Isto é uma SPA: existe um `index.html` só, e quem decide qual tela mostrar é o
React Router, no navegador. Quando alguém abre `/idosos/abc` direto, seja
recarregando a página ou clicando num link salvo, o servidor procura um arquivo
naquele caminho, não encontra e devolve 404. Navegar clicando funciona,
recarregar quebra. O `rewrites` manda devolver sempre o `index.html`, e o React
Router assume dali.

## Estrutura

```
src/
  app/          rotas, guarda de rota, página 404
  lib/          cliente Supabase, TanStack Query, formatação, tradução de erros
  types/        tipos do banco
  components/
    ui/          componentes sem regra de negócio (Button, Input, Modal, Alerta)
    layout/      cabeçalho e estrutura das telas internas
  features/
    auth/        login, cadastro, recuperação e redefinição de senha
    acessos/     aprovar, revogar, papéis, senha, quem é autor de cada coisa
    idosos/      cadastro, lista e perfil dos atendidos
    registros/   atendimentos
    financeiro/  eventos e gastos
    campo/       ficha offline e importação
  hooks/        hooks genéricos
  testes/       testes de regra de negócio
supabase/
  migrations/   schema, RLS e funções
  seed.sql      dados fictícios
docs/           decisões de arquitetura, com as perguntas fechadas
```

A organização é por funcionalidade e não por tipo de arquivo. Mexer em "idosos"
não exige abrir quatro pastas distantes.

## Segurança

O RLS do Postgres é o que protege os dados. Uma conta autenticada que não esteja
liberada em `usuarios_autorizados` recebe zero linhas em qualquer consulta.

O `ProtectedRoute` do React não é segurança. Ele roda no navegador da pessoa e
pode ser desligado pelo DevTools em segundos. Serve para mostrar a tela de
"aguardando aprovação" em vez de um sistema vazio que pareceria quebrado.

Uma coisa que custou caro aprender: **o RLS filtra linhas, ele não dá erro**. Uma
operação sem permissão "dá certo" afetando zero linhas. Por isso as exclusões e
as alterações de acesso usam `.select()` e conferem se alguma linha mudou de
verdade, em vez de confiar na ausência de erro.

Todo registro guarda quem criou, quando, quem editou por último e quando. Um
trigger impede que os campos de criação sejam reescritos.

Sobre exclusão: registros, produtos e lotes não podem ser apagados. Atendido só
o administrador apaga, digitando a palavra EXCLUIR no aviso. Evento qualquer
pessoa autorizada apaga, porque é gasto de prestação de contas e não prontuário.
E quem já lançou qualquer coisa não pode ter o cadastro de acesso apagado, o
Postgres recusa: apagar a conta apagaria a identificação de quem fez aqueles
lançamentos.

### Teste antes de usar com dado real

Crie uma conta pela tela de cadastro e **não** aprove. Faça login com ela e
confirme que aparece a tela de espera, e que nenhuma lista mostra dado nenhum.
A lista tem que vir vazia, não com erro: o RLS filtra linhas, não bloqueia a
chamada.

## O que ainda falta

Nada disso impede o sistema de funcionar, mas precisa ser resolvido antes de
sair dos dados fictícios.

Um projeto separado no Supabase só para produção. Hoje o mesmo banco tem dados
de teste e é onde o site publicado aponta.

A base legal da LGPD. Dado de saúde é categoria especial, e a associação precisa
decidir em que base vai guardar isso, provavelmente consentimento por escrito de
cada pessoa atendida. É decisão da associação comunitária, não do sistema, mas o sistema não
deveria entrar em uso real sem isso.

Uma rotina de backup.

E a pausa por inatividade do Supabase: se ninguém usar o sistema por sete dias, o
banco congela e o site para de funcionar até alguém entrar no painel e clicar em
Restore. Nada se perde, mas dá um susto. Um monitor gratuito que abre o site uma
vez por dia resolve.

## Para estudar depois

Alguns arquivos concentram as decisões que mais custaram a chegar:

`supabase/migrations/20260830120100_rls.sql` mostra que GRANT e RLS são duas
camadas independentes. Eu tinha revogado permissões achando que estava sendo
cuidadoso e transformei um erro claro num 42501 indecifrável. A migration 0003 é
o conserto.

`src/features/registros/utils/prefill.ts` tem a regra mais sutil do sistema: o
que se copia do último atendimento e o que nunca se copia. Copiar uma pressão
antiga seria registrar uma medição que não aconteceu.

`src/features/registros/utils/avisos.ts` explica por que as faixas de aviso são
propositalmente largas. Se apertassem, o aviso deixaria de pegar erro de
digitação e viraria alerta clínico disfarçado, que é justamente o que este
sistema não faz.

`src/features/auth/mensagensAuth.ts` é sobre esconder erro. A tela de login
mostrava "e-mail ou senha incorretos" para qualquer falha, com a intenção de não
revelar quais contas existem. Quando o Supabase começou a recusar login por
e-mail não confirmado, todo mundo leu "senha errada" e trocou a senha à toa.
Segurança que esconde a causa de um erro operacional não é segurança, é perda de
diagnóstico.

`src/lib/erros.ts` existe porque o supabase-js não devolve instâncias de `Error`,
e um `catch` ingênuo mostra "erro desconhecido" justamente quando havia uma
mensagem útil.

`src/types/database.types.ts` usa `type` e não `interface`. Parece detalhe e não
é: interface não recebe index signature implícita, e o supabase-js precisa disso
para inferir os tipos das consultas.

As decisões de modelagem, com as perguntas que foram fechadas uma a uma, estão
em `docs/01-arquitetura-e-modelagem.md` e `docs/02-financeiro-modelagem.md`.

## Direitos de uso

Copyright (c) 2026 Samy Mallmann. Todos os direitos reservados.

Este repositório é público para leitura e avaliação. Ele **não** é software
livre e não tem licença aberta: nenhuma permissão de uso, cópia, modificação,
redistribuição ou uso comercial é concedida.

Na prática, isso significa que você pode ler o código, estudar as decisões e
citá-lo. Não pode copiá-lo para outro projeto, seu ou de terceiros, sem
autorização por escrito.

Se algum trecho for útil para você, me procure. A resposta provavelmente vai ser
sim, e eu prefiro ser perguntado.
