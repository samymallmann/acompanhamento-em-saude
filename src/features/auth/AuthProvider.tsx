import type { Session, User } from '@supabase/supabase-js'
import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

interface AuthContextValue {
  session: Session | null
  user: User | null
  /** true enquanto a sessão salva no navegador ainda está sendo lida. */
  carregando: boolean
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/**
 * Mantém a sessão do Supabase disponível para todo o app.
 *
 * Detalhe importante do `carregando`: ao abrir a página, o Supabase precisa de
 * alguns milissegundos para ler a sessão salva no localStorage. Sem esse
 * estado, o ProtectedRoute veria `session === null` nesse instante e jogaria
 * a usuária para o login mesmo estando logada — um "pisca-pisca" clássico.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true

    supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return
      setSession(data.session)
      setCarregando(false)
    })

    // Reage a login, logout e renovação automática de token — inclusive quando
    // acontecem em outra aba do navegador.
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      if (!ativo) return
      setSession(novaSessao)
      setCarregando(false)
    })

    return () => {
      ativo = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const valor = useMemo(
    () => ({ session, user: session?.user ?? null, carregando }),
    [session, carregando],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
