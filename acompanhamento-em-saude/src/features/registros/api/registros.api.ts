import { supabase } from '@/lib/supabase'
import type { RegistroRow } from '@/types/database.types'

/** Campos de um registro que a usuária preenche (sem id/auditoria). */
export type DadosRegistro = Omit<
  RegistroRow,
  'id' | 'created_by' | 'created_at' | 'updated_by' | 'updated_at' | 'ativo'
>

/**
 * Histórico do idoso, do mais recente para o mais antigo.
 *
 * A ordenação casa exatamente com o índice registros_idoso_data_idx
 * (idoso_id, data_atendimento desc, created_at desc). O desempate por
 * created_at importa quando há dois atendimentos no mesmo dia.
 */
export async function listarRegistros(idosoId: string): Promise<RegistroRow[]> {
  const { data, error } = await supabase
    .from('registros')
    .select('*')
    .eq('idoso_id', idosoId)
    .eq('ativo', true)
    .order('data_atendimento', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[registros] falha ao listar:', error)
    throw error
  }
  return data ?? []
}

/**
 * Registro mais recente — base do pré-preenchimento.
 *
 * `maybeSingle()` em vez de `single()`: no primeiro atendimento não existe
 * registro anterior, e isso é normal, não erro. `single()` lançaria exceção
 * onde a resposta correta é "não há nenhum".
 */
export async function buscarUltimoRegistro(idosoId: string): Promise<RegistroRow | null> {
  const { data, error } = await supabase
    .from('registros')
    .select('*')
    .eq('idoso_id', idosoId)
    .eq('ativo', true)
    .order('data_atendimento', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[registros] falha ao buscar o último:', error)
    throw error
  }
  return data
}

export async function buscarRegistro(id: string): Promise<RegistroRow | null> {
  const { data, error } = await supabase
    .from('registros')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data
}

/**
 * Cria um registro NOVO. Nunca sobrescreve o anterior — é a regra central do
 * sistema. Não existe caminho no código que atualize um registro no lugar de
 * criar outro.
 */
export async function criarRegistro(
  dados: DadosRegistro,
  userId: string,
): Promise<RegistroRow> {
  const { data, error } = await supabase
    .from('registros')
    .insert({ ...dados, created_by: userId })
    .select()
    .single()

  if (error) {
    console.error('[registros] falha ao criar:', error)
    throw error
  }
  return data
}

/**
 * Edita um registro já salvo (Q2).
 *
 * A decisão foi permitir edição sempre, com confirmação na interface e SEM
 * versionamento: o valor anterior não é recuperável. O que fica registrado é
 * updated_at/updated_by, pelo trigger — o sistema sabe QUE mudou, QUANDO e por
 * QUEM, mas não o quê. Se um dia isso incomodar, dá para adicionar uma tabela
 * registros_historico alimentada por trigger sem mexer em nada disto aqui.
 */
export async function atualizarRegistro(
  id: string,
  dados: DadosRegistro,
): Promise<RegistroRow> {
  const { data, error } = await supabase
    .from('registros')
    .update(dados)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[registros] falha ao atualizar:', error)
    throw error
  }
  return data
}
