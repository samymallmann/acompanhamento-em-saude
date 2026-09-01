import { z } from 'zod'

/* ---------------------------------------------------------------------------
   Schemas de validação (Zod 4).

   Nota para estudo: a maioria dos tutoriais online é do Zod 3, onde se escrevia
   z.string().email(). No Zod 4 o validador virou top-level: z.email().
   A forma antiga ainda funciona, mas está depreciada.
--------------------------------------------------------------------------- */

export const loginSchema = z.object({
  email: z.email('Digite um e-mail válido.'),
  // Só exige "não vazio". Regra de complexidade aqui não protege nada: a senha
  // já existe, quem define a política é o Supabase no momento da criação.
  // Exigir formato no login só produz mensagem errada para senha certa.
  senha: z.string().min(1, 'Digite sua senha.'),
})

export const recuperarSenhaSchema = z.object({
  email: z.email('Digite um e-mail válido.'),
})

export const redefinirSenhaSchema = z
  .object({
    senha: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.'),
    confirmacao: z.string(),
  })
  // .refine valida o objeto inteiro, não um campo isolado — é assim que se
  // compara dois campos entre si. O `path` diz em qual campo mostrar o erro.
  .refine((dados) => dados.senha === dados.confirmacao, {
    message: 'As senhas não são iguais.',
    path: ['confirmacao'],
  })

export const cadastroSchema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(3, 'Digite seu nome completo.')
      .max(200, 'Nome muito longo.')
      // Exige pelo menos duas palavras: o campo é "nome completo" e é ele que
      // vira a assinatura "by Fulano de Tal" nos lançamentos. Só o primeiro
      // nome não identifica ninguém numa equipe.
      .refine((v) => v.split(/\s+/).filter(Boolean).length >= 2, {
        message: 'Informe o nome e o sobrenome.',
      }),
    email: z.email('Digite um e-mail válido.'),
    senha: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.'),
    confirmacao: z.string(),
  })
  .refine((d) => d.senha === d.confirmacao, {
    message: 'As senhas não são iguais.',
    path: ['confirmacao'],
  })

export type CadastroInput = z.infer<typeof cadastroSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type RecuperarSenhaInput = z.infer<typeof recuperarSenhaSchema>
export type RedefinirSenhaInput = z.infer<typeof redefinirSenhaSchema>
