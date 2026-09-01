import { QueryClient } from '@tanstack/react-query'

/* ---------------------------------------------------------------------------
   TanStack Query (Q12)

   O que ele resolve: sem ele, cada tela precisaria de um useState para os
   dados, outro para "carregando", outro para "erro", e um useEffect para
   buscar — repetido em toda página, sem cache, e com re-busca manual depois
   de cada salvamento.

   Com ele: useQuery devolve os três estados prontos, e um invalidateQueries
   depois de salvar atualiza sozinho todas as telas que dependem daquele dado.
--------------------------------------------------------------------------- */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Dado considerado "fresco" por 30s: navegar entre perfil e lista nesse
      // intervalo não dispara nova requisição. Volume de dados é pequeno e
      // muda pouco — cache agressivo demais só esconderia alterações da colega.
      staleTime: 30_000,

      // Não re-busca ao voltar para a aba. Em sistema de duas usuárias isso
      // gera mais tráfego do que utilidade.
      refetchOnWindowFocus: false,

      // Uma tentativa extra cobre oscilação de rede (relevante no celular).
      // Mais que isso só faz a usuária esperar mais para ver a mensagem de erro.
      retry: 1,
    },
    mutations: {
      // Salvamento nunca é repetido automaticamente: um retry cego poderia
      // criar dois registros idênticos.
      retry: 0,
    },
  },
})

/* Chaves de cache centralizadas.

   Por que não espalhar strings pelo código: `invalidateQueries` casa por
   prefixo. Com as chaves aqui, invalidar ['registros', idosoId] depois de
   salvar atinge exatamente as telas certas — e um erro de digitação numa
   string solta viraria um bug silencioso de "a tela não atualiza". */
export const chaves = {
  idosos: {
    lista: (busca?: string) => ['idosos', 'lista', busca ?? ''] as const,
    porId: (id: string) => ['idosos', 'item', id] as const,
  },
  registros: {
    doIdoso: (idosoId: string) => ['registros', idosoId] as const,
    ultimo: (idosoId: string) => ['registros', idosoId, 'ultimo'] as const,
    porId: (id: string) => ['registros', 'item', id] as const,
  },
} as const
