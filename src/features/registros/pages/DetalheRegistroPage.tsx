import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Alerta, CabecalhoPagina, Card, TelaCarregando } from '@/components/ui/Feedback'
import { useAutores } from '@/features/acessos/api/autores'
import { useIdoso } from '@/features/idosos/api/useIdosos'
import { mensagemDeErro } from '@/lib/erros'
import {
  formatarData,
  formatarDataHora,
  formatarJejum,
  formatarMedida,
  formatarPressao,
  formatarSimNao,
} from '@/lib/format'
import { useAtualizarRegistro, useRegistro } from '../api/useRegistros'
import { RegistroForm } from '../components/RegistroForm'
import type { RegistroFormSaida } from '../schemas/registro.schema'
import { preencherParaEdicao } from '../utils/prefill'

export function DetalheRegistroPage() {
  const { id, registroId } = useParams<{ id: string; registroId: string }>()
  const idosoId = id!

  const { data: idoso } = useIdoso(idosoId)
  const { data: registro, isLoading } = useRegistro(registroId)
  const autorDe = useAutores()
  const atualizar = useAtualizarRegistro(idosoId, registroId!)

  const [editando, setEditando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (isLoading) return <TelaCarregando />

  if (!registro) {
    return (
      <Alerta tipo="erro" titulo="Registro não encontrado">
        O endereço pode estar incorreto.
      </Alerta>
    )
  }

  async function salvar(dados: RegistroFormSaida) {
    setErro(null)
    try {
      await atualizar.mutateAsync({ ...dados, idoso_id: idosoId })
      setEditando(false)
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  const condicoes = [
    registro.cond_diabetes && 'Diabetes',
    registro.cond_hipertensao && 'Hipertensão',
    registro.cond_asma && 'Asma',
    registro.cond_dislipidemia && 'Dislipidemia',
    registro.cond_outros && registro.cond_outros_desc,
  ].filter(Boolean) as string[]

  const familia = [
    registro.hf_diabetes && `Diabetes — ${registro.hf_diabetes_quem ?? 'não informado'}`,
    registro.hf_hipertensao && `Hipertensão — ${registro.hf_hipertensao_quem ?? 'não informado'}`,
    registro.hf_asma && `Asma — ${registro.hf_asma_quem ?? 'não informado'}`,
    registro.hf_outros &&
      `${registro.hf_outros_desc ?? 'Outro'} — ${registro.hf_outros_quem ?? 'não informado'}`,
  ].filter(Boolean) as string[]

  const medidas = [
    { rotulo: 'Pressão arterial', valor: formatarPressao(registro.pressao_sistolica, registro.pressao_diastolica) },
    { rotulo: 'Frequência cardíaca', valor: formatarMedida(registro.frequencia_cardiaca, 'bpm') },
    { rotulo: 'Temperatura', valor: formatarMedida(registro.temperatura, '°C') },
    { rotulo: 'Saturação', valor: formatarMedida(registro.saturacao, '%') },
    { rotulo: 'Glicemia capilar', valor: formatarMedida(registro.glicemia, 'mg/dL') },
    { rotulo: 'Em jejum', valor: formatarJejum(registro.glicemia_jejum) },
  ]

  if (editando) {
    return (
      <>
        <CabecalhoPagina
          titulo={`Editar registro de ${formatarData(registro.data_atendimento)}`}
          subtitulo={idoso?.nome}
        />
        <RegistroForm
          valoresIniciais={preencherParaEdicao(registro)}
          ultimoRegistro={null}
          editandoData={registro.data_atendimento}
          salvando={atualizar.isPending}
          erro={erro}
          onSalvar={salvar}
          onCancelar={() => setEditando(false)}
        />
      </>
    )
  }

  return (
    <>
      <div className="mb-2">
        <Link to={`/idosos/${idosoId}`} className="text-sm text-marca-700 hover:underline">
          ← Voltar para o perfil
        </Link>
      </div>

      <CabecalhoPagina
        titulo={`Atendimento de ${formatarData(registro.data_atendimento)}`}
        subtitulo={idoso?.nome}
        acoes={
          <Button variante="secundario" onClick={() => setEditando(true)}>
            Editar
          </Button>
        }
      />

      <div className="grid max-w-4xl gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-base font-semibold text-slate-900">Problemas de saúde</h2>
          {condicoes.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum registrado.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {condicoes.map((c) => (
                <li key={c} className="rounded bg-slate-100 px-2 py-1 text-sm text-slate-700">
                  {c}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-base font-semibold text-slate-900">Histórico familiar</h2>
          {familia.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum registrado.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm text-slate-700">
              {familia.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-base font-semibold text-slate-900">Medicamentos e tabagismo</h2>
          <dl className="flex flex-col gap-2 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Faz uso de medicamento</dt>
              <dd className="text-slate-800">{formatarSimNao(registro.usa_medicamentos)}</dd>
            </div>
            {registro.medicamentos_quais && (
              <div>
                <dt className="text-xs text-slate-500">Medicamentos em uso</dt>
                <dd className="text-slate-800">{registro.medicamentos_quais}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-slate-500">Fumante</dt>
              <dd className="text-slate-800">{formatarSimNao(registro.fumante)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Fumante passivo</dt>
              <dd className="text-slate-800">{formatarSimNao(registro.fumante_passivo)}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 text-base font-semibold text-slate-900">Rastreamento em saúde</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {medidas.map((m) => (
              <div key={m.rotulo}>
                <dt className="text-xs text-slate-500">{m.rotulo}</dt>
                <dd className="text-slate-800">{m.valor}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <div className="md:col-span-2">
          <Card>
            <h2 className="mb-2 text-base font-semibold text-slate-900">Observações</h2>
            {registro.descricao ? (
              <p className="text-sm whitespace-pre-wrap text-slate-800">{registro.descricao}</p>
            ) : (
              <p className="text-sm text-slate-500">Nenhuma observação registrada.</p>
            )}
          </Card>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Registrado em {formatarDataHora(registro.created_at)} por{' '}
        {autorDe(registro.created_by)}
        {registro.updated_by &&
          ` · última edição em ${formatarDataHora(registro.updated_at)} por ${autorDe(registro.updated_by)}`}
      </p>
    </>
  )
}
