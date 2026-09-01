import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { queryClient } from '@/lib/queryClient'
import { router } from '@/app/router'
import './index.css'

const raiz = document.getElementById('root')
if (!raiz) throw new Error('Elemento #root não encontrado em index.html.')

createRoot(raiz).render(
  <StrictMode>
    {/* Ordem importa: QueryClientProvider por fora, AuthProvider dentro.
        Assim qualquer hook de dados já tem acesso à sessão. */}
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
