import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Alerta } from '@/components/ui/Feedback'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { mensagemDeRecuperacao } from '../mensagensAuth'
import { recuperarSenhaSchema, type RecuperarSenhaInput } from '../schemas/auth.schema'

export function RecuperarSenhaPage() {
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecuperarSenhaInput>({
    resolver: zodResolver(recuperarSenhaSchema),
    defaultValues: { email: '' },
  })

  async function aoEnviar(dados: RecuperarSenhaInput) {
    setErro(null)
    const { error } = await supabase.auth.resetPasswordForEmail(dados.email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })

    if (error) console.error('[recuperar-senha] falha ao enviar:', error)

    // Antes esta tela ignorava o erro por completo e sempre dizia "verifique
    // seu e-mail". Quando o servidor recusava o envio por limite de e-mails, a
    // pessoa ficava esperando uma mensagem que nunca ia chegar.
    //
    // Agora só o limite de envio aparece: é um fato do servidor, não da conta,
    // e não revela se o e-mail existe. Qualquer outro erro continua escondido
    // atrás da confirmação neutra, que é o que impede descobrir contas aqui.
    const aviso = mensagemDeRecuperacao(error)
    if (aviso) {
      setErro(aviso)
      return
    }
    setEnviado(true)
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-xl font-semibold text-slate-900">
          Recuperar senha
        </h1>

        {enviado ? (
          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6">
            <Alerta tipo="info" titulo="Verifique seu e-mail">
              Se este e-mail estiver cadastrado, você receberá um link para criar
              uma nova senha. O link vale por tempo limitado.
            </Alerta>
            <Link to="/login" className="text-center text-sm text-marca-700 hover:underline">
              Voltar para o login
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit(aoEnviar)}
            className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6"
            noValidate
          >
            {erro && <Alerta tipo="erro">{erro}</Alerta>}

            <p className="text-sm text-slate-600">
              Digite seu e-mail e enviaremos um link para você criar uma nova senha.
            </p>

            <Input
              label="E-mail"
              type="email"
              autoComplete="email"
              autoFocus
              erro={errors.email?.message}
              {...register('email')}
            />

            <Button type="submit" carregando={isSubmitting} className="w-full">
              Enviar link
            </Button>

            <Link to="/login" className="text-center text-sm text-marca-700 hover:underline">
              Voltar para o login
            </Link>
          </form>
        )}
      </div>
    </main>
  )
}
