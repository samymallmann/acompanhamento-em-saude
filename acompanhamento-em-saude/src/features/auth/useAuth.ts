import { useContext } from 'react'
import { AuthContext } from './AuthProvider'

/** Acesso à sessão atual. Lança erro claro se usado fora do AuthProvider. */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth precisa estar dentro de <AuthProvider>.')
  }
  return ctx
}
