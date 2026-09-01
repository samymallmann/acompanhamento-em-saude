import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Select, Textarea } from '@/components/ui/Campos'
import { Button } from '@/components/ui/Button'
import { Alerta, CabecalhoPagina, TelaCarregando } from '@/components/ui/Feedback'
import { Input } from '@/components/ui/Input'
import { mensagemDeErro } from '@/lib/erros'
import { mascararTelefone } from '@/lib/format'
import { useDebounce } from '@/hooks/useDebounce'
import { buscarNomesParecidos } from '../api/idosos.api'
import { useIdoso } from '../api/useIdosos'
import { useSalvarIdoso } from '../api/useSalvarIdoso'
import { idosoSchema, type IdosoFormEntrada, type IdosoFormSaida } from '../schemas/idoso.schema'

export function FormIdosoPage() {
  const { id } = useParams<{ id: string }>()
  const editando = Boolean(id)
  const navigate = useNavigate()

  const { data: idoso, isLoading } = useIdoso(id)
  const salvar = useSalvarIdoso(id)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<IdosoFormEntrada, unknown, IdosoFormSaida>({
    resolver: zodResolver(idosoSchema),
    defaultValues: { nome: '', data_nascimento: '', genero: '', telefone: '', endereco: '' },
  })

  // Preenche o formulário quando o idoso chega do banco (só ao editar).
  useEffect(() => {
    if (!idoso) return
    reset({
      nome: idoso.nome,
      data_nascimento: idoso.data_nascimento ?? '',
      genero: idoso.genero ?? '',
      telefone: idoso.telefone ?? '',
      endereco: idoso.endereco ?? '',
    })
  }, [idoso, reset])

  // Q7: aviso de possível duplicidade, nunca bloqueio. Duas pessoas podem
  // legitimamente ter o mesmo nome — quem decide é a usuária, não o sistema.
  // useWatch em vez de watch(): assina só este campo, sem re-renderizar o
  // formulário inteiro a cada tecla.
  const nomeDigitado = useWatch({ control, name: 'nome' }) ?? ''
  const nomeAdiado = useDebounce(nomeDigitado, 500)
  const { data: parecidos } = useQuery({
    queryKey: ['idosos', 'parecidos', nomeAdiado],
    queryFn: () => buscarNomesParecidos(nomeAdiado),
    enabled: !editando && nomeAdiado.trim().length >= 3,
  })

  const [erroSalvar, setErroSalvar] = useState<string | null>(null)

  async function aoEnviar(dados: IdosoFormSaida) {
    setErroSalvar(null)
    try {
      const salvo = await salvar.mutateAsync(dados)
      navigate(`/idosos/${salvo.id}`, { replace: true })
    } catch (e) {
      setErroSalvar(mensagemDeErro(e))
    }
  }

  if (editando && isLoading) return <TelaCarregando />

  return (
    <>
      <CabecalhoPagina
        titulo={editando ? 'Editar atendido' : 'Novo atendido'}
        subtitulo={editando ? idoso?.nome : 'Apenas o nome é obrigatório.'}
      />

      <form
        onSubmit={handleSubmit(aoEnviar)}
        className="flex max-w-2xl flex-col gap-4"
        noValidate
      >
        {erroSalvar && (
          <Alerta tipo="erro" titulo="Não foi possível salvar">
            {erroSalvar}
          </Alerta>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-4">
            <Input
              label="Nome completo"
              autoFocus
              placeholder="Maria Aparecida da Silva"
              erro={errors.nome?.message}
              {...register('nome')}
            />

            {parecidos && parecidos.length > 0 && (
              <Alerta tipo="aviso" titulo="Já existe alguém com nome parecido">
                <ul className="mt-1 list-disc pl-4">
                  {parecidos.map((p) => (
                    <li key={p.id}>
                      <Link to={`/idosos/${p.id}`} className="underline">
                        {p.nome}
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-2">
                  Confira se não é a mesma pessoa. Se for outra, pode continuar
                  normalmente.
                </p>
              </Alerta>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Data de nascimento"
                type="date"
                erro={errors.data_nascimento?.message}
                {...register('data_nascimento')}
              />
              <Select
                label="Gênero"
                vazio="Não informado"
                opcoes={[
                  { valor: 'Feminino', rotulo: 'Feminino' },
                  { valor: 'Masculino', rotulo: 'Masculino' },
                  { valor: 'Outros', rotulo: 'Outros' },
                ]}
                erro={errors.genero?.message}
                {...register('genero')}
              />
            </div>

            {/* Controller em vez de register: o campo precisa reescrever o
                próprio valor a cada tecla para aplicar a máscara, e isso exige
                um campo controlado. inputMode="numeric" faz o celular abrir o
                teclado numérico direto. */}
            <Controller
              control={control}
              name="telefone"
              render={({ field }) => (
                <Input
                  label="Telefone"
                  type="tel"
                  inputMode="numeric"
                  placeholder="(92) 98888-1111"
                  dica="Fixo ou celular, com DDD."
                  erro={errors.telefone?.message}
                  value={mascararTelefone(field.value ?? '')}
                  onChange={(e) => field.onChange(mascararTelefone(e.target.value))}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              )}
            />

            <Textarea
              label="Endereço"
              rows={3}
              placeholder="Rua, número, bairro"
              erro={errors.endereco?.message}
              {...register('endereco')}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" carregando={isSubmitting}>
            {editando ? 'Salvar alterações' : 'Cadastrar atendido'}
          </Button>
          <Button
            variante="secundario"
            onClick={() => navigate(editando ? `/idosos/${id}` : '/idosos')}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </>
  )
}
