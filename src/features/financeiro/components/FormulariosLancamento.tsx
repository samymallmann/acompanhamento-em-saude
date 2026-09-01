import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Textarea } from '@/components/ui/Campos'
import { Button } from '@/components/ui/Button'
import { Alerta } from '@/components/ui/Feedback'
import { Input } from '@/components/ui/Input'
import { formatarMoeda, mascararMoeda, numeroParaMoeda } from '@/lib/format'
import type { CompraLoteRow, ProdutoEventoRow } from '@/types/database.types'
import {
  compraLoteSchema,
  produtoSchema,
  type CompraLoteFormEntrada,
  type CompraLoteFormSaida,
  type ProdutoFormEntrada,
  type ProdutoFormSaida,
} from '../schemas/financeiro.schema'

/* ===========================================================================
   Formulários de lançamento (F8: aparecem dentro de um modal).

   Ficam num arquivo só porque são pequenos, irmãos e sempre usados juntos na
   mesma tela.
=========================================================================== */

/* ------------------------------- Produto -------------------------------- */

export function ProdutoForm({
  produto,
  salvando,
  erro,
  onSalvar,
  onCancelar,
}: {
  produto?: ProdutoEventoRow
  salvando: boolean
  erro?: string | null
  onSalvar: (dados: ProdutoFormSaida) => void
  onCancelar: () => void
}) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<ProdutoFormEntrada, unknown, ProdutoFormSaida>({
    resolver: zodResolver(produtoSchema),
    defaultValues: { nome: '', quantidade: '1', valor_unitario: '' },
  })

  useEffect(() => {
    if (!produto) return
    reset({
      nome: produto.nome,
      quantidade: String(produto.quantidade),
      valor_unitario: numeroParaMoeda(produto.valor_unitario),
    })
  }, [produto, reset])

  // Subtotal mostrado enquanto ela digita, só como conferência visual.
  // O valor que vale é o calculado pelo banco (coluna GENERATED) — este aqui
  // nunca é enviado nem gravado.
  const vigiados = useWatch({ control })
  const qtd = Number(String(vigiados.quantidade ?? '').replace(/\D/g, '')) || 0
  const unit = Number(String(vigiados.valor_unitario ?? '').replace(/\D/g, '')) / 100 || 0
  const previa = Math.round(qtd * unit * 100) / 100

  return (
    <form onSubmit={handleSubmit(onSalvar)} className="flex flex-col gap-4" noValidate>
      {erro && <Alerta tipo="erro">{erro}</Alerta>}

      <Input
        label="Nome do produto"
        autoFocus
        placeholder="Vaso de flor"
        dica="Para item por peso, use o nome: “2 kg de batata”."
        erro={errors.nome?.message}
        {...register('nome')}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Quantidade"
          type="number"
          inputMode="numeric"
          min={1}
          erro={errors.quantidade?.message}
          {...register('quantidade')}
        />

        <Controller
          control={control}
          name="valor_unitario"
          render={({ field }) => (
            <Input
              label="Valor unitário"
              inputMode="numeric"
              placeholder="0,00"
              erro={errors.valor_unitario?.message}
              value={mascararMoeda(field.value ?? '')}
              onChange={(e) => field.onChange(mascararMoeda(e.target.value))}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
            />
          )}
        />
      </div>

      <div className="rounded-lg bg-slate-100 px-4 py-3">
        <span className="text-sm text-slate-500">Subtotal</span>
        <p className="text-lg font-semibold text-slate-900">{formatarMoeda(previa)}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Calculado automaticamente. Não precisa digitar.
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button variante="secundario" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" carregando={salvando}>
          {produto ? 'Salvar alterações' : 'Adicionar produto'}
        </Button>
      </div>
    </form>
  )
}

/* ---------------------------- Compra em lote ---------------------------- */

export function CompraLoteForm({
  compra,
  salvando,
  erro,
  onSalvar,
  onCancelar,
}: {
  compra?: CompraLoteRow
  salvando: boolean
  erro?: string | null
  onSalvar: (dados: CompraLoteFormSaida) => void
  onCancelar: () => void
}) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CompraLoteFormEntrada, unknown, CompraLoteFormSaida>({
    resolver: zodResolver(compraLoteSchema),
    defaultValues: { descricao: '', texto_nota: '', valor_total: '' },
  })

  useEffect(() => {
    if (!compra) return
    reset({
      descricao: compra.descricao,
      texto_nota: compra.texto_nota ?? '',
      valor_total: numeroParaMoeda(compra.valor_total),
    })
  }, [compra, reset])

  return (
    <form onSubmit={handleSubmit(onSalvar)} className="flex flex-col gap-4" noValidate>
      {erro && <Alerta tipo="erro">{erro}</Alerta>}

      <Input
        label="Descrição da compra"
        autoFocus
        placeholder="Mercado Extra — lembrancinhas"
        erro={errors.descricao?.message}
        {...register('descricao')}
      />

      <Controller
        control={control}
        name="valor_total"
        render={({ field }) => (
          <Input
            label="Valor total da compra"
            inputMode="numeric"
            placeholder="0,00"
            dica="Digitado por você — o sistema não calcula a partir do texto abaixo."
            erro={errors.valor_total?.message}
            value={mascararMoeda(field.value ?? '')}
            onChange={(e) => field.onChange(mascararMoeda(e.target.value))}
            onBlur={field.onBlur}
            name={field.name}
            ref={field.ref}
          />
        )}
      />

      <Textarea
        label="Texto da nota (opcional)"
        rows={8}
        placeholder="Cole aqui a transcrição da nota fiscal…"
        dica="Guardado como comprovante. O sistema não lê nem soma este texto."
        erro={errors.texto_nota?.message}
        {...register('texto_nota')}
      />

      <div className="flex justify-end gap-2">
        <Button variante="secundario" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" carregando={salvando}>
          {compra ? 'Salvar alterações' : 'Adicionar compra'}
        </Button>
      </div>
    </form>
  )
}
