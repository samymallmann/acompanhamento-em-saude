import { z } from 'zod'

/* ===========================================================================
   NÍVEL 1 DA VALIDAÇÃO: BLOQUEIO

   As faixas aqui são IDÊNTICAS aos CHECK constraints do banco
   (supabase/migrations/..._schema.sql). A duplicação é intencional:

     Zod   -> mensagem na hora, no campo certo, antes de enviar
     CHECK -> última linha de defesa, vale mesmo se alguém chamar a API direto

   Se um dia mudar uma faixa, mude nos DOIS lugares.

   Faixas propositalmente amplas: barram o fisicamente impossível, não o
   clinicamente alterado. O sistema não interpreta medição.
=========================================================================== */

/** Campo numérico opcional: '' vira null, texto inválido vira erro. */
function numeroOpcional(min: number, max: number, unidade: string) {
  return z
    .union([z.literal(''), z.coerce.number()])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : Number(v)))
    .refine((v) => v === null || Number.isFinite(v), { message: 'Digite apenas números.' })
    .refine((v) => v === null || (v >= min && v <= max), {
      message: `Valor fora da faixa possível (${min} a ${max} ${unidade}).`,
    })
}

const textoOpcional = z
  .string()
  .optional()
  .transform((v) => {
    const limpo = v?.trim()
    return limpo ? limpo : null
  })

/** 'sim' | 'nao' | '' -> true | false | null (Q5: '' = não perguntado). */
const simNaoOpcional = z
  .string()
  .optional()
  .transform((v) => {
    if (v === 'sim') return true
    if (v === 'nao') return false
    return null
  })

export const registroSchema = z
  .object({
    data_atendimento: z
      .string()
      .min(1, 'Informe a data do atendimento.')
      .refine(
        (v) => {
          const data = new Date(`${v}T00:00:00`)
          if (Number.isNaN(data.getTime())) return false
          const hoje = new Date()
          hoje.setHours(23, 59, 59, 999)
          return data <= hoje
        },
        { message: 'A data não pode ser no futuro.' },
      ),

    cond_diabetes: z.boolean(),
    cond_hipertensao: z.boolean(),
    cond_asma: z.boolean(),
    cond_dislipidemia: z.boolean(),
    cond_outros: z.boolean(),
    cond_outros_desc: textoOpcional,

    hf_diabetes: z.boolean(),
    hf_diabetes_quem: textoOpcional,
    hf_hipertensao: z.boolean(),
    hf_hipertensao_quem: textoOpcional,
    hf_asma: z.boolean(),
    hf_asma_quem: textoOpcional,
    hf_outros: z.boolean(),
    hf_outros_desc: textoOpcional,
    hf_outros_quem: textoOpcional,

    usa_medicamentos: simNaoOpcional,
    medicamentos_quais: textoOpcional,
    fumante: simNaoOpcional,
    fumante_passivo: simNaoOpcional,

    pressao_sistolica: numeroOpcional(40, 300, 'mmHg'),
    pressao_diastolica: numeroOpcional(20, 200, 'mmHg'),
    frequencia_cardiaca: numeroOpcional(20, 250, 'bpm'),
    temperatura: numeroOpcional(30, 45, '°C'),
    saturacao: numeroOpcional(50, 100, '%'),
    glicemia: numeroOpcional(10, 900, 'mg/dL'),
    glicemia_jejum: z
      .string()
      .optional()
      .transform((v) => (v === 'Sim' || v === 'Nao' || v === 'NaoSei' ? v : null)),

    descricao: textoOpcional,
  })
  /* --- Regras entre campos. Espelham os CHECK de coerência do banco. ----- */
  .refine((d) => !d.cond_outros || Boolean(d.cond_outros_desc), {
    message: 'Descreva qual é a outra condição.',
    path: ['cond_outros_desc'],
  })
  .refine((d) => !d.hf_outros || Boolean(d.hf_outros_desc), {
    message: 'Descreva qual é a outra condição na família.',
    path: ['hf_outros_desc'],
  })
  .refine((d) => d.usa_medicamentos !== true || Boolean(d.medicamentos_quais), {
    message: 'Informe quais medicamentos.',
    path: ['medicamentos_quais'],
  })
  // Q26: fato físico, não avaliação clínica. Pega 80/120 invertido.
  .refine(
    (d) =>
      d.pressao_sistolica === null ||
      d.pressao_diastolica === null ||
      d.pressao_sistolica > d.pressao_diastolica,
    {
      message: 'A pressão máxima precisa ser maior que a mínima. Confira se não inverteu.',
      path: ['pressao_sistolica'],
    },
  )
  .refine((d) => d.glicemia_jejum === null || d.glicemia !== null, {
    message: 'Informe a glicemia para poder registrar se estava em jejum.',
    path: ['glicemia'],
  })

/* Entrada = o que o formulário produz (tudo string, como vem de um <input>).
   Saída  = o que o Zod devolve depois de converter (números, booleanos, null).

   Derivar de z.input/z.output em vez de escrever à mão garante que os dois
   lados nunca saiam de sincronia com o schema. */
export type RegistroFormEntrada = z.input<typeof registroSchema>
export type RegistroFormSaida = z.output<typeof registroSchema>
