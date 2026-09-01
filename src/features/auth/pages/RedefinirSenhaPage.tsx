import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Alerta } from '@/components/ui/Feedback'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { redefinirSenhaSchema, type RedefinirSenhaInput } from '../schemas/auth.schema'

/**
 * Destino do link enviado por e-mail.
 *
 * Como funciona: o link traz um token na URL; o supabase-js detecta e cria uma
 * sessão temporária (por isso `detectSessionInUrl: true` no cliente). Com essa
 * sessão ativa, updateUser pode trocar a senha.
 */
export function RedefinirSenhaPage() {
  const navigate = useNavigate()
  const [erro, setErro] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RedefinirSenhaInput>({
    resolver: zodResolver(redefinirSenhaSchema),
    defaultValues: { senha: '', confirmacao: '' },
  })

  async function aoEnviar(dados: RedefinirSenhaInput) {
    setErro(null)
    const { error } = await supabase.auth.updateUser({ password: dados.senha })

    if (error) {
      setErro(
        'Não foi possível alterar a senha. O link pode ter expirado — peça um novo em "Esqueci minha senha".',
      )
      return
    }
    navigate('/idosos', { replace: true })
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-10">
      <form
        onSubmit={handleSubmit(aoEnviar)}
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6"
        noValidate
      >
        <h1 className="text-xl font-semibold text-slate-900">Criar nova senha</h1>

        {erro && <Alerta tipo="erro">{erro}</Alerta>}

        <Input
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          autoFocus
          dica="Mínimo de 8 caracteres."
          erro={errors.senha?.message}
          {...register('senha')}
        />

        <Input
          label="Repita a nova senha"
          type="password"
          autoComplete="new-password"
          erro={errors.confirmacao?.message}
          {...register('confirmacao')}
        />

        <Button type="submit" carregando={isSubmitting} className="w-full">
          Salvar nova senha
        </Button>
      </form>
    </main>
  )
}
