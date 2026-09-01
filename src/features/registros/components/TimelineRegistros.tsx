import { Link } from 'react-router-dom'
import { EstadoVazio } from '@/components/ui/Feedback'
import { useAutores } from '@/features/acessos/api/autores'
import { formatarData, formatarMedida, formatarPressao } from '@/lib/format'
import type { RegistroRow } from '@/types/database.types'

/**
 * Histórico de atendimentos, do mais recente para o mais antigo.
 *
 * Mostra só um resumo das medições. Clicar abre o registro completo, exatamente
 * como foi salvo — que é o requisito central: qualquer registro antigo pode ser
 * reaberto no estado original.
 */
export function TimelineRegistros({
  registros,
  idosoId,
}: {
  registros: RegistroRow[]
  idosoId: string
}) {
  // Uma consulta só para a lista inteira: a função devolvida traduz cada
  // created_by em memória.
  const autorDe = useAutores()

  if (registros.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhum atendimento registrado"
        descricao="Quando o primeiro registro for lançado, ele aparece aqui."
      />
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {registros.map((r) => {
        const condicoes = [
          r.cond_diabetes && 'Diabetes',
          r.cond_hipertensao && 'Hipertensão',
          r.cond_asma && 'Asma',
          r.cond_dislipidemia && 'Dislipidemia',
          r.cond_outros && r.cond_outros_desc,
        ].filter(Boolean) as string[]

        return (
          <li key={r.id}>
            <Link
              to={`/idosos/${idosoId}/registros/${r.id}`}
              className="block rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-marca-600 hover:bg-marca-50/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-slate-900">
                  {formatarData(r.data_atendimento)}
                </span>
                {r.updated_by && (
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    editado
                  </span>
                )}
              </div>

              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                <span>
                  Pressão: {formatarPressao(r.pressao_sistolica, r.pressao_diastolica)}
                </span>
                <span>FC: {formatarMedida(r.frequencia_cardiaca, 'bpm')}</span>
                <span>Temp: {formatarMedida(r.temperatura, '°C')}</span>
                <span>Sat: {formatarMedida(r.saturacao, '%')}</span>
                <span>Glicemia: {formatarMedida(r.glicemia, 'mg/dL')}</span>
              </div>

              {condicoes.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {condicoes.map((c) => (
                    <span
                      key={c}
                      className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {/* Quem atendeu. Discreto e alinhado à direita, mesmo padrão dos
                  lançamentos do financeiro: é informação de conferência, não
                  disputa atenção com a medição. */}
              <p className="mt-2 text-right text-xs text-slate-400">
                por {autorDe(r.created_by)}
              </p>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
