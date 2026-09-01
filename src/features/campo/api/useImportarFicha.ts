import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/* ===========================================================================
   Importação da ficha de campo.

   Duas etapas separadas de propósito:

     CONFERIR  lê o texto, valida a estrutura e devolve um resumo. Não escreve
               nada. É o que permite a pessoa olhar antes de decidir.
     IMPORTAR  chama a função do banco, que valida tudo de novo e grava.

   A conferência aqui é conveniência, não segurança. Ela roda no navegador e
   pode ser burlada; quem realmente decide o que entra é `importar_atendimentos`
   (migration 0012), que refaz cada checagem do lado do servidor. A regra de
   sempre: o que roda no navegador serve para explicar, não para proteger.
=========================================================================== */

export interface AtendimentoImportado {
  id: string
  autor: { user_id: string | null; nome: string } | null
  idoso_id: string | null
  nomeReferencia: string
  cadastroNovo: Record<string, unknown> | null
  cadastroComplemento: Record<string, unknown> | null
  registro: { data_atendimento?: string }
}

export interface Conferencia {
  total: number
  cadastrosNovos: number
  complementos: number
  jaImportados: number
  /** Nomes de quem anotou mas ainda não tem acesso. Bloqueia a importação. */
  semAcesso: string[]
  atendimentos: AtendimentoImportado[]
}

class ErroDeArquivo extends Error {}

/**
 * Lê o texto exportado e devolve o resumo.
 *
 * As mensagens são propositalmente específicas sobre o que veio errado. Um
 * "arquivo inválido" genérico deixaria a pessoa sem saber se colou o texto
 * errado, se copiou pela metade, ou se o arquivo é de outra coisa.
 */
export async function conferir(texto: string): Promise<Conferencia> {
  const limpo = texto.trim()
  if (!limpo) throw new ErroDeArquivo('Cole o texto exportado pela ficha de campo.')

  let bruto: unknown
  try {
    bruto = JSON.parse(limpo)
  } catch {
    throw new ErroDeArquivo(
      'O texto não está completo ou foi alterado. Copie de novo usando o botão "Copiar tudo" da ficha.',
    )
  }

  const pacote = bruto as { origem?: string; atendimentos?: AtendimentoImportado[] }

  if (pacote.origem !== 'ficha-campo') {
    throw new ErroDeArquivo('Este texto não é uma exportação de ficha de campo.')
  }
  if (!Array.isArray(pacote.atendimentos)) {
    throw new ErroDeArquivo('A exportação não contém a lista de atendimentos.')
  }
  if (pacote.atendimentos.length === 0) {
    throw new ErroDeArquivo('Esta exportação está vazia — nenhum atendimento foi anotado.')
  }

  const atendimentos = pacote.atendimentos

  // Quais já entraram antes. Consultado no banco em vez de deduzido, porque a
  // pessoa pode ter importado parte deste mesmo arquivo em outro dia.
  const ids = atendimentos.map((a) => a.id).filter(Boolean)
  const { data: existentes, error } = await supabase
    .from('registros')
    .select('id')
    .in('id', ids)

  if (error) {
    console.error('[importar] falha ao conferir duplicatas:', error)
    throw error
  }

  const jaExistem = new Set((existentes ?? []).map((r) => r.id))

  const semAcesso = [
    ...new Set(
      atendimentos
        .filter((a) => !a.autor?.user_id)
        .map((a) => a.autor?.nome ?? 'não informado'),
    ),
  ]

  const novos = atendimentos.filter((a) => !jaExistem.has(a.id))

  return {
    total: atendimentos.length,
    jaImportados: atendimentos.length - novos.length,
    cadastrosNovos: novos.filter((a) => a.cadastroNovo).length,
    complementos: novos.filter((a) => a.cadastroComplemento).length,
    semAcesso,
    atendimentos,
  }
}

export interface ResultadoImportacao {
  importados: number
  pulados: number
  cadastros_novos: number
  cadastros_completados: number
}

export function useImportarFicha() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (texto: string): Promise<ResultadoImportacao> => {
      const payload = JSON.parse(texto.trim()) as unknown

      const { data, error } = await supabase.rpc('importar_atendimentos', {
        p_payload: payload as never,
      })

      if (error) {
        console.error('[importar] falha:', error)
        throw error
      }
      return data as unknown as ResultadoImportacao
    },
    onSuccess: () => {
      // Entrou gente e atendimento novo: as listas e os históricos mudaram.
      void queryClient.invalidateQueries({ queryKey: ['idosos'] })
      void queryClient.invalidateQueries({ queryKey: ['registros'] })
    },
  })
}
