/* ---------------------------------------------------------------------------
   Tradução de erros para mensagem legível.

   POR QUE ESTE ARQUIVO EXISTE:
   o supabase-js NÃO lança instâncias de Error. Ele devolve um objeto simples
   (PostgrestError) com { message, details, hint, code }. Por isso o teste
   `error instanceof Error` dá FALSO e um catch ingênuo acaba mostrando
   "erro desconhecido" justamente quando havia uma mensagem útil.

   Erro engolido é pior que erro feio: sem a mensagem, não há como depurar.
--------------------------------------------------------------------------- */

interface ErroPostgrest {
  message: string
  details?: string | null
  hint?: string | null
  code?: string | null
}

function ehErroPostgrest(e: unknown): e is ErroPostgrest {
  return typeof e === 'object' && e !== null && 'message' in e
}

/** Códigos que têm explicação melhor que a mensagem crua do Postgres. */
const porCodigo: Record<string, string> = {
  // Tabela não existe: as migrations ainda não foram aplicadas.
  '42P01':
    'As tabelas ainda não existem no banco. Rode as migrations de supabase/migrations no SQL Editor do Supabase.',
  // Função não existe (is_autorizado ausente).
  '42883':
    'A função is_autorizado() não existe no banco. Rode a migration de RLS (…_rls.sql).',
  // Violação de RLS ao gravar.
  '42501':
    'Sem permissão para esta operação. Confirme se o seu e-mail está em usuarios_autorizados e ativo.',
  // Violação de check constraint.
  '23514': 'Algum valor está fora da faixa permitida pelo banco.',
  // Recursão infinita em policy.
  '42P17':
    'Recursão nas políticas de RLS. Verifique se is_autorizado() foi criada com SECURITY DEFINER.',
}

export function mensagemDeErro(e: unknown): string {
  if (e instanceof Error) return e.message

  if (ehErroPostgrest(e)) {
    const codigo = e.code ?? ''
    const explicacao = porCodigo[codigo]
    const partes = [explicacao ?? e.message]

    if (!explicacao) {
      if (e.details) partes.push(e.details)
      if (e.hint) partes.push(`Dica: ${e.hint}`)
    }
    if (codigo) partes.push(`(código ${codigo})`)

    return partes.join(' ')
  }

  if (typeof e === 'string') return e
  return 'Erro desconhecido.'
}
