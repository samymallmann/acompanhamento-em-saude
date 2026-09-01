import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useAcesso } from '@/features/auth/useAcesso'
import { cn } from '@/lib/cn'
import { supabase } from '@/lib/supabase'

interface ItemMenu {
  para: string
  rotulo: string
  futuro?: boolean
}

interface ItemMenuComPapel extends ItemMenu {
  /** Só aparece para o administrador. */
  soAdmin?: boolean
}

const menu: ItemMenuComPapel[] = [
  { para: '/idosos', rotulo: 'Atendidos' },
  { para: '/financeiro', rotulo: 'Financeiro' },
  { para: '/acessos', rotulo: 'Acessos', soAdmin: true },
]

export function AppLayout() {
  const { acesso } = useAcesso()
  const navigate = useNavigate()
  // Esconder o item do menu é conveniência. A tela também confere, e o banco
  // recusa qualquer alteração de quem não é admin.
  const itens = menu.filter((item) => !item.soAdmin || acesso?.admin)
  const [menuAberto, setMenuAberto] = useState(false)

  async function sair() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      {/* Cabeçalho fixo. No desktop mostra a navegação inteira; no celular,
          um botão que abre o menu abaixo. Sem drawer animado: um painel que
          simplesmente aparece resolve igual e tem menos peça para quebrar. */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-base font-semibold text-slate-900">
              Acompanhamento em Saúde
            </span>

            <nav className="hidden gap-1 md:flex">
              {itens.map((item) => (
                <NavLink
                  key={item.para}
                  to={item.para}
                  className={({ isActive }) =>
                    cn(
                      'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-marca-50 text-marca-700'
                        : 'text-slate-600 hover:bg-slate-100',
                    )
                  }
                >
                  {item.rotulo}
                  {item.futuro && (
                    <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                      em breve
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">
              {acesso?.nome ?? acesso?.email}
            </span>
            <Button variante="secundario" tamanho="sm" onClick={sair}>
              Sair
            </Button>
            <Button
              variante="secundario"
              tamanho="sm"
              className="md:hidden"
              aria-expanded={menuAberto}
              onClick={() => setMenuAberto((v) => !v)}
            >
              Menu
            </Button>
          </div>
        </div>

        {menuAberto && (
          <nav className="flex flex-col border-t border-slate-200 p-2 md:hidden">
            {itens.map((item) => (
              <NavLink
                key={item.para}
                to={item.para}
                onClick={() => setMenuAberto(false)}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-3 text-base font-medium',
                    isActive ? 'bg-marca-50 text-marca-700' : 'text-slate-700',
                  )
                }
              >
                {item.rotulo}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      {/* Outlet: aqui o React Router encaixa a página da rota atual. É o que
          permite o cabeçalho existir uma vez só, em vez de repetido em cada tela. */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
