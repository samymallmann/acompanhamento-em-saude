import { formatarData, formatarMedida, formatarPressao } from '@/lib/format'
import type { RegistroRow } from '@/types/database.types'

/**
 * Última coleta — REFERÊNCIA VISUAL, não preenche nada.
 *
 * Requisito explícito: mostrar os valores do atendimento anterior em bloco
 * separado, sem tocar nos campos do formulário.
 *
 * A separação visual é o ponto todo. Fundo cinza, borda tracejada e o rótulo
 * "somente referência" existem para que ninguém confunda estes números com
 * algo já lançado hoje — o erro mais caro possível nesta tela seria a usuária
 * achar que a pressão de 15 dias atrás é a de agora.
 */
export function BlocoUltimaColeta({ registro }: { registro: RegistroRow }) {
  const itens = [
    { rotulo: 'Pressão', valor: formatarPressao(registro.pressao_sistolica, registro.pressao_diastolica) },
    { rotulo: 'Freq. cardíaca', valor: formatarMedida(registro.frequencia_cardiaca, 'bpm') },
    { rotulo: 'Temperatura', valor: formatarMedida(registro.temperatura, '°C') },
    { rotulo: 'Saturação', valor: formatarMedida(registro.saturacao, '%') },
    { rotulo: 'Glicemia', valor: formatarMedida(registro.glicemia, 'mg/dL') },
  ]

  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-100 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-700">
          Última coleta — {formatarData(registro.data_atendimento)}
        </span>
        <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
          somente referência
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {itens.map((item) => (
          <div key={item.rotulo}>
            <dt className="text-xs text-slate-500">{item.rotulo}</dt>
            <dd className="text-sm font-medium text-slate-700">{item.valor}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-xs text-slate-500">
        Estes valores não foram copiados. Os campos abaixo começam vazios de propósito.
      </p>
    </div>
  )
}
