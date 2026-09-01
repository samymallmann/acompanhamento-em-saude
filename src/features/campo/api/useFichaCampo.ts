import { useMutation } from '@tanstack/react-query'
import { listarAutores } from '@/features/acessos/api/autores'
import { supabase } from '@/lib/supabase'
import type { AtendidoFicha, CampoCadastro, RegistroFicha, UsuarioFicha } from '../fichaCampo'
import { gerarFichaCampo } from '../fichaCampo'

/* ===========================================================================
   Montagem da ficha de campo.

   Uma versão só, com tudo que o atendimento precisa: cadastro, quais campos
   estão faltando, e o histórico de cada pessoa.

   Os `select` continuam listando as colunas uma a uma, e isso não é estilo. É
   o que garante que só o que foi decidido sai do sistema: um `select('*')`
   aqui levaria junto qualquer coluna que alguém acrescente no futuro, para
   dentro de um arquivo que circula por mensagem, sem ninguém perceber.
=========================================================================== */

type IdosoBase = {
  id: string
  nome: string
  data_nascimento: string | null
  genero: string | null
  telefone: string | null
  endereco: string | null
}

async function buscarAtendidos(): Promise<IdosoBase[]> {
  const { data, error } = await supabase
    .from('idosos')
    .select('id, nome, data_nascimento, genero, telefone, endereco')
    .eq('ativo', true)
    .order('nome')

  if (error) {
    console.error('[ficha-campo] falha ao buscar atendidos:', error)
    throw error
  }
  return (data ?? []) as IdosoBase[]
}

/**
 * Quais campos do cadastro estão vazios.
 *
 * Isto é o que vai na ficha de coleta no lugar dos valores. A ficha consegue
 * pedir "o telefone da dona Terezinha está faltando" sem levar o telefone de
 * ninguém — e telefone e endereço de todos os atendidos é exatamente o tipo de
 * coisa que não deveria circular num arquivo enviado por mensagem.
 */
function camposFaltando(i: IdosoBase): CampoCadastro[] {
  const faltando: CampoCadastro[] = []
  if (!i.data_nascimento) faltando.push('nascimento')
  if (!i.genero) faltando.push('genero')
  if (!i.telefone) faltando.push('telefone')
  if (!i.endereco) faltando.push('endereco')
  return faltando
}

/** Campos do histórico. Repetido à mão pelo mesmo motivo do select acima. */
const CAMPOS_HISTORICO = [
  'idoso_id',
  'data_atendimento',
  'cond_diabetes',
  'cond_hipertensao',
  'cond_asma',
  'cond_dislipidemia',
  'cond_outros',
  'cond_outros_desc',
  'hf_diabetes',
  'hf_diabetes_quem',
  'hf_hipertensao',
  'hf_hipertensao_quem',
  'hf_asma',
  'hf_asma_quem',
  'hf_outros',
  'hf_outros_desc',
  'hf_outros_quem',
  'usa_medicamentos',
  'medicamentos_quais',
  'fumante',
  'fumante_passivo',
  'pressao_sistolica',
  'pressao_diastolica',
  'frequencia_cardiaca',
  'temperatura',
  'saturacao',
  'glicemia',
  'glicemia_jejum',
  'descricao',
].join(', ')

async function buscarHistorico(): Promise<Map<string, RegistroFicha[]>> {
  const { data, error } = await supabase
    .from('registros')
    .select(CAMPOS_HISTORICO)
    .eq('ativo', true)
    // Mais recente primeiro: o primeiro de cada pessoa é o que pré-preenche o
    // formulário, mesma regra do prefill.ts.
    .order('data_atendimento', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[ficha-campo] falha ao buscar histórico:', error)
    throw error
  }

  const porIdoso = new Map<string, RegistroFicha[]>()
  for (const linha of (data ?? []) as unknown as (RegistroFicha & { idoso_id: string; data_atendimento: string })[]) {
    const { idoso_id, data_atendimento, ...resto } = linha
    const lista = porIdoso.get(idoso_id) ?? []
    lista.push({ ...resto, data: data_atendimento } as RegistroFicha)
    porIdoso.set(idoso_id, lista)
  }
  return porIdoso
}

function baixar(html: string, nome: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  // Sem o revoke, o arquivo inteiro fica preso na memória da aba até ela ser
  // fechada — e a versão completa não é pequena.
  URL.revokeObjectURL(url)
}

export function useGerarFichaCampo() {
  return useMutation({
    mutationFn: async () => {
      const base = await buscarAtendidos()

      // A equipe vai embutida para o campo "quem está anotando" ser uma lista
      // em vez de texto livre. Só nome e identificador — nada de e-mail.
      const usuarios: UsuarioFicha[] = (await listarAutores())
        .filter((a) => a.nome)
        .map((a) => ({ user_id: a.user_id, nome: a.nome! }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

      const historico = await buscarHistorico()

      const atendidos: AtendidoFicha[] = base.map((i) => ({
        id: i.id,
        nome: i.nome,
        nascimento: i.data_nascimento,
        faltando: camposFaltando(i),
        cadastro: { genero: i.genero, telefone: i.telefone, endereco: i.endereco },
        historico: historico.get(i.id) ?? [],
      }))

      const geradoEm = new Date()
      const html = gerarFichaCampo(atendidos, { geradoEm, usuarios })

      const dia = geradoEm.toISOString().slice(0, 10)
      baixar(html, `ficha-de-campo-${dia}.html`)

      return { quantidade: atendidos.length }
    },
  })
}
