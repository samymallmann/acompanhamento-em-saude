import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/useAuth'
import * as api from './financeiro.api'

/* Chaves de cache do módulo. Ficam aqui, e não em lib/queryClient, porque só
   dizem respeito ao financeiro — o mesmo critério de organização por feature
   usado no resto do projeto. */
export const chavesFin = {
  eventos: ['financeiro', 'eventos'] as const,
  evento: (id: string) => ['financeiro', 'eventos', id] as const,
  /* Prefixo compartilhado por produtos, lotes e totais do mesmo evento.
     Invalidar ['financeiro', 'evento-dados', id] atualiza os três de uma vez —
     que é exatamente o necessário depois de qualquer lançamento, já que
     qualquer um deles muda o total. */
  dados: (id: string) => ['financeiro', 'evento-dados', id] as const,
}

/* -------------------------------- Eventos ------------------------------- */

export function useEventos() {
  return useQuery({ queryKey: chavesFin.eventos, queryFn: api.listarEventos })
}

export function useEvento(id: string | undefined) {
  return useQuery({
    queryKey: chavesFin.evento(id ?? ''),
    queryFn: () => api.buscarEvento(id!),
    enabled: Boolean(id),
  })
}

export function useSalvarEvento(id?: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: (dados: api.DadosEvento) => {
      if (id) return api.atualizarEvento(id, dados)
      if (!user) throw new Error('Sessão expirada. Entre novamente.')
      return api.criarEvento(dados, user.id)
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['financeiro'] }),
  })
}

export function useDesativarEvento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.desativarEvento,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['financeiro'] }),
  })
}

export function useReativarEvento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.reativarEvento,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['financeiro'] }),
  })
}

/** Exclusão real. Único delete do projeto — ver financeiro.api.ts. */
export function useExcluirEvento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.excluirEvento,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['financeiro'] }),
  })
}

/* ------------------------- Lançamentos e totais -------------------------- */

export function useProdutos(eventoId: string | undefined) {
  return useQuery({
    queryKey: [...chavesFin.dados(eventoId ?? ''), 'produtos'],
    queryFn: () => api.listarProdutos(eventoId!),
    enabled: Boolean(eventoId),
  })
}

export function useComprasLote(eventoId: string | undefined) {
  return useQuery({
    queryKey: [...chavesFin.dados(eventoId ?? ''), 'lotes'],
    queryFn: () => api.listarComprasLote(eventoId!),
    enabled: Boolean(eventoId),
  })
}

export function useTotais(eventoId: string | undefined) {
  return useQuery({
    queryKey: [...chavesFin.dados(eventoId ?? ''), 'totais'],
    queryFn: () => api.buscarTotais(eventoId!),
    enabled: Boolean(eventoId),
    // Sempre fresco: o total é o número que a prestação de contas usa.
    // Mostrar um valor em cache depois de lançar algo seria pior que esperar.
    staleTime: 0,
  })
}

/** Invalida produtos, lotes e totais do evento de uma vez só. */
function useInvalidarEvento(eventoId: string) {
  const queryClient = useQueryClient()
  return () => void queryClient.invalidateQueries({ queryKey: chavesFin.dados(eventoId) })
}

export function useSalvarProduto(eventoId: string, produtoId?: string) {
  const invalidar = useInvalidarEvento(eventoId)
  const { user } = useAuth()

  return useMutation({
    mutationFn: (dados: api.DadosProduto) => {
      if (produtoId) return api.atualizarProduto(produtoId, dados)
      if (!user) throw new Error('Sessão expirada. Entre novamente.')
      return api.criarProduto(eventoId, dados, user.id)
    },
    onSuccess: invalidar,
  })
}

export function useExcluirProduto(eventoId: string) {
  const invalidar = useInvalidarEvento(eventoId)
  return useMutation({ mutationFn: api.desativarProduto, onSuccess: invalidar })
}

export function useSalvarCompraLote(eventoId: string, compraId?: string) {
  const invalidar = useInvalidarEvento(eventoId)
  const { user } = useAuth()

  return useMutation({
    mutationFn: (dados: api.DadosCompraLote) => {
      if (compraId) return api.atualizarCompraLote(compraId, dados)
      if (!user) throw new Error('Sessão expirada. Entre novamente.')
      return api.criarCompraLote(eventoId, dados, user.id)
    },
    onSuccess: invalidar,
  })
}

export function useExcluirCompraLote(eventoId: string) {
  const invalidar = useInvalidarEvento(eventoId)
  return useMutation({ mutationFn: api.desativarCompraLote, onSuccess: invalidar })
}

/* -------------------------------- Autores ------------------------------- */

/* A etiqueta "por Fulano" mudou de casa: agora vive em
   features/acessos/api/autores.ts, porque passou a ser usada também pelo
   cadastro do atendido e pelo histórico de atendimentos. Autoria é assunto de
   pessoas, não de dinheiro. Reexportado aqui só para as telas do financeiro
   continuarem importando de onde já importavam. */
export { useAutores } from '@/features/acessos/api/autores'
