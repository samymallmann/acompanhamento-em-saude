import { differenceInYears, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { JejumEnum } from '@/types/database.types'

/* ---------------------------------------------------------------------------
   Formatação para exibição (Q15: dd/mm/aaaa, português do Brasil).

   Regra geral do projeto: o banco guarda DADO, a tela mostra TEXTO.
   Toda conversão acontece aqui, num lugar só. Se um dia o formato mudar,
   muda-se aqui e o sistema inteiro acompanha.
--------------------------------------------------------------------------- */

/** '2026-08-23' -> '23/08/2026' */
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—'
  // Datas puras (date do Postgres) não têm fuso. Se usássemos new Date('2026-08-23'),
  // o JavaScript interpretaria como UTC meia-noite e, no horário de Brasília
  // (UTC-3), exibiria 22/08. Por isso parseISO + string 'yyyy-MM-dd'.
  return format(parseISO(iso), 'dd/MM/yyyy', { locale: ptBR })
}

/** timestamptz -> '23/08/2026 às 14:30' */
export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  return format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

/** Idade em anos completos, a partir da data de nascimento. */
export function calcularIdade(nascimento: string | null | undefined): number | null {
  if (!nascimento) return null
  return differenceInYears(new Date(), parseISO(nascimento))
}

/** 120 e 80 -> '120/80 mmHg'. Guardado em duas colunas, exibido junto. */
export function formatarPressao(
  sistolica: number | null | undefined,
  diastolica: number | null | undefined,
): string {
  if (sistolica == null || diastolica == null) return '—'
  return `${sistolica}/${diastolica} mmHg`
}

/** Number com unidade, ou travessão quando não foi medido. */
export function formatarMedida(valor: number | null | undefined, unidade: string): string {
  if (valor == null) return '—'
  return `${String(valor).replace('.', ',')} ${unidade}`
}

/**
 * Sim/Não/Não sei/não perguntado.
 *
 * A distinção importa: `null` significa que a pergunta NÃO FOI FEITA, o que é
 * diferente de a pessoa ter respondido "Não" (decisão da Q5). Mostrar os dois
 * casos como "Não" apagaria informação real.
 */
export function formatarSimNao(valor: boolean | null | undefined): string {
  if (valor == null) return 'Não informado'
  return valor ? 'Sim' : 'Não'
}

export function formatarJejum(valor: JejumEnum | null | undefined): string {
  if (valor == null) return 'Não informado'
  const mapa: Record<JejumEnum, string> = {
    Sim: 'Em jejum',
    Nao: 'Não estava em jejum',
    NaoSei: 'Não soube informar',
  }
  return mapa[valor]
}

export function formatarGenero(valor: string | null | undefined): string {
  return valor ?? '—'
}

/* -------------------------------------------------------------------------
   Telefone

   DECISÃO: o banco guarda SÓ OS DÍGITOS ('92988881111'); os parênteses e o
   traço são coisa de exibição.

   Por quê: se o formato fosse gravado, o mesmo número poderia existir como
   '(92) 98888-1111', '92 98888-1111' e '92988881111' — três textos diferentes
   para a mesma pessoa, e qualquer busca ou comparação futura falharia. Guardar
   o dado cru e formatar na hora de mostrar é a regra geral: o banco guarda
   DADO, a tela mostra TEXTO.
------------------------------------------------------------------------- */

export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

/**
 * Aplica a máscara conforme a pessoa digita.
 * Aceita fixo (10 dígitos) e celular (11), e ignora qualquer letra.
 */
export function mascararTelefone(valor: string): string {
  const d = apenasDigitos(valor).slice(0, 11)

  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  // 10 dígitos = fixo: (92) 3234-5678
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  // 11 dígitos = celular: (92) 98888-1111
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/**
 * Telefone para exibição.
 * Passa pelo apenasDigitos antes, então também formata corretamente valores
 * antigos que tenham sido gravados já com pontuação.
 */
export function formatarTelefone(valor: string | null | undefined): string {
  if (!valor) return '—'
  const formatado = mascararTelefone(valor)
  return formatado || '—'
}

/* -------------------------------------------------------------------------
   Dinheiro

   Mesma ideia da máscara de telefone: a usuária digita só números e a
   pontuação aparece sozinha. Digitar `1290` mostra `R$ 12,90`.

   Sem isso, ela teria que acertar vírgula e ponto na mão, e "12.90" versus
   "12,90" viraria fonte constante de erro — em português a vírgula é o
   separador decimal, mas o JavaScript só entende ponto.

   O que vai para o banco é sempre o número limpo (12.9), em `numeric`.
------------------------------------------------------------------------- */

/** 12.9 -> 'R$ 12,90'. Usa o formatador nativo, que já sabe a regra do pt-BR. */
export function formatarMoeda(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  const numero = typeof valor === 'string' ? Number(valor) : valor
  if (!Number.isFinite(numero)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numero)
}

/**
 * Máscara enquanto digita: trata o que foi digitado como CENTAVOS.
 * '1'->'0,01'  '12'->'0,12'  '1290'->'12,90'
 *
 * Pensar em centavos evita o problema clássico do campo de dinheiro, em que a
 * pessoa apaga a vírgula sem querer e R$ 12,90 vira R$ 1290,00.
 */
export function mascararMoeda(valor: string): string {
  const digitos = apenasDigitos(valor).slice(0, 12)
  if (digitos === '') return ''
  const centavos = Number(digitos)
  const reais = Math.floor(centavos / 100)
  const resto = String(centavos % 100).padStart(2, '0')
  return `${reais.toLocaleString('pt-BR')},${resto}`
}

/** '12,90' (o que está no campo) -> 12.9 (o que vai para o banco). */
export function moedaParaNumero(valor: string): number | null {
  const digitos = apenasDigitos(valor)
  if (digitos === '') return null
  // Divide por 100 e arredonda em 2 casas: o campo trabalha em centavos, então
  // aqui não há resíduo de ponto flutuante para aparecer.
  return Math.round(Number(digitos)) / 100
}

/** 12.9 (vindo do banco) -> '12,90' (para preencher o campo ao editar). */
export function numeroParaMoeda(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return ''
  const numero = typeof valor === 'string' ? Number(valor) : valor
  if (!Number.isFinite(numero)) return ''
  return mascararMoeda(String(Math.round(numero * 100)))
}

/**
 * Normaliza texto para busca: minúsculas e sem acento.
 * Serve para comparar 'José' com 'jose' no lado do cliente.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}
