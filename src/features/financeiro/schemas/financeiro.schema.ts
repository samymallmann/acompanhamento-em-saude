import { z } from 'zod'
import { moedaParaNumero } from '@/lib/format'

/* ===========================================================================
   Validação do módulo financeiro.

   As faixas espelham os CHECK do banco, como no resto do projeto: o Zod dá a
   mensagem na hora, o banco é a última linha de defesa.
=========================================================================== */

/** Campo de dinheiro: chega como '12,90' e sai como 12.9. */
const dinheiroObrigatorio = z
  .string()
  .transform((v) => moedaParaNumero(v))
  .refine((v) => v !== null, { message: 'Informe o valor.' })
  // F10: zero é permitido (brinde, doação). Negativo não existe — a máscara
  // nem deixa digitar sinal, mas a checagem fica registrada mesmo assim.
  .refine((v) => v === null || v >= 0, { message: 'O valor não pode ser negativo.' })
  .transform((v) => v as number)

export const eventoSchema = z.object({
  nome: z.string().trim().min(1, 'O nome do evento é obrigatório.').max(200, 'Nome muito longo.'),

  // F9: sem restrição de data futura — cadastrar um evento antes de ele
  // acontecer é o uso normal. Diferente do atendimento, que não pode ser
  // lançado no futuro porque ainda não aconteceu.
  data_evento: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : null))
    .refine((v) => v === null || !Number.isNaN(new Date(`${v}T00:00:00`).getTime()), {
      message: 'Data inválida.',
    }),
})

export const produtoSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, 'O nome do produto é obrigatório.')
    .max(200, 'Nome muito longo.'),

  // F7: inteiro positivo. Item por peso vai com a unidade no nome
  // ("2 kg de batata") e quantidade 1.
  quantidade: z
    .string()
    .min(1, 'Informe a quantidade.')
    .transform((v) => Number(v.replace(/\D/g, '')))
    .refine((v) => Number.isInteger(v) && v > 0, {
      message: 'A quantidade precisa ser um número inteiro maior que zero.',
    }),

  valor_unitario: dinheiroObrigatorio,
})

export const compraLoteSchema = z.object({
  // F6: obrigatória — sem ela a lista vira uma sequência de valores sem
  // identificação, inútil para conferir depois.
  descricao: z
    .string()
    .trim()
    .min(1, 'A descrição é obrigatória.')
    .max(200, 'Descrição muito longa.'),

  // F5: opcional — a nota pode estar ilegível ou não ter sido fotografada,
  // e isso não deve travar o lançamento.
  texto_nota: z
    .string()
    .optional()
    .transform((v) => {
      const limpo = v?.trim()
      return limpo ? limpo : null
    }),

  valor_total: dinheiroObrigatorio,
})

export type EventoFormEntrada = z.input<typeof eventoSchema>
export type EventoFormSaida = z.output<typeof eventoSchema>
export type ProdutoFormEntrada = z.input<typeof produtoSchema>
export type ProdutoFormSaida = z.output<typeof produtoSchema>
export type CompraLoteFormEntrada = z.input<typeof compraLoteSchema>
export type CompraLoteFormSaida = z.output<typeof compraLoteSchema>
