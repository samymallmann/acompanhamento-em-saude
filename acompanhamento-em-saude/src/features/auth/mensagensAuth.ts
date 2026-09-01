/* ---------------------------------------------------------------------------
   Mensagens de erro das telas de autenticação.

   POR QUE ESTE ARQUIVO EXISTE — e a lição que ele carrega:

   A primeira versão do login mostrava "E-mail ou senha incorretos." para
   QUALQUER falha. A intenção era legítima: não contar a um estranho quais
   e-mails têm conta no sistema (isso se chama enumeração de usuários).

   O efeito real foi outro. Quando o Supabase passou a recusar logins com
   `email_not_confirmed`, todo mundo leu "senha errada", trocou a senha, e o
   problema continuou — porque a senha nunca foi o problema. Foram dias de
   gente sem conseguir entrar por causa de uma mensagem.

   A lição: esconder a causa de um erro OPERACIONAL não é segurança, é perda de
   diagnóstico. Erro engolido custa mais caro do que erro feio.

   O critério passou a ser mais fino. Só continua genérica a mensagem que,
   sendo específica, revelaria a existência de uma conta a quem NÃO sabe a
   senha.

   Repare no `email_not_confirmed`. O Supabase valida nesta ordem:
       1. o e-mail existe?  não → invalid_credentials
       2. a senha confere?  não → invalid_credentials
       3. o e-mail está confirmado?  não → email_not_confirmed
   Ou seja, quem chega a ver essa mensagem JÁ acertou a senha. Ser específico
   ali não entrega nada que a pessoa não soubesse. Por isso pode ser detalhado
   sem abrir buraco nenhum.

   Nas telas, além da mensagem, o erro cru vai para o console do navegador
   (console.error). Assim a versão amigável nunca apaga a técnica.
--------------------------------------------------------------------------- */

/**
 * O supabase-js devolve um AuthError com { message, code, status }.
 * O campo `code` só existe nas versões mais recentes — por isso todo teste
 * aqui olha o código E o texto da mensagem. Depender só do código quebraria
 * silenciosamente numa atualização da biblioteca.
 */
interface ErroAuth {
  message?: string
  code?: string
  status?: number
}

function ehErroAuth(e: unknown): e is ErroAuth {
  return typeof e === 'object' && e !== null
}

function extrair(e: unknown): { codigo: string; texto: string } {
  if (!ehErroAuth(e)) return { codigo: '', texto: '' }
  return {
    codigo: typeof e.code === 'string' ? e.code : '',
    texto: typeof e.message === 'string' ? e.message.toLowerCase() : '',
  }
}

/** Casa pelo código oficial ou, na falta dele, por trecho da mensagem. */
function ehO(erro: unknown, codigo: string, trechos: string[]): boolean {
  const { codigo: c, texto } = extrair(erro)
  if (c === codigo) return true
  return trechos.some((t) => texto.includes(t))
}

/* -------------------------------------------------------------------------- */
/* Login                                                                      */
/* -------------------------------------------------------------------------- */

export function mensagemDeLogin(erro: unknown): string {
  // Específica de propósito: só chega aqui quem já acertou a senha (ver o
  // comentário no topo). E traz a saída prática, que é o link de recuperação —
  // ele confirma o e-mail como efeito colateral.
  if (ehO(erro, 'email_not_confirmed', ['email not confirmed', 'not confirmed'])) {
    return 'A senha está certa, mas este e-mail ainda não foi confirmado. Use "Esqueci minha senha": o link que chegar confirma o cadastro e libera a entrada.'
  }

  if (ehO(erro, 'over_request_rate_limit', ['rate limit', 'too many requests'])) {
    return 'Muitas tentativas seguidas. Aguarde alguns minutos antes de tentar de novo.'
  }

  if (ehO(erro, 'user_banned', ['banned'])) {
    return 'Esta conta está bloqueada. Fale com o administrador.'
  }

  // Falha de rede não é credencial errada, e mandar a pessoa reconferir a
  // senha quando o problema é a internet dela só gera confusão.
  if (ehO(erro, 'network_error', ['failed to fetch', 'networkerror', 'load failed'])) {
    return 'Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.'
  }

  // Único caso que precisa continuar genérico: aqui estão juntos "e-mail não
  // existe" e "senha errada", e separar os dois é justamente o que permitiria
  // descobrir quem tem conta no sistema.
  return 'E-mail ou senha incorretos.'
}

/* -------------------------------------------------------------------------- */
/* Cadastro                                                                   */
/* -------------------------------------------------------------------------- */

export function mensagemDeCadastro(erro: unknown): string {
  if (ehO(erro, 'user_already_exists', ['already registered', 'already been registered'])) {
    return 'Já existe um cadastro com este e-mail. Tente entrar ou use "Esqueci minha senha".'
  }

  // O SMTP embutido do Supabase no plano gratuito envia pouquíssimos e-mails
  // por hora. Com a confirmação por e-mail LIGADA, os primeiros cadastros
  // passam e os seguintes batem no limite — o que faz o problema parecer
  // aleatório ("com uns funciona, com outros não").
  if (
    ehO(erro, 'over_email_send_rate_limit', [
      'email rate limit',
      'rate limit exceeded',
      'for security purposes',
    ])
  ) {
    return 'O limite de envio de e-mails do servidor foi atingido. Aguarde cerca de uma hora, ou peça ao administrador para desligar a confirmação por e-mail no Supabase.'
  }

  if (ehO(erro, 'signup_disabled', ['signups not allowed', 'signup is disabled'])) {
    return 'O cadastro está desativado no momento. Fale com o administrador.'
  }

  if (ehO(erro, 'weak_password', ['password should be', 'weak password'])) {
    return 'Senha muito fraca. Use pelo menos 8 caracteres.'
  }

  // Quase sempre significa que um trigger do banco falhou (por exemplo
  // tg_criar_pedido_acesso). Não é culpa de quem está cadastrando, e dizer
  // isso evita a pessoa ficar tentando de novo à toa.
  if (ehO(erro, 'unexpected_failure', ['database error', 'error saving new user'])) {
    return 'O banco recusou a criação da conta. Isso é configuração do sistema, não erro seu — avise o administrador.'
  }

  return 'Não foi possível concluir o cadastro. Tente novamente em alguns instantes.'
}

/* -------------------------------------------------------------------------- */
/* Recuperação de senha                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Devolve `null` quando a tela deve seguir mostrando a confirmação neutra
 * ("se este e-mail estiver cadastrado, você receberá..."), que é o que impede
 * descobrir contas por aqui.
 *
 * A exceção é o limite de envio: nesse caso o e-mail comprovadamente NÃO saiu,
 * e afirmar que saiu deixa a pessoa esperando algo que nunca vai chegar.
 * Isso não revela nada — o limite é do servidor, não da conta.
 */
export function mensagemDeRecuperacao(erro: unknown): string | null {
  if (
    ehO(erro, 'over_email_send_rate_limit', [
      'email rate limit',
      'rate limit exceeded',
      'for security purposes',
    ])
  ) {
    return 'O limite de envio de e-mails do servidor foi atingido. Aguarde alguns minutos e tente de novo.'
  }

  if (ehO(erro, 'over_request_rate_limit', ['too many requests'])) {
    return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.'
  }

  return null
}
