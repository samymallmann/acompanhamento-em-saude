import { useQuery } from '@tanstack/react-query'
import { chaves } from '@/lib/queryClient'
import { buscarIdoso, listarIdosos } from './idosos.api'

/**
 * Lista de idosos, com busca opcional.
 *
 * A chave inclui o termo buscado: cada termo tem seu próprio cache, então
 * voltar a uma busca já feita é instantâneo.
 *
 * `placeholderData: (anterior) => anterior` mantém a lista antiga na tela
 * enquanto a nova chega — sem isso, a tabela pisca a cada letra digitada.
 */
export function useIdosos(busca: string) {
  return useQuery({
    queryKey: chaves.idosos.lista(busca),
    queryFn: () => listarIdosos(busca),
    placeholderData: (anterior) => anterior,
  })
}

export function useIdoso(id: string | undefined) {
  return useQuery({
    queryKey: chaves.idosos.porId(id ?? ''),
    queryFn: () => buscarIdoso(id!),
    // Não dispara a consulta enquanto o id não existir (ex.: parâmetro de rota
    // ainda indefinido). Evita uma requisição inútil que retornaria erro.
    enabled: Boolean(id),
  })
}
