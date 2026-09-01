import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Alerta } from '@/components/ui/Feedback'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { mensagemDeLogin } from '../mensagensAuth'
import { loginSchema, type LoginInput } from '../schemas/auth.schema'
import { useAuth } from '../useAuth'

export function LoginPage() {
  const { session, carregando } = useAuth()
  const navigate = useNavigate()
  const [erroServidor, setErroServidor] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', senha: '' },
  })

  if (!carregando && session) return <Navigate to="/idosos" replace />

  async function aoEnviar(dados: LoginInput) {
    setErroServidor(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: dados.email,
      password: dados.senha,
    })

    if (error) {
      // O erro cru sempre vai para o console. A mensagem da tela é para a
      // pessoa; esta linha é para quem precisa descobrir o que aconteceu.
      console.error('[login] falha ao entrar:', error)
      // A escolha de quando ser genérico e quando ser específico está
      // explicada em mensagensAuth.ts — vale a leitura, foi um erro caro.
      setErroServidor(mensagemDeLogin(error))
      return
    }
    navigate('/idosos', { replace: true })
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900">
            Acompanhamento em Saúde
          </h1>
          <p className="mt-1 text-sm text-slate-500">Atendimento farmacêutico</p>
        </div>

        <form
          onSubmit={handleSubmit(aoEnviar)}
          className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6"
          noValidate
        >
          {erroServidor && <Alerta tipo="erro">{erroServidor}</Alerta>}

          <Input
            label="E-mail"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="seu@email.com"
            erro={errors.email?.message}
            {...register('email')}
          />

          <Input
            label="Senha"
            type="password"
            autoComplete="current-password"
            erro={errors.senha?.message}
            {...register('senha')}
          />

          <Button type="submit" carregando={isSubmitting} className="mt-2 w-full">
            Entrar
          </Button>

          <Link
            to="/recuperar-senha"
            className="text-center text-sm text-marca-700 hover:underline"
          >
            Esqueci minha senha
          </Link>

          <Link
            to="/cadastro"
            className="border-t border-slate-100 pt-4 text-center text-sm text-marca-700 hover:underline"
          >
            Não tenho acesso ainda — criar cadastro
          </Link>
        </form>

        {/* O cadastro é aberto, mas NÃO concede acesso: a conta nasce pendente
            e o administrador precisa liberar. Ver migration 0008. */}
        <p className="mt-6 text-center text-xs text-slate-400">
          Acesso restrito. Cadastros novos passam por aprovação do administrador.
        </p>
      </div>
    </main>
  )
}
