import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/useAuth'
import { chaves } from '@/lib/queryClient'
import {
  atualizarRegistro,
  buscarRegistro,
  buscarUltimoRegistro,
  criarRegistro,
  listarRegistros,
  type DadosRegistro,
} from './registros.api'

export function useRegistros(idosoId: string | undefined) {
  return useQuery({
    queryKey: chaves.registros.doIdoso(idosoId ?? ''),
    queryFn: () => listarRegistros(idosoId!),
    enabled: Boolean(idosoId),
  })
}

export function useUltimoRegistro(idosoId: string | undefined) {
  return useQuery({
    queryKey: chaves.registros.ultimo(idosoId ?? ''),
    queryFn: () => buscarUltimoRegistro(idosoId!),
    enabled: Boolean(idosoId),
    // Sempre busca fresco: este dado alimenta o pré-preenchimento, e usar uma
    // versão em cache poderia copiar condições de um registro que a colega
    // acabou de atualizar em outra máquina.
    staleTime: 0,
  })
}

export function useRegistro(id: string | undefined) {
  return useQuery({
    queryKey: chaves.registros.porId(id ?? ''),
    queryFn: () => buscarRegistro(id!),
    enabled: Boolean(id),
  })
}

export function useCriarRegistro(idosoId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: (dados: DadosRegistro) => {
      if (!user) throw new Error('Sessão expirada. Entre novamente.')
      return criarRegistro(dados, user.id)
    },
    onSuccess: () => {
      // Invalida o histórico E o "último registro": o novo passou a ser o mais
      // recente, então o próximo pré-preenchimento tem que vir dele.
      void queryClient.invalidateQueries({ queryKey: ['registros', idosoId] })
    },
  })
}

export function useAtualizarRegistro(idosoId: string, registroId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (dados: DadosRegistro) => atualizarRegistro(registroId, dados),
    onSuccess: (registro) => {
      void queryClient.invalidateQueries({ queryKey: ['registros', idosoId] })
      queryClient.setQueryData(chaves.registros.porId(registro.id), registro)
    },
  })
}
