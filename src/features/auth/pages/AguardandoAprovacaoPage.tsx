import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Alerta } from '@/components/ui/Feedback'
import { supabase } from '@/lib/supabase'
import { useAcesso } from '../useAcesso'

/**
 * Tela de quem está logado mas ainda não foi aprovado.
 *
 * Existe para que a pessoa entenda o que está acontecendo. Sem ela, quem se
 * cadastrasse veria o sistema com todas as listas vazias e acharia que está
 * quebrado — quando na verdade está funcionando exatamente como deveria.
 */
export function AguardandoAprovacaoPage() {
  const { acesso } = useAcesso()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  async function sair() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6">
          <h1 className="text-xl font-semibold text-slate-900">
            Acesso aguardando aprovação
          </h1>

          <Alerta tipo="aviso">
            Sua conta foi criada, mas ainda não foi liberada pelo administrador.
            Enquanto isso, nenhum dado fica visível.
          </Alerta>

          <dl className="flex flex-col gap-2 text-sm">
            {acesso?.nome && (
              <div>
                <dt className="text-xs text-slate-500">Nome</dt>
                <dd className="text-slate-800">{acesso.nome}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-slate-500">E-mail</dt>
              <dd className="text-slate-800">{acesso?.email}</dd>
            </div>
          </dl>

          <p className="text-sm text-slate-600">
            Avise o administrador com o e-mail acima. Depois que ele liberar, clique
            em verificar.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                // Descarta o cache do acesso e busca de novo — assim a pessoa
                // não precisa deslogar e logar para o sistema perceber que foi
                // aprovada.
                void queryClient.invalidateQueries({ queryKey: ['acesso'] })
              }}
            >
              Verificar novamente
            </Button>
            <Button variante="secundario" onClick={sair}>
              Sair
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}
