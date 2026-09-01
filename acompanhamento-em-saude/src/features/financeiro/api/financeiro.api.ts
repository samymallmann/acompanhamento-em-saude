import { supabase } from '@/lib/supabase'
import type {
  CompraLoteRow,
  EventoRow,
  ProdutoEventoRow,
  TotaisEventoRow,
} from '@/types/database.types'

/* ===========================================================================
   Acesso ao banco — módulo financeiro.
=========================================================================== */

/* --------------------------------- Eventos ------------------------------ */

export interface DadosEvento {
  nome: string
  data_evento: string | null
}

/** F12: do mais novo ao mais antigo; eventos sem data vão para o fim. */
export async function listarEventos(): Promise<EventoRow[]> {
  const { data, error } = await supabase
    .from('eventos')
    .select('*')
    .eq('ativo', true)
    .order('data_evento', { ascending: false, nullsFirst: false })
    .order('nome', { ascending: true })

  if (error) {
    console.error('[eventos] falha ao listar:', error)
    throw error
  }
  return data ?? []
}

export async function buscarEvento(id: string): Promise<EventoRow | null> {
  const { data, error } = await supabase.from('eventos').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function criarEvento(dados: DadosEvento, userId: string): Promise<EventoRow> {
  const { data, error } = await supabase
    .from('eventos')
    .insert({ ...dados, created_by: userId })
    .select()
    .single()
  if (error) {
    console.error('[eventos] falha ao criar:', error)
    throw error
  }
  return data
}

export async function atualizarEvento(id: string, dados: DadosEvento): Promise<EventoRow> {
  const { data, error } = await supabase
    .from('eventos')
    .update(dados)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function desativarEvento(id: string): Promise<void> {
  const { error } = await supabase.from('eventos').update({ ativo: false }).eq('id', id)
  if (error) throw error
}

export async function reativarEvento(id: string): Promise<void> {
  const { error } = await supabase.from('eventos').update({ ativo: true }).eq('id', id)
  if (error) throw error
}

/**
 * Exclusão REAL do evento — some do banco de vez.
 *
 * Este é o único `.delete()` do projeto inteiro. Nas tabelas de saúde não
 * existe policy nem grant de DELETE, então nem se alguém tentasse funcionaria.
 *
 * Os lançamentos do evento vão junto, pela cascata da FK (migration 0006):
 * um produto não existe fora do seu evento, então não faria sentido deixá-lo
 * órfão no banco.
 */
export async function excluirEvento(id: string): Promise<void> {
  const { error } = await supabase.from('eventos').delete().eq('id', id)
  if (error) {
    console.error('[eventos] falha ao excluir:', error)
    throw error
  }
}

/* -------------------------------- Totais -------------------------------- */

/**
 * Totais do evento, somados NO BANCO (F2).
 *
 * Nunca somar dinheiro em JavaScript: o JS só tem ponto flutuante, e
 * 0.1 + 0.2 dá 0.30000000000000004. A view soma em `numeric`, que é decimal
 * exato, e o front só exibe o resultado.
 */
export async function buscarTotais(eventoId: string): Promise<TotaisEventoRow | null> {
  const { data, error } = await supabase
    .from('vw_totais_evento')
    .select('*')
    .eq('evento_id', eventoId)
    .maybeSingle()

  if (error) {
    console.error('[totais] falha ao buscar:', error)
    throw error
  }
  return data
}

/* ------------------------------- Produtos ------------------------------- */

export interface DadosProduto {
  nome: string
  quantidade: number
  valor_unitario: number
}

export async function listarProdutos(eventoId: string): Promise<ProdutoEventoRow[]> {
  const { data, error } = await supabase
    .from('produtos_evento')
    .select('*')
    .eq('evento_id', eventoId)
    .eq('ativo', true)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function criarProduto(
  eventoId: string,
  dados: DadosProduto,
  userId: string,
): Promise<ProdutoEventoRow> {
  // `subtotal` não é enviado: é coluna GENERATED e o Postgres recusa escrita
  // nela. O tipo ProdutoEventoInsert também não o inclui, então o TypeScript
  // avisa antes mesmo de a requisição sair.
  const { data, error } = await supabase
    .from('produtos_evento')
    .insert({ ...dados, evento_id: eventoId, created_by: userId })
    .select()
    .single()

  if (error) {
    console.error('[produtos] falha ao criar:', error)
    throw error
  }
  return data
}

export async function atualizarProduto(
  id: string,
  dados: DadosProduto,
): Promise<ProdutoEventoRow> {
  const { data, error } = await supabase
    .from('produtos_evento')
    .update(dados)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function desativarProduto(id: string): Promise<void> {
  const { error } = await supabase.from('produtos_evento').update({ ativo: false }).eq('id', id)
  if (error) throw error
}

/* ---------------------------- Compras em lote --------------------------- */

export interface DadosCompraLote {
  descricao: string
  texto_nota: string | null
  valor_total: number
}

export async function listarComprasLote(eventoId: string): Promise<CompraLoteRow[]> {
  const { data, error } = await supabase
    .from('compras_lote_evento')
    .select('*')
    .eq('evento_id', eventoId)
    .eq('ativo', true)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function criarCompraLote(
  eventoId: string,
  dados: DadosCompraLote,
  userId: string,
): Promise<CompraLoteRow> {
  const { data, error } = await supabase
    .from('compras_lote_evento')
    .insert({ ...dados, evento_id: eventoId, created_by: userId })
    .select()
    .single()

  if (error) {
    console.error('[compras em lote] falha ao criar:', error)
    throw error
  }
  return data
}

export async function atualizarCompraLote(
  id: string,
  dados: DadosCompraLote,
): Promise<CompraLoteRow> {
  const { data, error } = await supabase
    .from('compras_lote_evento')
    .update(dados)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function desativarCompraLote(id: string): Promise<void> {
  const { error } = await supabase
    .from('compras_lote_evento')
    .update({ ativo: false })
    .eq('id', id)
  if (error) throw error
}

/* -------------------------------- Autores ------------------------------- */

/* Mudou para features/acessos/api/autores.ts. Ver a explicação lá: a etiqueta
   "por Fulano" deixou de ser exclusiva do financeiro quando o cadastro do
   atendido e o histórico de atendimentos passaram a mostrá-la também. */
export type { Autor } from '@/features/acessos/api/autores'
export { listarAutores } from '@/features/acessos/api/autores'
