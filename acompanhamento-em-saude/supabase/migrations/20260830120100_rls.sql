-- =============================================================================
-- 0002 — ROW LEVEL SECURITY
--
-- MODELO DE AMEAÇA, EM UMA FRASE:
-- a chave `anon` fica dentro do JavaScript que o navegador baixa e é PÚBLICA
-- por definição — qualquer pessoa lê no DevTools. Ela não é uma senha, é um
-- endereço. A única coisa entre um curioso e os dados de saúde é o RLS.
--
-- Consequência prática: nenhuma proteção escrita em React é proteção. O
-- ProtectedRoute do frontend só evita mostrar tela quebrada. Quem barra é isto aqui.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Função central de autorização
-- -----------------------------------------------------------------------------
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

-- Por que cada palavra-chave importa:
--
-- security definer
--   Roda com os privilégios de quem criou a função, ignorando RLS ao ler
--   usuarios_autorizados. SEM isso, a policy de usuarios_autorizados chamaria a
--   função que lê usuarios_autorizados -> recursão infinita. É a armadilha
--   número 1 de RLS no Supabase.
--
-- set search_path = public
--   Obrigatório junto com security definer. Sem fixar o search_path, alguém com
--   permissão de criar objetos poderia plantar uma tabela de mesmo nome em outro
--   schema e sequestrar a função. Mitigação padrão.
--
-- stable
--   Permite ao Postgres avaliar uma vez por consulta em vez de uma vez por
--   linha. Numa tabela com RLS isso é a diferença entre 1 checagem e N.
--
-- checagem por e-mail do JWT (e não auth.uid())
--   As contas são criadas manualmente por você: os e-mails são conhecidos antes
--   dos UUIDs. O e-mail vem do token assinado pelo Supabase, o cliente não
--   consegue forjar. Evolução futura: preencher usuarios_autorizados.user_id e
--   trocar por auth.uid() — imune a troca de e-mail.

comment on function public.is_autorizado() is
  'True se o e-mail do JWT está na lista branca e ativo. Base de todas as policies.';


-- -----------------------------------------------------------------------------
-- Ativação
--
-- Com RLS ligado e NENHUMA policy criada, o padrão do Postgres é negar tudo.
-- Ou seja: o estado seguro é o estado inicial, e cada policy abaixo é uma
-- abertura explícita e nomeada.
-- -----------------------------------------------------------------------------
alter table public.usuarios_autorizados enable row level security;
alter table public.idosos              enable row level security;
alter table public.registros           enable row level security;


-- -----------------------------------------------------------------------------
-- usuarios_autorizados
--
-- Só SELECT. Sem INSERT/UPDATE/DELETE: a lista branca só muda pelo painel do
-- Supabase, onde a service_role ignora RLS. Nenhuma usuária pode se
-- autoconceder acesso nem conceder a terceiros pela aplicação.
-- -----------------------------------------------------------------------------
create policy ua_select on public.usuarios_autorizados
  for select to authenticated
  using (public.is_autorizado());


-- -----------------------------------------------------------------------------
-- idosos
-- -----------------------------------------------------------------------------
create policy idosos_select on public.idosos
  for select to authenticated
  using (public.is_autorizado());

-- created_by = auth.uid() no WITH CHECK: impede inserir registro atribuído a
-- outra pessoa. Auditoria só vale se for infalsificável.
create policy idosos_insert on public.idosos
  for insert to authenticated
  with check (public.is_autorizado() and created_by = auth.uid());

create policy idosos_update on public.idosos
  for update to authenticated
  using (public.is_autorizado())
  with check (public.is_autorizado());

-- SEM policy de DELETE — proposital. É isto que torna o hard delete impossível
-- para qualquer usuária. "Excluir" na interface faz update ativo=false.
-- Segunda barreira independente: o on delete restrict da FK em registros.


-- -----------------------------------------------------------------------------
-- registros
-- -----------------------------------------------------------------------------
create policy registros_select on public.registros
  for select to authenticated
  using (public.is_autorizado());

create policy registros_insert on public.registros
  for insert to authenticated
  with check (public.is_autorizado() and created_by = auth.uid());

-- Q2: edição permitida (com confirmação na interface, sem versionamento).
-- O trigger tg_auditoria garante que created_by/created_at não sejam reescritos
-- e que updated_at/updated_by sejam sempre preenchidos.
create policy registros_update on public.registros
  for update to authenticated
  using (public.is_autorizado())
  with check (public.is_autorizado());

-- SEM policy de DELETE.


-- -----------------------------------------------------------------------------
-- Permissões de tabela (camada separada do RLS!)
--
-- GRANT e RLS são duas camadas distintas, avaliadas nesta ordem:
--   1. Sem GRANT no papel -> erro 42501, a consulta nem chega ao RLS.
--   2. Com GRANT, o RLS decide linha a linha. Nenhuma policy casando = 0 linhas.
--
-- Confundir as duas é a causa mais comum de "meu RLS não funciona". O padrão
-- correto é GRANT amplo no papel + RLS restritivo nas linhas.
--
-- Atenção ao que NÃO está aqui: DELETE não é concedido a ninguém. Somado à
-- ausência de policy de DELETE, a proibição de hard delete fica registrada nas
-- duas camadas.
--
-- O papel `anon` recebe SELECT de propósito: sem sessão válida ele não casa com
-- nenhuma policy (todas são `to authenticated`) e recebe zero linhas — que é o
-- comportamento desejado, sem erro de permissão confuso pelo caminho.
-- -----------------------------------------------------------------------------
grant select, insert, update on public.idosos               to authenticated;
grant select, insert, update on public.registros            to authenticated;
grant select                 on public.usuarios_autorizados to authenticated;
grant execute on function public.is_autorizado()            to authenticated;

grant select on public.idosos               to anon;
grant select on public.registros            to anon;
grant select on public.usuarios_autorizados to anon;


-- =============================================================================
-- TESTE OBRIGATÓRIO ANTES DE USAR COM DADO REAL
--
-- 1. Criar no painel uma conta cujo e-mail NÃO esteja em usuarios_autorizados.
-- 2. Logar com ela no sistema.
-- 3. Confirmar que todas as listas voltam VAZIAS.
--
-- Atenção ao detalhe: o esperado é vazio, não erro. RLS filtra linhas, não
-- bloqueia a chamada. Se aparecer erro de permissão, alguma coisa está
-- configurada diferente do previsto aqui.
-- =============================================================================
