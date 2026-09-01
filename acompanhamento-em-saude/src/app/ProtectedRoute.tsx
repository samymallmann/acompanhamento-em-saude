import { Navigate, useLocation } from 'react-router-dom'
import { TelaCarregando } from '@/components/ui/Feedback'
import { AguardandoAprovacaoPage } from '@/features/auth/pages/AguardandoAprovacaoPage'
import { useAcesso } from '@/features/auth/useAcesso'
import { useAuth } from '@/features/auth/useAuth'
import type { ReactNode } from 'react'

/**
 * Duas checagens em sequência: está logado? está aprovado?
 *
 * ⚠️  ISTO NÃO É SEGURANÇA.
 *
 * Todo este componente roda no navegador da pessoa, que pode desabilitá-lo com
 * o DevTools em segundos. Ele existe só para conforto: redirecionar para o
 * login e explicar o "aguardando aprovação" em vez de mostrar um sistema com
 * todas as listas vazias, que pareceria quebrado.
 *
 * A segurança real está no RLS do Postgres. Mesmo que alguém contorne isto,
 * as consultas voltam vazias enquanto `usuarios_autorizados.ativo` for false,
 * e a exclusão de atendido continua exigindo is_admin().
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, carregando: carregandoSessao } = useAuth()
  const { acesso, carregando: carregandoAcesso } = useAcesso()
  const location = useLocation()

  // Enquanto a sessão salva está sendo lida, não decidir nada — senão a
  // usuária logada seria mandada para o login por uma fração de segundo.
  if (carregandoSessao) return <TelaCarregando mensagem="Verificando acesso…" />

  if (!session) {
    // `state` guarda de onde a pessoa veio, para voltar ao destino certo
    // depois do login em vez de cair sempre na lista.
    return <Navigate to="/login" replace state={{ de: location.pathname }} />
  }

  if (carregandoAcesso) return <TelaCarregando mensagem="Verificando permissões…" />

  // Logada, porém pendente (ou com acesso revogado).
  if (!acesso?.autorizado) return <AguardandoAprovacaoPage />

  return <>{children}</>
}
