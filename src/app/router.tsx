import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { AcessosPage } from '@/features/acessos/pages/AcessosPage'
import { CadastroPage } from '@/features/auth/pages/CadastroPage'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { RecuperarSenhaPage } from '@/features/auth/pages/RecuperarSenhaPage'
import { RedefinirSenhaPage } from '@/features/auth/pages/RedefinirSenhaPage'
import { EventoPage } from '@/features/financeiro/pages/EventoPage'
import { FormEventoPage } from '@/features/financeiro/pages/FormEventoPage'
import { ListaEventosPage } from '@/features/financeiro/pages/ListaEventosPage'
import { FormIdosoPage } from '@/features/idosos/pages/FormIdosoPage'
import { ListaIdososPage } from '@/features/idosos/pages/ListaIdososPage'
import { PerfilIdosoPage } from '@/features/idosos/pages/PerfilIdosoPage'
import { DetalheRegistroPage } from '@/features/registros/pages/DetalheRegistroPage'
import { NovoRegistroPage } from '@/features/registros/pages/NovoRegistroPage'
import { NaoEncontradaPage } from './NaoEncontradaPage'
import { ProtectedRoute } from './ProtectedRoute'

/* ---------------------------------------------------------------------------
   Rotas.

   As rotas de registro ficam ANINHADAS sob o idoso (/idosos/:id/registros/...).
   Isso garante que o idoso_id esteja sempre na URL: nenhum registro existe
   fora do contexto de uma pessoa, e o endereço reflete isso. De quebra dá
   link compartilhável para um atendimento específico.
--------------------------------------------------------------------------- */
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/cadastro', element: <CadastroPage /> },
  { path: '/recuperar-senha', element: <RecuperarSenhaPage /> },
  { path: '/redefinir-senha', element: <RedefinirSenhaPage /> },

  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/idosos" replace /> },

      { path: 'idosos', element: <ListaIdososPage /> },
      // 'novo' vem ANTES de ':id'. Se fosse depois, o React Router casaria
      // /idosos/novo com :id e tentaria buscar um idoso de id "novo".
      { path: 'idosos/novo', element: <FormIdosoPage /> },
      { path: 'idosos/:id', element: <PerfilIdosoPage /> },
      { path: 'idosos/:id/editar', element: <FormIdosoPage /> },

      { path: 'idosos/:id/registros/novo', element: <NovoRegistroPage /> },
      { path: 'idosos/:id/registros/:registroId', element: <DetalheRegistroPage /> },

      { path: 'financeiro', element: <ListaEventosPage /> },
      // 'novo' antes de ':id', mesma razão de /idosos/novo: senão o router
      // casaria /financeiro/novo com :id e buscaria um evento de id "novo".
      { path: 'financeiro/novo', element: <FormEventoPage /> },
      { path: 'financeiro/:id', element: <EventoPage /> },
      { path: 'financeiro/:id/editar', element: <FormEventoPage /> },

      { path: 'acessos', element: <AcessosPage /> },
    ],
  },

  { path: '*', element: <NaoEncontradaPage /> },
])
