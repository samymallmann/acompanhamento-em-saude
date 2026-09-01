/* ===========================================================================
   NÍVEL 2 DA VALIDAÇÃO: AVISO (Q10 / Q27)

   Duas camadas, propósitos diferentes:

     BLOQUEIO  faixa ampla    impede salvar   check no banco + Zod
     AVISO     faixa estreita pede confirmar  SÓ aqui, na interface

   O aviso vive só no frontend porque um banco de dados não tem o conceito de
   "avisar" — um CHECK só sabe aceitar ou recusar.

   ⚠️  CUIDADO CENTRAL, e o motivo de as faixas serem largas:

   O critério NÃO é "clinicamente normal". É "plausível de ter sido digitado
   errado". Se a faixa apertar demais, o aviso deixa de pegar erro de digitação
   e vira alerta clínico disfarçado — que é exatamente o que este sistema NÃO
   faz. Um idoso hipertenso com sistólica 190 é um valor real e esperado para
   ele; avisar toda visita seria o sistema opinando sobre a saúde da pessoa.

   E tem o efeito prático: aviso que aparece sempre vira ruído, a usuária passa
   a clicar "confirmar" no automático, e a proteção deixa de funcionar
   justamente quando seria útil.

   Por isso o texto também fala de DIGITAÇÃO, nunca de saúde (Q28).
=========================================================================== */

export interface FaixaAviso {
  min: number
  max: number
  rotulo: string
  unidade: string
}

export const FAIXAS_AVISO: Record<string, FaixaAviso> = {
  pressao_sistolica: { min: 70, max: 220, rotulo: 'Pressão sistólica', unidade: 'mmHg' },
  pressao_diastolica: { min: 40, max: 130, rotulo: 'Pressão diastólica', unidade: 'mmHg' },
  frequencia_cardiaca: { min: 40, max: 150, rotulo: 'Frequência cardíaca', unidade: 'bpm' },
  temperatura: { min: 34, max: 40, rotulo: 'Temperatura', unidade: '°C' },
  saturacao: { min: 85, max: 100, rotulo: 'Saturação', unidade: '%' },
  glicemia: { min: 40, max: 400, rotulo: 'Glicemia capilar', unidade: 'mg/dL' },
}

export interface AvisoValor {
  campo: string
  rotulo: string
  valor: number
  unidade: string
}

/** Texto curto mostrado embaixo do campo. Fala de digitação, não de saúde. */
export function avisoDoCampo(campo: string, valor: unknown): string | undefined {
  const faixa = FAIXAS_AVISO[campo]
  if (!faixa) return undefined

  const numero = paraNumero(valor)
  if (numero === null) return undefined
  if (numero >= faixa.min && numero <= faixa.max) return undefined

  return 'Valor incomum. Confirme se foi digitado corretamente.'
}

/** Todos os avisos pendentes do formulário, para o modal de confirmação. */
export function coletarAvisos(valores: Record<string, unknown>): AvisoValor[] {
  const avisos: AvisoValor[] = []

  for (const [campo, faixa] of Object.entries(FAIXAS_AVISO)) {
    const numero = paraNumero(valores[campo])
    if (numero === null) continue
    if (numero >= faixa.min && numero <= faixa.max) continue

    avisos.push({ campo, rotulo: faixa.rotulo, valor: numero, unidade: faixa.unidade })
  }

  return avisos
}

function paraNumero(valor: unknown): number | null {
  if (valor === '' || valor === null || valor === undefined) return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}
