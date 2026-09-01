import { useState } from 'react'
import { EstadoVazio } from '@/components/ui/Feedback'
import { formatarMoeda } from '@/lib/format'
import type { CompraLoteRow, ProdutoEventoRow } from '@/types/database.types'

/* ===========================================================================
   Listas de lançamentos.

   A etiqueta de autor fica no CANTO INFERIOR DIREITO de cada caixa, conforme
   pedido. É preenchida sozinha a partir do created_by — a usuária nunca
   digita quem lançou.
=========================================================================== */

function EtiquetaAutor({ email }: { email: string }) {
  return (
    <span className="text-xs text-slate-400" title="Preenchido automaticamente">
      by {email}
    </span>
  )
}

function BotoesLinha({
  onEditar,
  onExcluir,
}: {
  onEditar: () => void
  onExcluir: () => void
}) {
  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={onEditar}
        className="rounded px-2 py-1 text-sm text-marca-700 hover:bg-marca-50"
      >
        editar
      </button>
      <button
        type="button"
        onClick={onExcluir}
        aria-label="Excluir"
        className="rounded px-2 py-1 text-sm text-red-700 hover:bg-red-50"
      >
        excluir
      </button>
    </div>
  )
}

export function ListaProdutos({
  produtos,
  autorDe,
  onEditar,
  onExcluir,
}: {
  produtos: ProdutoEventoRow[]
  autorDe: (userId: string) => string
  onEditar: (p: ProdutoEventoRow) => void
  onExcluir: (p: ProdutoEventoRow) => void
}) {
  if (produtos.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhum produto lançado"
        descricao="Itens comprados um a um aparecem aqui."
      />
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {produtos.map((p) => (
        <li key={p.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-slate-900">{p.nome}</p>
              <p className="mt-0.5 text-sm text-slate-500">
                {p.quantidade} × {formatarMoeda(p.valor_unitario)}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-900">{formatarMoeda(p.subtotal)}</p>
            </div>
          </div>

          {/* Rodapé da caixa: ações à esquerda, autor no canto inferior direito. */}
          <div className="mt-2 flex items-end justify-between gap-2 border-t border-slate-100 pt-2">
            <BotoesLinha onEditar={() => onEditar(p)} onExcluir={() => onExcluir(p)} />
            <EtiquetaAutor email={autorDe(p.created_by)} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function ListaComprasLote({
  compras,
  autorDe,
  onEditar,
  onExcluir,
}: {
  compras: CompraLoteRow[]
  autorDe: (userId: string) => string
  onEditar: (c: CompraLoteRow) => void
  onExcluir: (c: CompraLoteRow) => void
}) {
  const [abertas, setAbertas] = useState<Set<string>>(new Set())

  function alternar(id: string) {
    setAbertas((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  if (compras.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhuma compra em lote"
        descricao="Compras de várias coisas de uma vez aparecem aqui, sem detalhar item por item."
      />
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {compras.map((c) => {
        const aberta = abertas.has(c.id)
        return (
          <li key={c.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="min-w-0 font-medium text-slate-900">{c.descricao}</p>
              <p className="font-semibold text-slate-900">{formatarMoeda(c.valor_total)}</p>
            </div>

            {/* O texto da nota fica recolhido: uma transcrição de cupom ocupa
                muitas linhas e empurraria o resto da tela para baixo. */}
            {c.texto_nota && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => alternar(c.id)}
                  aria-expanded={aberta}
                  className="text-sm text-marca-700 hover:underline"
                >
                  {aberta ? '▾ ocultar texto da nota' : '▸ ver texto da nota'}
                </button>
                {aberta && (
                  <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-50 p-3 text-xs whitespace-pre-wrap text-slate-700">
                    {c.texto_nota}
                  </pre>
                )}
              </div>
            )}

            <div className="mt-2 flex items-end justify-between gap-2 border-t border-slate-100 pt-2">
              <BotoesLinha onEditar={() => onEditar(c)} onExcluir={() => onExcluir(c)} />
              <EtiquetaAutor email={autorDe(c.created_by)} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function ResumoTotais({
  produtos,
  lotes,
  geral,
}: {
  produtos: number
  lotes: number
  geral: number
}) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
      <div>
        <p className="text-xs text-slate-500">Produtos individuais</p>
        <p className="text-lg font-medium text-slate-800">{formatarMoeda(produtos)}</p>
      </div>
      <div>
        <p className="text-xs text-slate-500">Compras em lote</p>
        <p className="text-lg font-medium text-slate-800">{formatarMoeda(lotes)}</p>
      </div>
      <div className="col-span-2 border-t border-slate-100 pt-3 sm:col-span-1 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
        <p className="text-xs font-medium text-slate-500">Total do evento</p>
        <p className="text-2xl font-semibold text-slate-900">{formatarMoeda(geral)}</p>
      </div>
    </div>
  )
}
