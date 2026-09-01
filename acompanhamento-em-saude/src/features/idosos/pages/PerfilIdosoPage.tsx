import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Alerta, CabecalhoPagina, Card, TelaCarregando } from '@/components/ui/Feedback'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useRegistros } from '@/features/registros/api/useRegistros'
import { TimelineRegistros } from '@/features/registros/components/TimelineRegistros'
import { mensagemDeErro } from '@/lib/erros'
import { calcularIdade, formatarData, formatarDataHora, formatarTelefone } from '@/lib/format'
import { useIdoso } from '../api/useIdosos'
import { useAutores } from '@/features/acessos/api/autores'
import { useEhAdmin } from '@/features/auth/useAcesso'
import { useDesativarIdoso, useExcluirIdoso, useReativarIdoso } from '../api/useSalvarIdoso'

export function PerfilIdosoPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: idoso, isLoading, isError, error } = useIdoso(id)
  const { data: registros, isLoading: carregandoRegistros } = useRegistros(id)
  const desativar = useDesativarIdoso()
  const reativar = useReativarIdoso()
  const excluir = useExcluirIdoso()
  // Esconder o botão é conforto visual. Quem realmente impede a exclusão é a
  // policy idosos_delete com is_admin(), no banco.
  const ehAdmin = useEhAdmin()
  const autorDe = useAutores()

  const [confirmandoInativar, setConfirmandoInativar] = useState(false)
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false)
  // Trava de segurança: o botão de excluir só libera quando esta palavra
  // estiver digitada. Ver o modal lá embaixo.
  const [textoConfirmacao, setTextoConfirmacao] = useState('')
  const [erroExcluir, setErroExcluir] = useState<string | null>(null)

  const PALAVRA = 'EXCLUIR'
  const podeExcluir = textoConfirmacao.trim().toUpperCase() === PALAVRA

  function fecharExcluir() {
    setConfirmandoExcluir(false)
    setTextoConfirmacao('')
    setErroExcluir(null)
  }

  if (isLoading) return <TelaCarregando />

  if (isError) {
    return (
      <Alerta tipo="erro" titulo="Não foi possível carregar">
        {mensagemDeErro(error)}
      </Alerta>
    )
  }

  if (!idoso) {
    return (
      <Alerta tipo="erro" titulo="Atendido não encontrado">
        O cadastro pode ter sido removido ou o endereço está incorreto.
      </Alerta>
    )
  }

  const idade = calcularIdade(idoso.data_nascimento)

  const dados = [
    { rotulo: 'Data de nascimento', valor: formatarData(idoso.data_nascimento) },
    { rotulo: 'Idade', valor: idade === null ? '—' : `${idade} anos` },
    { rotulo: 'Gênero', valor: idoso.genero ?? '—' },
    { rotulo: 'Telefone', valor: formatarTelefone(idoso.telefone) },
    { rotulo: 'Endereço', valor: idoso.endereco ?? '—' },
  ]

  return (
    <>
      <div className="mb-2">
        <Link to="/idosos" className="text-sm text-marca-700 hover:underline">
          ← Voltar para a lista
        </Link>
      </div>

      <CabecalhoPagina
        titulo={idoso.nome}
        subtitulo={idade === null ? undefined : `${idade} anos`}
        acoes={
          <>
            <Button onClick={() => navigate(`/idosos/${idoso.id}/registros/novo`)}>
              + Adicionar registro
            </Button>
            <Button variante="secundario" onClick={() => navigate(`/idosos/${idoso.id}/editar`)}>
              Editar
            </Button>
          </>
        }
      />

      {/* Q3: inativo continua acessível por link direto, com aviso claro. */}
      {!idoso.ativo && (
        <div className="mb-4">
          <Alerta tipo="aviso" titulo="Cadastro inativo">
            Este atendido foi marcado como inativo e não aparece na lista. O histórico
            permanece intacto.
            <div className="mt-2">
              <Button
                variante="secundario"
                tamanho="sm"
                carregando={reativar.isPending}
                onClick={() => reativar.mutate(idoso.id)}
              >
                Reativar cadastro
              </Button>
            </div>
          </Alerta>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <h2 className="mb-3 text-base font-semibold text-slate-900">Cadastro</h2>
            <dl className="flex flex-col gap-3">
              {dados.map((d) => (
                <div key={d.rotulo}>
                  <dt className="text-xs text-slate-500">{d.rotulo}</dt>
                  <dd className="text-sm text-slate-800">{d.valor}</dd>
                </div>
              ))}
            </dl>

            {/* Quem cadastrou e quem editou por último. `updated_by` só existe
                depois da primeira edição — é o trigger de auditoria que o
                preenche, então a ausência dele significa "nunca foi editado". */}
            <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
              Cadastrado em {formatarDataHora(idoso.created_at)} por{' '}
              {autorDe(idoso.created_by)}
              {idoso.updated_by &&
                ` · editado em ${formatarDataHora(idoso.updated_at)} por ${autorDe(idoso.updated_by)}`}
            </p>

            {idoso.ativo && (
              <div className="mt-4">
                <Button
                  variante="perigo"
                  tamanho="sm"
                  onClick={() => setConfirmandoInativar(true)}
                >
                  Marcar como inativo
                </Button>
                {ehAdmin && (
                  <Button
                    variante="perigo"
                    tamanho="sm"
                    className="mt-2 w-full"
                    onClick={() => setConfirmandoExcluir(true)}
                  >
                    Excluir permanentemente
                  </Button>
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-2">
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Histórico de atendimentos
            {registros && registros.length > 0 && (
              <span className="ml-2 font-normal text-slate-500">({registros.length})</span>
            )}
          </h2>

          {carregandoRegistros ? (
            <TelaCarregando mensagem="Carregando histórico…" />
          ) : (
            <TimelineRegistros registros={registros ?? []} idosoId={idoso.id} />
          )}
        </div>
      </div>

      <Modal
        aberto={confirmandoInativar}
        titulo="Marcar cadastro como inativo"
        rotuloConfirmar="Marcar como inativo"
        varianteConfirmar="perigo"
        carregando={desativar.isPending}
        onConfirmar={() => {
          desativar.mutate(idoso.id, { onSuccess: () => setConfirmandoInativar(false) })
        }}
        onCancelar={() => setConfirmandoInativar(false)}
      >
        <p>
          <strong>{idoso.nome}</strong> deixa de aparecer na lista, mas nada é apagado:
          o cadastro e todo o histórico de atendimentos continuam guardados e podem
          ser reativados a qualquer momento.
        </p>
      </Modal>

      {/* ============================================================
          EXCLUSÃO PERMANENTE

          Padrão de "confirmação por digitação", o mesmo que o GitHub usa para
          apagar repositório. O motivo de existir: um clique acidental aqui
          destrói prontuário de forma irreversível, e um modal comum de
          "Confirmar / Cancelar" é fácil demais de aceitar no automático.

          Obrigar a digitar a palavra quebra o piloto automático — não dá para
          fazer sem ler.
      ============================================================ */}
      <Modal
        aberto={confirmandoExcluir}
        titulo="⚠️ Atenção: exclusão permanente"
        rotuloConfirmar="Excluir permanentemente"
        rotuloCancelar="Cancelar"
        varianteConfirmar="perigo"
        carregando={excluir.isPending}
        confirmarDesabilitado={!podeExcluir}
        onConfirmar={() => {
          if (!podeExcluir) return
          setErroExcluir(null)
          excluir.mutate(idoso.id, {
            onSuccess: () => {
              fecharExcluir()
              navigate('/idosos', { replace: true })
            },
            onError: (e) => setErroExcluir(mensagemDeErro(e)),
          })
        }}
        onCancelar={fecharExcluir}
      >
        {erroExcluir && (
          <div className="mb-3">
            <Alerta tipo="erro">{erroExcluir}</Alerta>
          </div>
        )}

        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="font-medium text-red-800">Isto não pode ser desfeito.</p>
          <ul className="mt-2 list-disc pl-4 text-red-800">
            <li>
              O cadastro de <strong>{idoso.nome}</strong> será apagado do banco de dados.
            </li>
            <li>
              {registros && registros.length > 0
                ? `Os ${registros.length} atendimento(s) do histórico serão apagados junto.`
                : 'Nenhum atendimento será perdido — este cadastro não tem histórico.'}
            </li>
            <li>Não há como recuperar pelo sistema, nem saber que esta pessoa existiu.</li>
          </ul>
        </div>

        <p className="mb-2">
          Se for apenas para tirar da lista, prefira <strong>Marcar como inativo</strong>:
          some da lista e nada é perdido.
        </p>

        <Input
          label={`Para confirmar, digite ${PALAVRA}`}
          value={textoConfirmacao}
          onChange={(e) => setTextoConfirmacao(e.target.value)}
          placeholder={PALAVRA}
          autoComplete="off"
          dica={
            podeExcluir
              ? undefined
              : 'O botão de excluir só libera depois que a palavra estiver correta.'
          }
        />
      </Modal>
    </>
  )
}
