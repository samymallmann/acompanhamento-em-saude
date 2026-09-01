import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Checkbox, RadioSimNao, SecaoFormulario, Textarea } from '@/components/ui/Campos'
import { Button } from '@/components/ui/Button'
import { Alerta } from '@/components/ui/Feedback'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { formatarData } from '@/lib/format'
import type { RegistroRow } from '@/types/database.types'
import {
  registroSchema,
  type RegistroFormEntrada,
  type RegistroFormSaida,
} from '../schemas/registro.schema'
import { avisoDoCampo, coletarAvisos, type AvisoValor } from '../utils/avisos'
import { BlocoUltimaColeta } from './BlocoUltimaColeta'

interface Props {
  valoresIniciais: RegistroFormEntrada
  ultimoRegistro: RegistroRow | null
  /** Preenchido só ao editar: dispara o modal de confirmação da Q2. */
  editandoData?: string
  salvando: boolean
  erro?: string | null
  onSalvar: (dados: RegistroFormSaida) => void
  onCancelar: () => void
}

export function RegistroForm({
  valoresIniciais,
  ultimoRegistro,
  editandoData,
  salvando,
  erro,
  onSalvar,
  onCancelar,
}: Props) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegistroFormEntrada, unknown, RegistroFormSaida>({
    resolver: zodResolver(registroSchema),
    defaultValues: valoresIniciais,
  })

  // useWatch em vez de watch(): assina só os campos listados, em vez de
  // re-renderizar o formulário inteiro a cada tecla. Num form deste tamanho a
  // diferença é perceptível.
  const vigiados = useWatch({ control })

  const [avisosPendentes, setAvisosPendentes] = useState<AvisoValor[] | null>(null)
  const [dadosParaSalvar, setDadosParaSalvar] = useState<RegistroFormSaida | null>(null)

  function aoEnviar(dados: RegistroFormSaida) {
    // Nível 2: se houver valor incomum OU for edição, pede confirmação antes.
    // Erros de bloqueio nem chegam aqui — o resolver barra antes.
    const avisos = coletarAvisos(dados as unknown as Record<string, unknown>)
    if (avisos.length > 0 || editandoData) {
      setAvisosPendentes(avisos)
      setDadosParaSalvar(dados)
      return
    }
    onSalvar(dados)
  }

  function confirmar() {
    if (dadosParaSalvar) onSalvar(dadosParaSalvar)
  }

  const cond = vigiados as Partial<RegistroFormEntrada>

  return (
    <>
      <form onSubmit={handleSubmit(aoEnviar)} className="flex max-w-3xl flex-col gap-4" noValidate>
        {erro && (
          <Alerta tipo="erro" titulo="Não foi possível salvar">
            {erro}
          </Alerta>
        )}

        <SecaoFormulario titulo="Atendimento">
          <div className="max-w-xs">
            <Input
              label="Data do atendimento"
              type="date"
              dica="Pode ser retroativa, para lançar uma ficha antiga."
              erro={errors.data_atendimento?.message}
              {...register('data_atendimento')}
            />
          </div>
        </SecaoFormulario>

        <SecaoFormulario
          titulo="Problemas de saúde"
          descricao="Pré-preenchido com o último atendimento. Ajuste se mudou."
        >
          <Checkbox label="Diabetes" {...register('cond_diabetes')} />
          <Checkbox label="Hipertensão" {...register('cond_hipertensao')} />
          <Checkbox label="Asma" {...register('cond_asma')} />
          <Checkbox label="Dislipidemia" {...register('cond_dislipidemia')} />
          <Checkbox label="Outro(s)" {...register('cond_outros')}>
            {cond.cond_outros && (
              <Input
                label="Qual(is)?"
                placeholder="Artrose de joelho"
                erro={errors.cond_outros_desc?.message}
                {...register('cond_outros_desc')}
              />
            )}
          </Checkbox>
        </SecaoFormulario>

        <SecaoFormulario
          titulo="Tem alguém na família com"
          descricao="Marque a condição e informe quem. Ex.: Diabetes — mãe."
        >
          <Checkbox label="Diabetes" {...register('hf_diabetes')}>
            {cond.hf_diabetes && (
              <Input label="Quem?" placeholder="mãe" {...register('hf_diabetes_quem')} />
            )}
          </Checkbox>
          <Checkbox label="Hipertensão" {...register('hf_hipertensao')}>
            {cond.hf_hipertensao && (
              <Input label="Quem?" placeholder="pai" {...register('hf_hipertensao_quem')} />
            )}
          </Checkbox>
          <Checkbox label="Asma" {...register('hf_asma')}>
            {cond.hf_asma && (
              <Input label="Quem?" placeholder="irmã" {...register('hf_asma_quem')} />
            )}
          </Checkbox>
          <Checkbox label="Outro(s)" {...register('hf_outros')}>
            {cond.hf_outros && (
              <div className="flex flex-col gap-3">
                <Input
                  label="Qual(is)?"
                  placeholder="AVC"
                  erro={errors.hf_outros_desc?.message}
                  {...register('hf_outros_desc')}
                />
                <Input label="Quem?" placeholder="avô paterno" {...register('hf_outros_quem')} />
              </div>
            )}
          </Checkbox>
        </SecaoFormulario>

        <SecaoFormulario titulo="Medicamentos e tabagismo">
          <Controller
            control={control}
            name="usa_medicamentos"
            render={({ field }) => (
              <RadioSimNao
                label="Faz uso de algum medicamento?"
                name={field.name}
                valor={field.value ?? ''}
                onChange={field.onChange}
              />
            )}
          />
          {cond.usa_medicamentos === 'sim' && (
            <Textarea
              label="Medicamentos em uso"
              rows={3}
              placeholder="Metformina 850mg, Losartana 50mg"
              erro={errors.medicamentos_quais?.message}
              {...register('medicamentos_quais')}
            />
          )}

          <Controller
            control={control}
            name="fumante"
            render={({ field }) => (
              <RadioSimNao
                label="Você fuma?"
                name={field.name}
                valor={field.value ?? ''}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="fumante_passivo"
            render={({ field }) => (
              <RadioSimNao
                label="Fumante passivo?"
                name={field.name}
                valor={field.value ?? ''}
                onChange={field.onChange}
              />
            )}
          />
        </SecaoFormulario>

        <SecaoFormulario
          titulo="Rastreamento em saúde"
          descricao="Estes campos começam sempre vazios — são a medição de hoje."
        >
          {ultimoRegistro && !editandoData && <BlocoUltimaColeta registro={ultimoRegistro} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Pressão sistólica (máxima)"
              type="number"
              inputMode="numeric"
              sufixo="mmHg"
              placeholder="120"
              erro={errors.pressao_sistolica?.message}
              aviso={avisoDoCampo('pressao_sistolica', cond.pressao_sistolica)}
              {...register('pressao_sistolica')}
            />
            <Input
              label="Pressão diastólica (mínima)"
              type="number"
              inputMode="numeric"
              sufixo="mmHg"
              placeholder="80"
              erro={errors.pressao_diastolica?.message}
              aviso={avisoDoCampo('pressao_diastolica', cond.pressao_diastolica)}
              {...register('pressao_diastolica')}
            />
            <Input
              label="Frequência cardíaca"
              type="number"
              inputMode="numeric"
              sufixo="bpm"
              erro={errors.frequencia_cardiaca?.message}
              aviso={avisoDoCampo('frequencia_cardiaca', cond.frequencia_cardiaca)}
              {...register('frequencia_cardiaca')}
            />
            <Input
              label="Temperatura"
              type="number"
              step="0.1"
              inputMode="decimal"
              sufixo="°C"
              erro={errors.temperatura?.message}
              aviso={avisoDoCampo('temperatura', cond.temperatura)}
              {...register('temperatura')}
            />
            <Input
              label="Saturação"
              type="number"
              inputMode="numeric"
              sufixo="%"
              erro={errors.saturacao?.message}
              aviso={avisoDoCampo('saturacao', cond.saturacao)}
              {...register('saturacao')}
            />
            <Input
              label="Glicemia capilar"
              type="number"
              inputMode="numeric"
              sufixo="mg/dL"
              erro={errors.glicemia?.message}
              aviso={avisoDoCampo('glicemia', cond.glicemia)}
              {...register('glicemia')}
            />
          </div>

          {cond.glicemia !== '' && cond.glicemia !== undefined && (
            <Controller
              control={control}
              name="glicemia_jejum"
              render={({ field }) => (
                <RadioSimNao
                  label="Em jejum?"
                  name={field.name}
                  valor={field.value ?? ''}
                  onChange={field.onChange}
                  opcoes={[
                    { valor: 'Sim', rotulo: 'Sim' },
                    { valor: 'Nao', rotulo: 'Não' },
                    { valor: 'NaoSei', rotulo: 'Não sei' },
                    { valor: '', rotulo: 'Não informado' },
                  ]}
                />
              )}
            />
          )}
        </SecaoFormulario>

        <SecaoFormulario titulo="Observações">
          <Textarea
            label="Descrição do atendimento"
            rows={5}
            placeholder="Relato, orientações dadas, queixas…"
            dica="Campo livre. Começa sempre vazio."
            erro={errors.descricao?.message}
            {...register('descricao')}
          />
        </SecaoFormulario>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" carregando={salvando}>
            {editandoData ? 'Salvar alterações' : 'Salvar registro'}
          </Button>
          <Button variante="secundario" onClick={onCancelar}>
            Cancelar
          </Button>
        </div>
      </form>

      <Modal
        aberto={avisosPendentes !== null}
        titulo={editandoData ? 'Confirmar alteração' : 'Confirmar valores'}
        rotuloConfirmar={editandoData ? 'Salvar alteração' : 'Confirmar e salvar'}
        rotuloCancelar="Revisar"
        carregando={salvando}
        onConfirmar={confirmar}
        onCancelar={() => setAvisosPendentes(null)}
      >
        {editandoData && (
          <p className="mb-3">
            Tem certeza que deseja salvar essa alteração no registro de{' '}
            <strong>{formatarData(editandoData)}</strong>? O valor anterior não poderá
            ser recuperado.
          </p>
        )}

        {avisosPendentes && avisosPendentes.length > 0 && (
          <>
            <p className="mb-2">Confirma que estes valores foram digitados corretamente?</p>
            <ul className="flex flex-col gap-1">
              {avisosPendentes.map((a) => (
                <li key={a.campo} className="rounded bg-aviso-50 px-3 py-1.5 text-aviso-700">
                  {a.rotulo}: <strong>{a.valor} {a.unidade}</strong>
                </li>
              ))}
            </ul>
          </>
        )}
      </Modal>
    </>
  )
}
