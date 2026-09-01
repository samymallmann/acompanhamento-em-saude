import type { RegistroRow } from '@/types/database.types'
import type { RegistroFormEntrada } from '../schemas/registro.schema'

/* ===========================================================================
   PRÉ-PREENCHIMENTO — a regra mais sutil do sistema.

   Ao abrir "+ Adicionar registro", buscamos o atendimento mais recente e
   copiamos apenas o que descreve a SITUAÇÃO da pessoa. O que é MEDIÇÃO daquele
   dia começa sempre vazio.

     COPIA (editável)        NUNCA COPIA (sempre vazio)
     ─────────────────       ──────────────────────────
     condições de saúde      pressão sistólica
     histórico familiar      pressão diastólica
     medicamentos            frequência cardíaca
     tabagismo               temperatura
                             saturação
                             glicemia
                             em jejum?
                             descrição / observação

   Por que separado num arquivo próprio, sem React: é lógica pura (entra o
   último registro, sai o objeto de valores iniciais). Isolada assim, ela é
   testável sem renderizar nada — e é justamente a regra que mais dói se
   quebrar em silêncio. Copiar uma pressão antiga para um atendimento novo
   seria registrar uma medição que nunca aconteceu.
=========================================================================== */

/** Valores de um formulário totalmente em branco (primeiro atendimento). */
export function registroVazio(): RegistroFormEntrada {
  return {
    data_atendimento: hoje(),

    cond_diabetes: false,
    cond_hipertensao: false,
    cond_asma: false,
    cond_dislipidemia: false,
    cond_outros: false,
    cond_outros_desc: '',

    hf_diabetes: false,
    hf_diabetes_quem: '',
    hf_hipertensao: false,
    hf_hipertensao_quem: '',
    hf_asma: false,
    hf_asma_quem: '',
    hf_outros: false,
    hf_outros_desc: '',
    hf_outros_quem: '',

    usa_medicamentos: '',
    medicamentos_quais: '',
    fumante: '',
    fumante_passivo: '',

    pressao_sistolica: '',
    pressao_diastolica: '',
    frequencia_cardiaca: '',
    temperatura: '',
    saturacao: '',
    glicemia: '',
    glicemia_jejum: '',

    descricao: '',
  }
}

/**
 * Valores iniciais para um registro NOVO, a partir do último atendimento.
 * Se não houver anterior, devolve tudo vazio.
 */
export function preencherDoUltimo(ultimo: RegistroRow | null): RegistroFormEntrada {
  const vazio = registroVazio()
  if (!ultimo) return vazio

  return {
    ...vazio,

    // --- Copiado: descreve a situação da pessoa, não o atendimento ---------
    cond_diabetes: ultimo.cond_diabetes,
    cond_hipertensao: ultimo.cond_hipertensao,
    cond_asma: ultimo.cond_asma,
    cond_dislipidemia: ultimo.cond_dislipidemia,
    cond_outros: ultimo.cond_outros,
    cond_outros_desc: ultimo.cond_outros_desc ?? '',

    hf_diabetes: ultimo.hf_diabetes,
    hf_diabetes_quem: ultimo.hf_diabetes_quem ?? '',
    hf_hipertensao: ultimo.hf_hipertensao,
    hf_hipertensao_quem: ultimo.hf_hipertensao_quem ?? '',
    hf_asma: ultimo.hf_asma,
    hf_asma_quem: ultimo.hf_asma_quem ?? '',
    hf_outros: ultimo.hf_outros,
    hf_outros_desc: ultimo.hf_outros_desc ?? '',
    hf_outros_quem: ultimo.hf_outros_quem ?? '',

    usa_medicamentos: booleanParaRadio(ultimo.usa_medicamentos),
    medicamentos_quais: ultimo.medicamentos_quais ?? '',
    fumante: booleanParaRadio(ultimo.fumante),
    fumante_passivo: booleanParaRadio(ultimo.fumante_passivo),

    // --- NÃO copiado ------------------------------------------------------
    // Os campos de medição, o "em jejum?" e a descrição ficam como estão em
    // `vazio`, espalhado acima. Não os repita aqui: a ausência deles neste
    // objeto É a regra sendo aplicada.
  }
}

/** Valores para EDITAR um registro existente — aí sim tudo é carregado. */
export function preencherParaEdicao(registro: RegistroRow): RegistroFormEntrada {
  return {
    data_atendimento: registro.data_atendimento,

    cond_diabetes: registro.cond_diabetes,
    cond_hipertensao: registro.cond_hipertensao,
    cond_asma: registro.cond_asma,
    cond_dislipidemia: registro.cond_dislipidemia,
    cond_outros: registro.cond_outros,
    cond_outros_desc: registro.cond_outros_desc ?? '',

    hf_diabetes: registro.hf_diabetes,
    hf_diabetes_quem: registro.hf_diabetes_quem ?? '',
    hf_hipertensao: registro.hf_hipertensao,
    hf_hipertensao_quem: registro.hf_hipertensao_quem ?? '',
    hf_asma: registro.hf_asma,
    hf_asma_quem: registro.hf_asma_quem ?? '',
    hf_outros: registro.hf_outros,
    hf_outros_desc: registro.hf_outros_desc ?? '',
    hf_outros_quem: registro.hf_outros_quem ?? '',

    usa_medicamentos: booleanParaRadio(registro.usa_medicamentos),
    medicamentos_quais: registro.medicamentos_quais ?? '',
    fumante: booleanParaRadio(registro.fumante),
    fumante_passivo: booleanParaRadio(registro.fumante_passivo),

    pressao_sistolica: numeroParaCampo(registro.pressao_sistolica),
    pressao_diastolica: numeroParaCampo(registro.pressao_diastolica),
    frequencia_cardiaca: numeroParaCampo(registro.frequencia_cardiaca),
    temperatura: numeroParaCampo(registro.temperatura),
    saturacao: numeroParaCampo(registro.saturacao),
    glicemia: numeroParaCampo(registro.glicemia),
    glicemia_jejum: registro.glicemia_jejum ?? '',

    descricao: registro.descricao ?? '',
  }
}

/* -------------------------------------------------------------------------
   Conversões entre banco e formulário
------------------------------------------------------------------------- */

/**
 * boolean|null do banco -> valor do grupo de rádio.
 * `null` (não perguntado) vira '' — a terceira opção, "Não informado".
 */
function booleanParaRadio(valor: boolean | null): string {
  if (valor === null) return ''
  return valor ? 'sim' : 'nao'
}

function numeroParaCampo(valor: number | null): string {
  return valor === null ? '' : String(valor)
}

function hoje(): string {
  // Formato yyyy-MM-dd exigido pelo <input type="date">, no fuso local.
  // Usar toISOString() aqui daria a data em UTC e, à noite no horário de
  // Brasília, o campo abriria já com a data de amanhã.
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}
