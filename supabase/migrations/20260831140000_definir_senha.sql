-- =============================================================================
-- 0011 — ADMINISTRADOR DEFINE A SENHA DE ALGUÉM
--
-- POR QUE ISTO EXISTE:
-- o caminho normal de recuperação é o "Esqueci minha senha", que depende de
-- e-mail. E e-mail, neste projeto, é o elo fraco: o plano gratuito do Supabase
-- limita o envio a poucos por hora, e foi exatamente isso que deixou três
-- pessoas sem entrar em 31/08. Numa associação pequena, "espere uma hora e
-- torça para o e-mail chegar" não é resposta aceitável no meio de um evento.
--
--
-- O QUE ISTO CUSTA — e é honesto deixar escrito:
--
-- quem pode definir a senha de uma pessoa pode entrar como ela. A partir daqui,
-- `created_by` responde "quem estava com a senha naquele momento", não mais
-- "quem necessariamente digitou aquilo". Num sistema de dado de saúde isso
-- enfraquece a rastreabilidade.
--
-- A decisão foi tomada com esse custo à vista: o sistema tem uma responsável
-- que já enxerga todos os dados de qualquer forma, e a alternativa — pessoas
-- travadas para fora sem ninguém que possa destravar — é pior. Não é o padrão
-- que se usaria num hospital; é o padrão certo para ESTE contexto.
--
-- Duas mitigações baratas ficam embutidas:
--   1. as sessões abertas da pessoa são derrubadas (senão a senha muda mas quem
--      já estava logado continua dentro, o que anula o efeito quando o motivo
--      da troca é justamente tirar alguém de lá);
--   2. a tela avisa que a pessoa deve trocar a senha depois, para voltar a ser
--      a única a saber.
--
--
-- SOBRE ESCREVER DIRETO EM auth.users:
-- o Supabase desaconselha mexer no schema `auth`, e com razão — são tabelas
-- internas que mudam entre versões. Aqui o risco é aceitável porque mexemos em
-- UM campo, `encrypted_password`, cujo formato (bcrypt) é estável e é o mesmo
-- que o próprio Supabase grava. Criar uma conta do zero seria diferente: exige
-- acertar várias tabelas relacionadas e é onde esse tipo de gambiarra quebra.
-- =============================================================================


create or replace function public.definir_senha(p_id uuid, p_senha text)
returns void
language plpgsql
security definer
-- `extensions` entra no caminho porque é onde o Supabase instala o pgcrypto,
-- que fornece crypt() e gen_salt(). Fixar a lista é obrigatório em SECURITY
-- DEFINER: sem isso, alguém poderia manipular o search_path e fazer a função
-- chamar outra crypt().
set search_path = public, extensions
as $$
declare
  v_user_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Apenas o administrador pode definir senhas.';
  end if;

  -- Mesma regra do formulário e do painel do Supabase. Repetida aqui porque
  -- validação de tela é sugestão; validação de banco é regra.
  if p_senha is null or length(p_senha) < 8 then
    raise exception 'A senha precisa ter pelo menos 8 caracteres.';
  end if;

  select user_id into v_user_id
    from public.usuarios_autorizados
   where id = p_id;

  if not found then
    raise exception 'Cadastro não encontrado.';
  end if;

  if v_user_id is null then
    raise exception 'Este cadastro não tem conta de login vinculada.';
  end if;

  -- bcrypt, o mesmo algoritmo que o Supabase usa. gen_salt('bf') gera um sal
  -- novo a cada chamada — é por isso que a mesma senha nunca produz o mesmo
  -- hash duas vezes, e é o que impede comparar hashes para descobrir quem usa
  -- senha igual a quem.
  update auth.users
     set encrypted_password = crypt(p_senha, gen_salt('bf')),
         updated_at = now()
   where id = v_user_id;

  -- Derruba o que já estava aberto. Sem isto, trocar a senha não expulsa
  -- ninguém: o token de sessão continua válido até expirar sozinho.
  --
  -- O `to_regclass` é uma checagem defensiva — se um dia o Supabase renomear
  -- ou remover essas tabelas internas, a troca de senha continua funcionando
  -- em vez de a função inteira quebrar.
  if to_regclass('auth.refresh_tokens') is not null then
    delete from auth.refresh_tokens where user_id = v_user_id::text;
  end if;

  if to_regclass('auth.sessions') is not null then
    delete from auth.sessions where user_id = v_user_id;
  end if;
end;
$$;


-- Mesmo raciocínio das outras funções SECURITY DEFINER: EXECUTE nasce liberado
-- para PUBLIC (o que inclui visitante sem login), e aqui isso é largo demais.
revoke all on function public.definir_senha(uuid, text) from public;
grant execute on function public.definir_senha(uuid, text) to authenticated;

comment on function public.definir_senha(uuid, text) is
  'Define a senha de um cadastro e encerra as sessões abertas dele. Só administrador.';


-- =============================================================================
-- COMO USAR, na prática:
--
--   1. A pessoa avisa que não consegue entrar.
--   2. Na aba Acessos, clique em "Alterar senha" na linha dela.
--   3. Escolha uma senha provisória e passe para ela por um canal direto
--      (pessoalmente, ligação, mensagem) — nunca junto com o e-mail dela no
--      mesmo lugar.
--   4. Peça para ela entrar e trocar por uma senha só dela em
--      "Esqueci minha senha", assim que possível.
--
-- O passo 4 é o que devolve a exclusividade da senha para o dono dela. Sem ele,
-- duas pessoas conhecem a senha por tempo indeterminado.
-- =============================================================================
