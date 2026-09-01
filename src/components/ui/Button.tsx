import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Variante = 'primario' | 'secundario' | 'perigo' | 'texto'
type Tamanho = 'md' | 'sm'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  tamanho?: Tamanho
  carregando?: boolean
  children: ReactNode
}

const variantes: Record<Variante, string> = {
  primario: 'bg-marca-600 text-white hover:bg-marca-700 disabled:bg-marca-600/50',
  secundario:
    'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:opacity-50',
  perigo: 'bg-white text-red-700 border border-red-300 hover:bg-red-50 disabled:opacity-50',
  texto: 'text-marca-700 hover:bg-marca-50 disabled:opacity-50',
}

const tamanhos: Record<Tamanho, string> = {
  // min-h-11 = 44px: alvo mínimo de toque confortável no celular.
  md: 'min-h-11 px-4 text-base',
  sm: 'min-h-9 px-3 text-sm',
}

export function Button({
  variante = 'primario',
  tamanho = 'md',
  carregando = false,
  disabled,
  className,
  children,
  ...props
}: Props) {
  return (
    <button
      // Sem type explícito, todo <button> dentro de <form> vira submit —
      // origem clássica de "o formulário enviou sozinho ao clicar em Cancelar".
      type="button"
      disabled={disabled || carregando}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
        'transition-colors duration-150 disabled:cursor-not-allowed',
        variantes[variante],
        tamanhos[tamanho],
        className,
      )}
      {...props}
    >
      {carregando && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  )
}
