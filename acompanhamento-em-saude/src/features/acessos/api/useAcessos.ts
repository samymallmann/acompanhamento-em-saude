import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { PapelEnum, UsuarioAutorizadoRow } from '@/types/database.types'
import { chaveAutores } from './autores'

/* ===========================================================================
   Gestão de acessos — só o administrador consegue usar isto de verdade.

   Se um operador chamar estas funções pelo DevTools, a leitura devolve só os
   já liberados e a escrita afeta ZERO linhas: as policies ua_select e
   ua_update exigem is_admin(). Ver migration 0009.
=========================================================================== */

export const chavesAcessos = {
  lista: ['acessos', 'lista'] as const,
}

export async function listarAcessos(): Promise<UsuarioAutorizadoRow[]> {
  const { data, error } = await supabase
    .from('usuarios_autorizados')
    .select('*')
    .order('ativo', { ascending: true }) // pendentes primeiro
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[acessos] falha ao listar:', error)
    throw error
  }
  return data ?? []
}

export function useAcessos() {
  return useQuery({ queryKey: chavesAcessos.lista, queryFn: listarAcessos })
}

/**
 * Aplica a mudança e CONFERE se alguma linha foi realmente alterada.
 *
 * Mesma lição da exclusão de atendido: o RLS filtra linhas em vez de dar erro.
 * Sem `.select()`, uma tentativa sem permissão "daria certo" alterando nada, e
 * a tela mostraria sucesso.
 */
async function alterar(id: string, mudanca: { ativo?: boolean; papel?: PapelEnum }) {
  const { data, error } = await supabase
    .from('usuarios_autorizados')
    .update(mudanca)
    .eq('id', id)
    .select('id')

  if (error) {
    console.error('[acessos] falha ao alterar:', error)
    throw error
  }
  if (!data || data.length === 0) {
    throw new Error('Nada foi alterado. Apenas o administrador pode gerenciar acessos.')
  }
}

export function useAlterarAcesso() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (v: { id: string; ativo?: boolean; papel?: PapelEnum }) =>
      alterar(v.id, { ativo: v.ativo, papel: v.papel }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['acessos'] })
      // O mapa de autores muda junto: quem foi revogado some da lista.
      void queryClient.invalidateQueries({ queryKey: chaveAutores })
    },
  })
}

/**
 * Exclusão definitiva do cadastro — apaga o pedido E a conta de login.
 *
 * POR QUE UM `rpc` E NÃO UM `.delete()`:
 * apagar a conta de login mexe em `auth.users`, tabela do sistema do Supabase
 * que a chave pública não alcança. Um `.delete()` daqui só conseguiria remover
 * a linha de `usuarios_autorizados`, deixando a pessoa num limbo — com login
 * funcionando, presa na tela de espera e sem conseguir se recadastrar.
 *
 * `rpc` chama a função `excluir_cadastro` do banco (migration 0010), que faz as
 * duas exclusões numa transação só e carrega todas as travas: só admin, nunca a
 * si mesmo, nunca o último admin, e nunca quem já lançou dados.
 *
 * Diferente de um delete comum, aqui o erro CHEGA: a função usa `raise
 * exception`, e exceção do Postgres vira erro de verdade no supabase-js. Não é
 * o caso do RLS, que apenas filtra linhas em silêncio.
 */
async function excluirCadastro(id: string): Promise<void> {
  const { error } = await supabase.rpc('excluir_cadastro', { p_id: id })

  if (error) {
    console.error('[acessos] falha ao excluir cadastro:', error)
    throw error
  }
}

export function useExcluirCadastro() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: excluirCadastro,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['acessos'] })
      void queryClient.invalidateQueries({ queryKey: chaveAutores })
    },
  })
}

/**
 * Define a senha de outra pessoa (migration 0011).
 *
 * A senha NUNCA passa por esta camada em texto guardado: ela vai direto para a
 * função do banco, que converte em hash bcrypt na mesma chamada. Nada é salvo
 * em estado global, cache ou localStorage — por isso esta função não devolve
 * nada e o componente descarta o campo assim que fecha o modal.
 *
 * Sem invalidação de cache no sucesso: nenhuma lista da tela muda. O que muda é
 * a senha e as sessões da pessoa, que ficam do lado do Supabase.
 */
export function useDefinirSenha() {
  return useMutation({
    mutationFn: async (v: { id: string; senha: string }) => {
      const { error } = await supabase.rpc('definir_senha', {
        p_id: v.id,
        p_senha: v.senha,
      })
      if (error) {
        // Sem a senha no log, obviamente — só o motivo da recusa.
        console.error('[acessos] falha ao definir senha:', error)
        throw error
      }
    },
  })
}
