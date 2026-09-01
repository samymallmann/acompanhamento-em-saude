import { supabase } from '@/lib/supabase'
import type { IdosoRow } from '@/types/database.types'

/* ---------------------------------------------------------------------------
   Acesso ao banco para a feature "idosos".

   Por que isolar as consultas aqui, em vez de chamar o supabase direto no
   componente: a tela passa a não saber como o dado é buscado. Se um dia a
   busca virar uma RPC no Postgres, muda-se só este arquivo.
--------------------------------------------------------------------------- */

/** Lista idosos ATIVOS. Inativos (soft delete) nunca aparecem aqui — Q3. */
export async function listarIdosos(busca: string): Promise<IdosoRow[]> {
  let query = supabase
    .from('idosos')
    .select('*')
    .eq('ativo', true)
    .order('nome', { ascending: true })

  const termo = busca.trim()
  if (termo) {
    // ilike = LIKE sem diferenciar maiúscula de minúscula.
    // Limitação conhecida: é sensível a acento ('jose' não acha 'José').
    // Com poucas centenas de linhas, resolver isso exigiria a extensão unaccent
    // e uma função imutável — complexidade que só se paga quando a base cresce.
    // Está documentado em docs/01-arquitetura-e-modelagem.md (§1.3).
    query = query.ilike('nome', `%${termo}%`)
  }

  const { data, error } = await query
  if (error) {
    // Loga o objeto cru no console do navegador (F12). A tela mostra uma
    // mensagem tratada; aqui fica o detalhe completo para depurar.
    console.error('[idosos] falha ao listar:', error)
    throw error
  }
  return data ?? []
}

/** Busca um idoso pelo id, inclusive inativo (link direto continua funcionando). */
export async function buscarIdoso(id: string): Promise<IdosoRow | null> {
  const { data, error } = await supabase.from('idosos').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

/**
 * Procura nomes parecidos, para AVISAR sobre possível duplicidade (Q7).
 * Nunca bloqueia: duas pessoas podem legitimamente ter o mesmo nome.
 */
export async function buscarNomesParecidos(nome: string): Promise<IdosoRow[]> {
  const termo = nome.trim()
  if (termo.length < 3) return []

  const { data, error } = await supabase
    .from('idosos')
    .select('*')
    .eq('ativo', true)
    .ilike('nome', `%${termo}%`)
    .limit(5)

  if (error) throw error
  return data ?? []
}

/* --------------------------------------------------------------------------
   Escrita
-------------------------------------------------------------------------- */

export interface DadosIdoso {
  nome: string
  data_nascimento: string | null
  genero: 'Feminino' | 'Masculino' | 'Outros' | null
  telefone: string | null
  endereco: string | null
}

export async function criarIdoso(dados: DadosIdoso, userId: string): Promise<IdosoRow> {
  // created_by explícito: a policy de INSERT exige created_by = auth.uid().
  // O default do banco já resolveria, mas mandar explícito deixa a regra
  // visível no código e falha alto se a sessão tiver expirado.
  const { data, error } = await supabase
    .from('idosos')
    .insert({ ...dados, created_by: userId })
    .select()
    .single()

  if (error) {
    console.error('[idosos] falha ao criar:', error)
    throw error
  }
  return data
}

export async function atualizarIdoso(id: string, dados: DadosIdoso): Promise<IdosoRow> {
  // Note que created_by e created_at NÃO são enviados: o trigger tg_auditoria
  // os restaura de qualquer forma, mas não mandar deixa a intenção clara.
  const { data, error } = await supabase
    .from('idosos')
    .update(dados)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[idosos] falha ao atualizar:', error)
    throw error
  }
  return data
}

/**
 * Soft delete (Q3 / LGPD).
 *
 * Não existe `.delete()` em lugar nenhum deste projeto — e nem funcionaria:
 * não há policy nem GRANT de DELETE no banco. O idoso some da lista mas
 * continua acessível por link direto, marcado como inativo.
 */
export async function desativarIdoso(id: string): Promise<void> {
  const { error } = await supabase.from('idosos').update({ ativo: false }).eq('id', id)
  if (error) {
    console.error('[idosos] falha ao desativar:', error)
    throw error
  }
}

export async function reativarIdoso(id: string): Promise<void> {
  const { error } = await supabase.from('idosos').update({ ativo: true }).eq('id', id)
  if (error) throw error
}

/**
 * ⚠️ EXCLUSÃO REAL — apaga a pessoa E todo o histórico clínico dela.
 *
 * Liberado na migration 0007, revertendo a proibição original de hard delete.
 * Existe para limpar cadastros de teste e enganos, não para uso rotineiro:
 * o caminho normal continua sendo `desativarIdoso` (soft delete).
 *
 * Os atendimentos vão junto pela cascata da FK. Não há como recuperar pelo
 * sistema, e a trilha de auditoria some junto — some o registro de que aquela
 * pessoa existiu.
 *
 * A interface exige digitar a palavra EXCLUIR antes de liberar o botão. Essa
 * fricção é proposital: um clique acidental aqui destrói prontuário.
 */
export async function excluirIdoso(id: string): Promise<void> {
  // `.select()` no delete devolve as linhas efetivamente apagadas.
  //
  // Por que isso importa: o RLS FILTRA linhas, não gera erro. Se quem chamou
  // não for administrador, a policy simplesmente não casa com nenhuma linha e
  // o delete "dá certo" apagando zero. Sem esta checagem, a tela mostraria
  // sucesso e voltaria para a lista como se tivesse apagado.
  //
  // É a mesma lição do erro 42501 lá do começo do projeto, pelo avesso:
  // ausência de erro não significa que a operação aconteceu.
  const { data, error } = await supabase.from('idosos').delete().eq('id', id).select('id')

  if (error) {
    console.error('[idosos] falha ao excluir:', error)
    throw error
  }
  if (!data || data.length === 0) {
    throw new Error(
      'Nada foi excluído. Apenas o administrador pode excluir um atendido permanentemente.',
    )
  }
}
