import { Link } from 'react-router-dom'

export function NaoEncontradaPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-sm font-medium text-slate-400">Erro 404</p>
      <h1 className="text-xl font-semibold text-slate-900">Página não encontrada</h1>
      <p className="max-w-sm text-sm text-slate-500">
        O endereço acessado não existe ou foi removido.
      </p>
      <Link
        to="/idosos"
        className="mt-2 rounded-lg bg-marca-600 px-4 py-2.5 text-white hover:bg-marca-700"
      >
        Ir para a lista de atendidos
      </Link>
    </main>
  )
}
