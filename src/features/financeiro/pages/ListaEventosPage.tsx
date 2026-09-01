import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Alerta, CabecalhoPagina, EstadoVazio, TelaCarregando } from '@/components/ui/Feedback'
import { mensagemDeErro } from '@/lib/erros'
import { formatarData } from '@/lib/format'
import { useEventos } from '../api/useFinanceiro'

export function ListaEventosPage() {
  const navigate = useNavigate()
  const { data: eventos, isLoading, isError, error } = useEventos()

  return (
    <>
      <CabecalhoPagina
        titulo="Financeiro / Eventos"
        subtitulo="Controle de gastos por evento"
        acoes={<Button onClick={() => navigate('/financeiro/novo')}>+ Novo evento</Button>}
      />

      {isError && (
        <Alerta tipo="erro" titulo="Não foi possível carregar os eventos">
          {mensagemDeErro(error)}
        </Alerta>
      )}

      {isLoading && <TelaCarregando />}

      {eventos && eventos.length === 0 && (
        <EstadoVazio
          titulo="Nenhum evento cadastrado"
          descricao="Crie um evento para começar a lançar os gastos dele."
          acao={<Button onClick={() => navigate('/financeiro/novo')}>+ Novo evento</Button>}
        />
      )}

      {eventos && eventos.length > 0 && (
        <ul className="flex flex-col gap-2">
          {eventos.map((evento) => (
            <li key={evento.id}>
              <Link
                to={`/financeiro/${evento.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-marca-600 hover:bg-marca-50/40"
              >
                <span className="font-medium text-slate-900">{evento.nome}</span>
                <span className="text-sm text-slate-500">
                  {evento.data_evento ? formatarData(evento.data_evento) : 'sem data'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
