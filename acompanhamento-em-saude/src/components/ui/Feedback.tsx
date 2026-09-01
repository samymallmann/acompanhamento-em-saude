import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Indicador de carregamento. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Carregando"
      className={cn(
        'inline-block size-5 animate-spin rounded-full border-2',
        'border-slate-300 border-t-marca-600',
        className,
      )}
    />
  )
}

export function TelaCarregando({ mensagem = 'Carregando…' }: { mensagem?: string }) {
  return (
    <div className="flex min-h-60 flex-col items-center justify-center gap-3 text-slate-500">
      <Spinner className="size-8" />
      <p>{mensagem}</p>
    </div>
  )
}

/**
 * Estado vazio.
 * Uma lista vazia sem explicação parece sistema quebrado. Dizer o que houve e
 * qual é o próximo passo custa pouco e evita a dúvida.
 */
export function EstadoVazio({
  titulo,
  descricao,
  acao,
}: {
  titulo: string
  descricao?: string
  acao?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <p className="text-base font-medium text-slate-700">{titulo}</p>
      {descricao && <p className="max-w-md text-sm text-slate-500">{descricao}</p>}
      {acao && <div className="mt-3">{acao}</div>}
    </div>
  )
}

type TipoAlerta = 'erro' | 'aviso' | 'info'

const estilos: Record<TipoAlerta, string> = {
  erro: 'border-red-200 bg-red-50 text-red-800',
  aviso: 'border-aviso-200 bg-aviso-50 text-aviso-700',
  info: 'border-slate-200 bg-slate-50 text-slate-700',
}

export function Alerta({
  tipo = 'info',
  titulo,
  children,
}: {
  tipo?: TipoAlerta
  titulo?: string
  children: ReactNode
}) {
  return (
    <div
      role={tipo === 'erro' ? 'alert' : 'status'}
      className={cn('rounded-lg border px-4 py-3 text-sm', estilos[tipo])}
    >
      {titulo && <p className="mb-0.5 font-semibold">{titulo}</p>}
      {children}
    </div>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white p-5', className)}>
      {children}
    </div>
  )
}

export function CabecalhoPagina({
  titulo,
  subtitulo,
  acoes,
}: {
  titulo: string
  subtitulo?: string
  acoes?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-slate-500">{subtitulo}</p>}
      </div>
      {acoes && <div className="flex gap-2">{acoes}</div>}
    </div>
  )
}
