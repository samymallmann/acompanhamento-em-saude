import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Alerta } from '@/components/ui/Feedback'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { mensagemDeCadastro } from '../mensagensAuth'
import { cadastroSchema, type CadastroInput } from '../schemas/auth.schema'

/**
 * Cadastro aberto — mas cadastrar NÃO dá acesso.
 *
 * A conta nasce pendente (trigger no banco, migration 0008). Até o
 * administrador aprovar, a pessoa loga e vê apenas a tela de espera, sem
 * nenhum dado. É por isso que deixar o cadastro aberto é seguro aqui: ele cria
 * um pedido, não uma permissão.
 */
export function CadastroPage() {
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CadastroInput>({
    resolver: zodResolver(cadastroSchema),
    defaultValues: { nome: '', email: '', senha: '', confirmacao: '' },
  })

  async function aoEnviar(dados: CadastroInput) {
    setErro(null)
    const { error } = await supabase.auth.signUp({
      email: dados.email,
      password: dados.senha,
      options: {
        // `data` vira raw_user_meta_data em auth.users. O trigger do banco lê
        // o nome daí para preencher usuarios_autorizados.nome, que é o que
        // aparece depois como "by Fulano de Tal" nos lançamentos.
        data: { nome: dados.nome.trim() },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    })

    if (error) {
      console.error('[cadastro] falha ao criar conta:', error)
      setErro(mensagemDeCadastro(error))
      return
    }
    setEnviado(true)
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Criar acesso</h1>
          <p className="mt-1 text-sm text-slate-500">Acompanhamento em Saúde</p>
        </div>

        {enviado ? (
          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6">
            <Alerta tipo="info" titulo="Cadastro enviado">
              Sua conta foi criada, mas o acesso ainda precisa ser liberado pelo
              administrador. Você será avisado quando isso acontecer.
            </Alerta>
            <Link to="/login" className="text-center text-sm text-marca-700 hover:underline">
              Ir para o login
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit(aoEnviar)}
            className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6"
            noValidate
          >
            {erro && <Alerta tipo="erro">{erro}</Alerta>}

            <Alerta tipo="aviso">
              O acesso não é liberado automaticamente. Depois de se cadastrar, é
              preciso aguardar a autorização do administrador.
            </Alerta>

            <Input
              label="Nome completo"
              autoFocus
              autoComplete="name"
              placeholder="Maria da Silva Souza"
              dica="Aparece como responsável nos registros que você lançar."
              erro={errors.nome?.message}
              {...register('nome')}
            />

            <Input
              label="E-mail"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              erro={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="Senha"
              type="password"
              autoComplete="new-password"
              dica="Mínimo de 8 caracteres. Use uma senha só deste sistema."
              erro={errors.senha?.message}
              {...register('senha')}
            />

            <Input
              label="Repita a senha"
              type="password"
              autoComplete="new-password"
              erro={errors.confirmacao?.message}
              {...register('confirmacao')}
            />

            <Button type="submit" carregando={isSubmitting} className="mt-2 w-full">
              Criar acesso
            </Button>

            <Link to="/login" className="text-center text-sm text-marca-700 hover:underline">
              Já tenho acesso
            </Link>
          </form>
        )}
      </div>
    </main>
  )
}
