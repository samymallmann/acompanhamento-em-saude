import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/* ===========================================================================
   QUEM LANÇOU CADA COISA — a etiqueta "por Fulano de Tal".

   POR QUE ISTO MORA AQUI, E NÃO NO FINANCEIRO:

   nasceu dentro do financeiro, que foi o primeiro lugar a precisar. Depois o
   cadastro do atendido e o histórico de atendimentos passaram a mostrar a
   mesma etiqueta — e três telas de módulos diferentes importando de dentro do
   financeiro seria dizer que autoria é assunto de dinheiro, o que não é.

   Autoria é assunto de PESSOAS, então mudou para junto de `usuarios_autorizados`.
   Regra prática: quando o segundo módulo precisa de algo do primeiro, o algo
   costuma pertencer a um terceiro lugar.

   COMO FUNCIONA:
   as tabelas guardam `created_by`, que é um UUID. O nome correspondente mora
   em `auth.users`, tabela do sistema do Supabase que o frontend não lê — e nem
   deveria. A ponte é a coluna `user_id` de `usuarios_autorizados`, preenchida
   pela migration 0005 e mantida por trigger desde então.

   Tudo isso é invisível para a usuária: ela nunca digita quem lançou.
=========================================================================== */

export interface Autor {
  user_id: string
  email: string
  nome: string | null
}

export const chaveAutores = ['autores'] as const

export async function listarAutores(): Promise<Autor[]> {
  const { data, error } = await supabase
    .from('usuarios_autorizados')
    .select('user_id, email, nome')
    .not('user_id', 'is', null)

  if (error) {
    console.error('[autores] falha ao listar:', error)
    throw error
  }

  return (data ?? [])
    .filter((u): u is typeof u & { user_id: string } => u.user_id !== null)
    .map((u) => ({ user_id: u.user_id, email: u.email, nome: u.nome }))
}

/**
 * Devolve uma função que traduz `created_by` em nome legível.
 *
 * Repare que é um hook que devolve função, e não um hook por autor: a lista de
 * pessoas é pequena e muda quase nunca, então vale buscar uma vez e consultar
 * em memória. Um hook por linha faria dezenas de consultas para montar uma
 * tela de histórico.
 */
export function useAutores() {
  const { data } = useQuery({
    queryKey: chaveAutores,
    queryFn: listarAutores,
    // Muda praticamente nunca: só quando alguém entra ou sai da lista branca.
    staleTime: 1000 * 60 * 30,
  })

  return (userId: string | null | undefined): string => {
    if (!userId) return 'autor não identificado'
    const autor = data?.find((a) => a.user_id === userId)
    if (!autor) return 'autor não identificado'
    // Nome completo, informado no cadastro. Cai no e-mail apenas para contas
    // antigas, criadas antes de o cadastro pedir o nome.
    return autor.nome ?? autor.email
  }
}
