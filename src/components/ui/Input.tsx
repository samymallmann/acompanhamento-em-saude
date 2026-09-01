import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  /** Erro que BLOQUEIA o salvamento. Vermelho. */
  erro?: string
  /** Aviso que apenas pede confirmação (Q10, nível 2). Âmbar, nunca vermelho. */
  aviso?: string
  dica?: string
  sufixo?: string
}

/**
 * Campo de formulário.
 *
 * `forwardRef` é o que permite o React Hook Form registrar o input: o RHF
 * trabalha com refs (componente não-controlado), e é justamente por isso que
 * ele re-renderiza tão pouco comparado a um formulário com useState por campo.
 *
 * Sobre as duas cores: vermelho é erro que impede salvar, âmbar é aviso que
 * pede confirmação. Usar vermelho nos dois casos ensina a usuária a ignorar
 * vermelho — e aí a proteção real deixa de funcionar.
 */
export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, erro, aviso, dica, sufixo, className, id, ...props },
  ref,
) {
  const idGerado = useId()
  const idCampo = id ?? idGerado
  const idAuxiliar = `${idCampo}-aux`

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={idCampo} className="text-sm font-medium text-slate-700">
        {label}
      </label>

      <div className="relative">
        <input
          ref={ref}
          id={idCampo}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro || aviso || dica ? idAuxiliar : undefined}
          className={cn(
            'min-h-11 w-full rounded-lg border bg-white px-3 text-base text-slate-900',
            'placeholder:text-slate-400 disabled:bg-slate-100 disabled:text-slate-500',
            sufixo && 'pr-14',
            erro
              ? 'border-red-400 focus:border-red-500'
              : aviso
                ? 'border-aviso-200 bg-aviso-50 focus:border-aviso-700'
                : 'border-slate-300 focus:border-marca-600',
            className,
          )}
          {...props}
        />
        {sufixo && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500">
            {sufixo}
          </span>
        )}
      </div>

      {(erro || aviso || dica) && (
        <p
          id={idAuxiliar}
          className={cn(
            'text-sm',
            erro ? 'text-red-700' : aviso ? 'text-aviso-700' : 'text-slate-500',
          )}
        >
          {erro ?? aviso ?? dica}
        </p>
      )}
    </div>
  )
})
