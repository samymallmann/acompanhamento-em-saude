import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/useAuth'
import { chaves } from '@/lib/queryClient'
import {
  atualizarIdoso,
  criarIdoso,
  desativarIdoso,
  excluirIdoso,
  reativarIdoso,
  type DadosIdoso,
} from './idosos.api'

/**
 * Cria ou atualiza um idoso.
 *
 * `invalidateQueries` com a chave de prefixo ['idosos'] marca TODOS os caches
 * de idosos como desatualizados de uma vez — a lista, cada busca já feita e o
 * item individual. É por isso que as chaves ficam centralizadas em
 * lib/queryClient: a hierarquia delas é o que faz a invalidação em bloco
 * funcionar sem enumerar cada tela na mão.
 */
export function useSalvarIdoso(id?: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (dados: DadosIdoso) => {
      if (id) return atualizarIdoso(id, dados)
      if (!user) throw new Error('Sessão expirada. Entre novamente.')
      return criarIdoso(dados, user.id)
    },
    onSuccess: (idoso) => {
      void queryClient.invalidateQueries({ queryKey: ['idosos'] })
      queryClient.setQueryData(chaves.idosos.porId(idoso.id), idoso)
    },
  })
}

export function useDesativarIdoso() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => desativarIdoso(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['idosos'] }),
  })
}

export function useReativarIdoso() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => reativarIdoso(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['idosos'] }),
  })
}

/** ⚠️ Exclusão real — ver o aviso em idosos.api.ts. */
export function useExcluirIdoso() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => excluirIdoso(id),
    onSuccess: () => {
      // Invalida idosos E registros: os atendimentos da pessoa foram
      // apagados junto, pela cascata.
      void queryClient.invalidateQueries({ queryKey: ['idosos'] })
      void queryClient.invalidateQueries({ queryKey: ['registros'] })
    },
  })
}
