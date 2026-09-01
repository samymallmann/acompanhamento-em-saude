import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

export interface Acesso {
  autorizado: boolean
  admin: boolean
  nome: string | null
  email: string
  /** id da conta logada — usado para a tela de Acessos não deixar você mexer em si mesmo. */
  userId: string
}

/**
 * Situação de acesso da pessoa logada.
 *
 * Lê a própria linha em `usuarios_autorizados` — a policy `ua_select` permite
 * que cada pessoa veja a linha dela mesmo estando pendente. É isso que
 * possibilita mostrar a tela "aguardando aprovação" em vez de um sistema
 * vazio sem explicação.
 *
 * ⚠️ ISTO NÃO É SEGURANÇA. Serve para a interface saber o que mostrar. Quem
 * realmente impede o acesso aos dados é o RLS, e quem impede a exclusão de um
 * atendido é a policy `idosos_delete` com is_admin(). Se alguém burlar este
 * hook pelo DevTools, continua sem ver nada e sem conseguir apagar nada.
 */
export function useAcesso() {
  const { user, carregando: carregandoSessao } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['acesso', user?.id ?? ''],
    queryFn: async (): Promise<Acesso | null> => {
      if (!user) return null
      const { data, error } = await supabase
        .from('usuarios_autorizados')
        .select('nome, email, ativo, papel')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        console.error('[acesso] falha ao consultar:', error)
        throw error
      }
      if (!data) {
        // A linha é criada por trigger no momento do cadastro. Se não existe,
        // é conta antiga, criada antes desta mudança — trata como pendente.
        return { autorizado: false, admin: false, nome: null, email: user.email ?? '', userId: user.id }
      }

      return {
        autorizado: data.ativo,
        admin: data.papel === 'admin',
        nome: data.nome,
        email: data.email,
        userId: user.id,
      }
    },
    enabled: Boolean(user),
    // Curto de propósito: se você revogar o acesso de alguém, o efeito aparece
    // rápido em vez de ficar preso no cache até a pessoa fechar o navegador.
    staleTime: 60_000,
  })

  return {
    acesso: data ?? null,
    carregando: carregandoSessao || isLoading,
  }
}

/** Atalho para esconder o que é só de administrador. */
export function useEhAdmin(): boolean {
  const { acesso } = useAcesso()
  return acesso?.admin ?? false
}
