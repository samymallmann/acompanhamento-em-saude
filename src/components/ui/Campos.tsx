import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/* ---------------------------------------------------------------------------
   Campos de formulário além do Input.

   Todos usam forwardRef pelo mesmo motivo: o React Hook Form registra o campo
   por referência (componente não-controlado), e é isso que faz o formulário
   re-renderizar pouco mesmo com dezenas de campos — como o de registro.
--------------------------------------------------------------------------- */

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  erro?: string
  opcoes: Array<{ valor: string; rotulo: string }>
  vazio?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, erro, opcoes, vazio, className, id, ...props },
  ref,
) {
  const idGerado = useId()
  const idCampo = id ?? idGerado

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={idCampo} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        ref={ref}
        id={idCampo}
        aria-invalid={erro ? true : undefined}
        className={cn(
          'min-h-11 w-full rounded-lg border bg-white px-3 text-base text-slate-900',
          erro ? 'border-red-400' : 'border-slate-300 focus:border-marca-600',
          className,
        )}
        {...props}
      >
        {vazio !== undefined && <option value="">{vazio}</option>}
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
      {erro && <p className="text-sm text-red-700">{erro}</p>}
    </div>
  )
})

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  erro?: string
  dica?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, erro, dica, className, id, ...props },
  ref,
) {
  const idGerado = useId()
  const idCampo = id ?? idGerado

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={idCampo} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <textarea
        ref={ref}
        id={idCampo}
        rows={4}
        aria-invalid={erro ? true : undefined}
        className={cn(
          'w-full rounded-lg border bg-white px-3 py-2.5 text-base text-slate-900',
          'placeholder:text-slate-400',
          erro ? 'border-red-400' : 'border-slate-300 focus:border-marca-600',
          className,
        )}
        {...props}
      />
      {(erro || dica) && (
        <p className={cn('text-sm', erro ? 'text-red-700' : 'text-slate-500')}>{erro ?? dica}</p>
      )}
    </div>
  )
})

interface CheckboxProps {
  label: string
  children?: ReactNode
}

/**
 * Checkbox com área de clique grande.
 *
 * O <label> envolve o input inteiro: clicar no texto também marca a caixa.
 * Numa tela usada no celular, em pé, durante um atendimento, isso muda
 * bastante a taxa de erro.
 */
export const Checkbox = forwardRef<
  HTMLInputElement,
  CheckboxProps & React.InputHTMLAttributes<HTMLInputElement>
>(function Checkbox({ label, children, className, ...props }, ref) {
  return (
    <div>
      <label
        className={cn(
          'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-2',
          'hover:bg-slate-50',
          className,
        )}
      >
        <input
          ref={ref}
          type="checkbox"
          className="size-5 shrink-0 rounded border-slate-400 text-marca-600 accent-marca-600"
          {...props}
        />
        <span className="text-base text-slate-800">{label}</span>
      </label>
      {children && <div className="mt-1 ml-10">{children}</div>}
    </div>
  )
})

/**
 * Sim / Não / Não informado.
 *
 * Três opções, não duas — decisão da Q5. "Não informado" existe porque a ficha
 * de papel pode ter o campo em branco, e isso é diferente de a pessoa ter
 * respondido "Não". Forçar uma escolha faria o sistema inventar dado.
 */
interface SimNaoProps {
  label: string
  name: string
  valor: string
  onChange: (valor: string) => void
  incluirNaoInformado?: boolean
  opcoes?: Array<{ valor: string; rotulo: string }>
}

export function RadioSimNao({
  label,
  name,
  valor,
  onChange,
  incluirNaoInformado = true,
  opcoes,
}: SimNaoProps) {
  const lista =
    opcoes ??
    [
      { valor: 'sim', rotulo: 'Sim' },
      { valor: 'nao', rotulo: 'Não' },
      ...(incluirNaoInformado ? [{ valor: '', rotulo: 'Não informado' }] : []),
    ]

  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-slate-700">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {lista.map((o) => {
          const ativo = valor === o.valor
          return (
            <label
              key={o.valor || 'vazio'}
              className={cn(
                'flex min-h-11 cursor-pointer items-center rounded-lg border px-4 text-base',
                ativo
                  ? 'border-marca-600 bg-marca-50 font-medium text-marca-700'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
              )}
            >
              <input
                type="radio"
                name={name}
                value={o.valor}
                checked={ativo}
                onChange={() => onChange(o.valor)}
                className="sr-only"
              />
              {o.rotulo}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Bloco de formulário com título. Agrupa campos relacionados. */
export function SecaoFormulario({
  titulo,
  descricao,
  children,
}: {
  titulo: string
  descricao?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
      {descricao && <p className="mt-0.5 mb-3 text-sm text-slate-500">{descricao}</p>}
      <div className={cn('flex flex-col gap-4', !descricao && 'mt-4')}>{children}</div>
    </section>
  )
}
