import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

/* ---------------------------------------------------------------------------
   Cliente Supabase — instância única para todo o app.

   SOBRE A CHAVE:
   VITE_SUPABASE_ANON_KEY é embutida no JavaScript que o navegador baixa. Ela é
   PÚBLICA por definição — qualquer pessoa lê no DevTools. Isso é normal e
   esperado: ela não é uma senha, é um endereço.

   Quem protege os dados é o RLS no Postgres (supabase/migrations/..._rls.sql).

   A chave `service_role` IGNORA o RLS por completo e NUNCA pode aparecer neste
   projeto — nem no código, nem no .env, nem nas variáveis da Vercel.
--------------------------------------------------------------------------- */

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Falha cedo e com mensagem clara. Sem isso, o erro apareceria depois como
  // um "fetch failed" genérico, difícil de associar à causa real.
  throw new Error(
    'Variáveis de ambiente ausentes. Copie .env.example para .env.local e ' +
      'preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY com os valores do ' +
      'seu projeto Supabase (Project Settings > API).',
  )
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    // Mantém a sessão no localStorage e renova o token sozinho, para a usuária
    // não precisar logar de novo a cada visita.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
