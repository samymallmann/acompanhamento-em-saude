/* ---------------------------------------------------------------------------
   Tipos do banco.

   ⚠️  ESTE ARQUIVO DEVE SER GERADO, NÃO EDITADO À MÃO.

   Depois de criar o projeto no Supabase e aplicar as migrations, rode:

     npx supabase login
     npx supabase link --project-ref SEU_PROJECT_REF
     npm run types

   O comando lê o schema REAL do banco e reescreve este arquivo. É o maior
   ganho de usar TypeScript com Supabase: se você renomear uma coluna e
   esquecer de ajustar o frontend, o build quebra — antes de ir para produção.

   A versão abaixo foi escrita à mão apenas para o projeto compilar antes do
   banco existir. Ela espelha supabase/migrations/20260830120000_schema.sql.
--------------------------------------------------------------------------- */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type GeneroEnum = 'Feminino' | 'Masculino' | 'Outros'
export type JejumEnum = 'Sim' | 'Nao' | 'NaoSei'
export type PapelEnum = 'admin' | 'operador'

export type IdosoRow = {
  id: string
  nome: string
  data_nascimento: string | null
  genero: GeneroEnum | null
  telefone: string | null
  endereco: string | null
  grupo_id: string | null
  ativo: boolean
  created_by: string
  created_at: string
  updated_by: string | null
  updated_at: string
}

export type RegistroRow = {
  id: string
  idoso_id: string
  data_atendimento: string

  cond_diabetes: boolean
  cond_hipertensao: boolean
  cond_asma: boolean
  cond_dislipidemia: boolean
  cond_outros: boolean
  cond_outros_desc: string | null

  hf_diabetes: boolean
  hf_diabetes_quem: string | null
  hf_hipertensao: boolean
  hf_hipertensao_quem: string | null
  hf_asma: boolean
  hf_asma_quem: string | null
  hf_outros: boolean
  hf_outros_desc: string | null
  hf_outros_quem: string | null

  usa_medicamentos: boolean | null
  medicamentos_quais: string | null
  fumante: boolean | null
  fumante_passivo: boolean | null

  pressao_sistolica: number | null
  pressao_diastolica: number | null
  frequencia_cardiaca: number | null
  temperatura: number | null
  saturacao: number | null
  glicemia: number | null
  glicemia_jejum: JejumEnum | null

  descricao: string | null

  ativo: boolean
  created_by: string
  created_at: string
  updated_by: string | null
  updated_at: string
}

export type UsuarioAutorizadoRow = {
  id: string
  email: string
  /** Nome completo informado no cadastro. Vira a etiqueta "by Fulano de Tal". */
  nome: string | null
  user_id: string | null
  ativo: boolean
  /** 'admin' pode excluir atendido permanentemente. Ver migration 0008. */
  papel: PapelEnum
  created_at: string
}

/* Insert/Update escritos explicitamente, não derivados com Omit + Partial.
   Motivo prático: o supabase-js valida o tipo do schema contra um formato
   interno, e tipos derivados por interseção às vezes não são reconhecidos —
   o sintoma é o cliente inferir `never` no .insert() e o TypeScript recusar
   qualquer objeto. Explícito é mais verboso e simplesmente funciona.
   (Some quando estes tipos passarem a ser gerados por `npm run types`.) */

export type IdosoInsert = {
  id?: string
  nome: string
  data_nascimento?: string | null
  genero?: GeneroEnum | null
  telefone?: string | null
  endereco?: string | null
  grupo_id?: string | null
  ativo?: boolean
  created_by?: string
  created_at?: string
  updated_by?: string | null
  updated_at?: string
}

export type IdosoUpdate = Partial<IdosoInsert>

export type RegistroInsert = {
  id?: string
  idoso_id: string
  data_atendimento?: string

  cond_diabetes?: boolean
  cond_hipertensao?: boolean
  cond_asma?: boolean
  cond_dislipidemia?: boolean
  cond_outros?: boolean
  cond_outros_desc?: string | null

  hf_diabetes?: boolean
  hf_diabetes_quem?: string | null
  hf_hipertensao?: boolean
  hf_hipertensao_quem?: string | null
  hf_asma?: boolean
  hf_asma_quem?: string | null
  hf_outros?: boolean
  hf_outros_desc?: string | null
  hf_outros_quem?: string | null

  usa_medicamentos?: boolean | null
  medicamentos_quais?: string | null
  fumante?: boolean | null
  fumante_passivo?: boolean | null

  pressao_sistolica?: number | null
  pressao_diastolica?: number | null
  frequencia_cardiaca?: number | null
  temperatura?: number | null
  saturacao?: number | null
  glicemia?: number | null
  glicemia_jejum?: JejumEnum | null

  descricao?: string | null

  ativo?: boolean
  created_by?: string
  created_at?: string
  updated_by?: string | null
  updated_at?: string
}

export type RegistroUpdate = Partial<RegistroInsert>

export type UsuarioAutorizadoInsert = {
  id?: string
  email: string
  nome?: string | null
  user_id?: string | null
  ativo?: boolean
  papel?: PapelEnum
  created_at?: string
}

/* --------------------------------------------------------------------------
   Financeiro / Eventos
-------------------------------------------------------------------------- */

export type EventoRow = {
  id: string
  nome: string
  data_evento: string | null
  ativo: boolean
  created_by: string
  created_at: string
  updated_by: string | null
  updated_at: string
}

export type EventoInsert = {
  id?: string
  nome: string
  data_evento?: string | null
  ativo?: boolean
  created_by?: string
  created_at?: string
  updated_by?: string | null
  updated_at?: string
}

export type ProdutoEventoRow = {
  id: string
  evento_id: string
  nome: string
  quantidade: number
  valor_unitario: number
  /** Coluna GENERATED — calculada pelo banco, nunca enviada pelo frontend. */
  subtotal: number
  ativo: boolean
  created_by: string
  created_at: string
  updated_by: string | null
  updated_at: string
}

/* Note que `subtotal` NÃO aparece no Insert nem no Update: o Postgres recusa
   qualquer escrita nele. Deixar de fora do tipo faz o TypeScript avisar antes
   de a requisição sair. */
export type ProdutoEventoInsert = {
  id?: string
  evento_id: string
  nome: string
  quantidade: number
  valor_unitario: number
  ativo?: boolean
  created_by?: string
  created_at?: string
  updated_by?: string | null
  updated_at?: string
}

export type CompraLoteRow = {
  id: string
  evento_id: string
  descricao: string
  texto_nota: string | null
  valor_total: number
  ativo: boolean
  created_by: string
  created_at: string
  updated_by: string | null
  updated_at: string
}

export type CompraLoteInsert = {
  id?: string
  evento_id: string
  descricao: string
  texto_nota?: string | null
  valor_total: number
  ativo?: boolean
  created_by?: string
  created_at?: string
  updated_by?: string | null
  updated_at?: string
}

export type TotaisEventoRow = {
  evento_id: string
  total_produtos: number
  total_lotes: number
  total_geral: number
}

export type Database = {
  public: {
    Tables: {
      idosos: {
        Row: IdosoRow
        Insert: IdosoInsert
        Update: IdosoUpdate
        Relationships: []
      }
      registros: {
        Row: RegistroRow
        Insert: RegistroInsert
        Update: RegistroUpdate
        Relationships: []
      }
      usuarios_autorizados: {
        Row: UsuarioAutorizadoRow
        Insert: UsuarioAutorizadoInsert
        Update: Partial<UsuarioAutorizadoInsert>
        Relationships: []
      }
      eventos: {
        Row: EventoRow
        Insert: EventoInsert
        Update: Partial<EventoInsert>
        Relationships: []
      }
      produtos_evento: {
        Row: ProdutoEventoRow
        Insert: ProdutoEventoInsert
        Update: Partial<ProdutoEventoInsert>
        Relationships: []
      }
      compras_lote_evento: {
        Row: CompraLoteRow
        Insert: CompraLoteInsert
        Update: Partial<CompraLoteInsert>
        Relationships: []
      }
    }
    /* `{ [_ in never]: never }` e NÃO `Record<string, never>`.
       Parece a mesma coisa vazia, mas não é: Record<string, never> traz uma
       index signature `[k: string]: never`, e o supabase-js calcula
       `Tables & Views` internamente — a interseção transformaria TODA tabela em
       `never`, e qualquer .insert() passaria a recusar qualquer objeto.
       `{ [_ in never]: never }` é o objeto vazio de verdade, sem index
       signature, e é o idioma que os tipos gerados usam. */
    Views: {
      vw_totais_evento: {
        Row: TotaisEventoRow
        Relationships: []
      }
    }
    Functions: {
      is_autorizado: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      // Migration 0010. É `void` no banco, e `undefined` é como o supabase-js
      // representa isso — o que interessa desta chamada é o erro, não o retorno.
      excluir_cadastro: {
        Args: { p_id: string }
        Returns: undefined
      }
      // Migration 0011.
      definir_senha: {
        Args: { p_id: string; p_senha: string }
        Returns: undefined
      }
      // Migration 0012. Recebe e devolve jsonb; o formato do retorno está
      // descrito em ResultadoImportacao (features/campo/api/useImportarFicha).
      importar_atendimentos: {
        Args: { p_payload: unknown }
        Returns: unknown
      }
    }
    Enums: {
      genero_enum: GeneroEnum
      jejum_enum: JejumEnum
      papel_enum: PapelEnum
    }
    CompositeTypes: { [_ in never]: never }
  }
}
