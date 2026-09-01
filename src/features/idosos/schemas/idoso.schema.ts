import { z } from 'zod'
import { apenasDigitos } from '@/lib/format'

/* ---------------------------------------------------------------------------
   Validação do cadastro do idoso (Q6: só o nome é obrigatório).

   Padrão usado em todo o projeto para campo opcional de texto:
   `.transform(v => v?.trim() || null)` — string vazia vira null.
   Motivo: '' e null significam a mesma coisa ("não preenchido"), e deixar os
   dois conviverem no banco cria consultas que precisam testar as duas formas.
--------------------------------------------------------------------------- */

const textoOpcional = z
  .string()
  .optional()
  .transform((v) => {
    const limpo = v?.trim()
    return limpo ? limpo : null
  })

export const idosoSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, 'O nome é obrigatório.')
    .max(200, 'Nome muito longo.'),

  data_nascimento: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : null))
    .refine(
      (v) => {
        if (!v) return true
        const data = new Date(`${v}T00:00:00`)
        if (Number.isNaN(data.getTime())) return false
        const hoje = new Date()
        hoje.setHours(23, 59, 59, 999)
        // Mesma faixa do check no banco. Duplicar aqui não é redundância inútil:
        // o Zod dá a mensagem na hora, o banco garante que nada entre torto por
        // outro caminho. Camadas diferentes, propósitos diferentes.
        return data <= hoje && data > new Date('1900-01-01')
      },
      { message: 'Data inválida. Use uma data entre 1900 e hoje.' },
    ),

  genero: z
    .enum(['Feminino', 'Masculino', 'Outros'])
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),

  /* Telefone: guarda só os dígitos. A máscara é aplicada na tela.
     Aceita vazio (Q6: só o nome é obrigatório), fixo (10 dígitos) ou celular
     (11). Qualquer letra some no apenasDigitos antes da checagem, então não
     existe "telefone com letra" — ele simplesmente não entra. */
  telefone: z
    .string()
    .optional()
    .transform((v) => apenasDigitos(v ?? ''))
    .refine((v) => v === '' || v.length === 10 || v.length === 11, {
      message: 'Telefone incompleto. Use DDD + número (10 ou 11 dígitos).',
    })
    .transform((v) => (v === '' ? null : v)),

  endereco: textoOpcional,
})

export type IdosoFormEntrada = z.input<typeof idosoSchema>
export type IdosoFormSaida = z.output<typeof idosoSchema>
