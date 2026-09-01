import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Alerta, CabecalhoPagina, TelaCarregando } from '@/components/ui/Feedback'
import { Input } from '@/components/ui/Input'
import { mensagemDeErro } from '@/lib/erros'
import { useEvento, useSalvarEvento } from '../api/useFinanceiro'
import {
  eventoSchema,
  type EventoFormEntrada,
  type EventoFormSaida,
} from '../schemas/financeiro.schema'

export function FormEventoPage() {
  const { id } = useParams<{ id: string }>()
  const editando = Boolean(id)
  const navigate = useNavigate()

  const { data: evento, isLoading } = useEvento(id)
  const salvar = useSalvarEvento(id)
  const [erro, setErro] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EventoFormEntrada, unknown, EventoFormSaida>({
    resolver: zodResolver(eventoSchema),
    defaultValues: { nome: '', data_evento: '' },
  })

  useEffect(() => {
    if (!evento) return
    reset({ nome: evento.nome, data_evento: evento.data_evento ?? '' })
  }, [evento, reset])

  async function aoEnviar(dados: EventoFormSaida) {
    setErro(null)
    try {
      const salvo = await salvar.mutateAsync(dados)
      navigate(`/financeiro/${salvo.id}`, { replace: true })
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  if (editando && isLoading) return <TelaCarregando />

  return (
    <>
      <CabecalhoPagina
        titulo={editando ? 'Editar evento' : 'Novo evento'}
        subtitulo={editando ? evento?.nome : 'Apenas o nome é obrigatório.'}
      />

      <form onSubmit={handleSubmit(aoEnviar)} className="flex max-w-xl flex-col gap-4" noValidate>
        {erro && (
          <Alerta tipo="erro" titulo="Não foi possível salvar">
            {erro}
          </Alerta>
        )}

        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
          <Input
            label="Nome do evento"
            autoFocus
            placeholder="Chá de bebê"
            erro={errors.nome?.message}
            {...register('nome')}
          />
          <Input
            label="Data do evento (opcional)"
            type="date"
            dica="Pode ser uma data futura — dá para cadastrar antes e ir lançando os gastos."
            erro={errors.data_evento?.message}
            {...register('data_evento')}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" carregando={isSubmitting}>
            {editando ? 'Salvar alterações' : 'Criar evento'}
          </Button>
          <Button
            variante="secundario"
            onClick={() => navigate(editando ? `/financeiro/${id}` : '/financeiro')}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </>
  )
}
