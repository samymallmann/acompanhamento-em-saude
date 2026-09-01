import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from './Button'

/**
 * Modal sem rodapé próprio — para quando o conteúdo é um formulário que já
 * traz os próprios botões. O Modal de confirmação abaixo é o caso oposto:
 * conteúdo simples, botões padronizados.
 */
export function ModalSimples({
  aberto,
  titulo,
  largura = '32rem',
  children,
  onFechar,
}: {
  aberto: boolean
  titulo: string
  largura?: string
  children: ReactNode
  onFechar: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (aberto && !dialog.open) dialog.showModal()
    if (!aberto && dialog.open) dialog.close()
  }, [aberto])

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        onFechar()
      }}
      style={{ width: `min(${largura}, calc(100vw - 2rem))` }}
      className="m-auto rounded-xl border border-slate-200 p-0 backdrop:bg-slate-900/40"
    >
      <div className="flex max-h-[85vh] flex-col overflow-y-auto p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="-mt-1 rounded px-2 py-1 text-xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}

interface Props {
  aberto: boolean
  titulo: string
  children: ReactNode
  rotuloConfirmar?: string
  rotuloCancelar?: string
  varianteConfirmar?: 'primario' | 'perigo'
  carregando?: boolean
  /** Trava o botão de confirmar — usado quando falta digitar a confirmação. */
  confirmarDesabilitado?: boolean
  onConfirmar: () => void
  onCancelar: () => void
}

/**
 * Diálogo de confirmação.
 *
 * Usa o <dialog> nativo do HTML em vez de uma div com position:fixed. Ganhos
 * de graça: foco fica preso dentro do diálogo, Esc fecha, e o resto da página
 * fica inerte para leitores de tela. Reimplementar isso à mão é onde a maioria
 * dos modais caseiros erra em acessibilidade.
 */
export function Modal({
  aberto,
  titulo,
  children,
  rotuloConfirmar = 'Confirmar',
  rotuloCancelar = 'Cancelar',
  varianteConfirmar = 'primario',
  carregando = false,
  confirmarDesabilitado = false,
  onConfirmar,
  onCancelar,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (aberto && !dialog.open) dialog.showModal()
    if (!aberto && dialog.open) dialog.close()
  }, [aberto])

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        // Esc dispara 'cancel'. Interceptamos para o estado do React não
        // ficar dessincronizado do estado real do <dialog>.
        e.preventDefault()
        if (!carregando) onCancelar()
      }}
      className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-xl border border-slate-200 p-0 backdrop:bg-slate-900/40"
    >
      <div className="flex flex-col gap-4 p-5">
        <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
        <div className="text-sm text-slate-600">{children}</div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variante="secundario" onClick={onCancelar} disabled={carregando}>
            {rotuloCancelar}
          </Button>
          <Button
            variante={varianteConfirmar}
            onClick={onConfirmar}
            carregando={carregando}
            disabled={confirmarDesabilitado}
          >
            {rotuloConfirmar}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
