import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Alerta, CabecalhoPagina, EstadoVazio, TelaCarregando } from '@/components/ui/Feedback'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useAcesso } from '@/features/auth/useAcesso'
import { mensagemDeErro } from '@/lib/erros'
import { formatarDataHora } from '@/lib/format'
import type { UsuarioAutorizadoRow } from '@/types/database.types'
import {
  useAcessos,
  useAlterarAcesso,
  useDefinirSenha,
  useExcluirCadastro,
} from '../api/useAcessos'

type Confirmacao =
  | { tipo: 'nenhum' }
  | { tipo: 'revogar'; pessoa: UsuarioAutorizadoRow }
  | { tipo: 'promover'; pessoa: UsuarioAutorizadoRow }
  | { tipo: 'rebaixar'; pessoa: UsuarioAutorizadoRow }
  | { tipo: 'excluir'; pessoa: UsuarioAutorizadoRow }
  | { tipo: 'senha'; pessoa: UsuarioAutorizadoRow }

const MINIMO_SENHA = 8

export function AcessosPage() {
  const { acesso } = useAcesso()
  const { data: pessoas, isLoading, isError, error } = useAcessos()
  const alterar = useAlterarAcesso()
  const excluir = useExcluirCadastro()
  const definirSenha = useDefinirSenha()

  const [confirmacao, setConfirmacao] = useState<Confirmacao>({ tipo: 'nenhum' })
  const [erro, setErro] = useState<string | null>(null)
  // Erro da exclusão fica separado e aparece DENTRO do modal. O caso mais
  // comum — "esta pessoa já lançou dados" — é uma recusa que a pessoa precisa
  // ler no exato momento em que clicou; num alerta lá no topo da página, com o
  // modal aberto por cima, ela simplesmente não veria.
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)

  // Campos da troca de senha. Ficam em estado local e são zerados ao fechar o
  // modal: a senha em claro só existe na memória da tela pelo tempo do
  // preenchimento, e nunca entra em cache, URL ou localStorage.
  const [novaSenha, setNovaSenha] = useState('')
  const [repetirSenha, setRepetirSenha] = useState('')
  const [erroSenha, setErroSenha] = useState<string | null>(null)
  const [senhaTrocada, setSenhaTrocada] = useState(false)

  // Guarda de tela. É conforto: quem burlar continua sem conseguir alterar
  // nada, porque as policies exigem is_admin().
  if (!acesso?.admin) {
    return (
      <Alerta tipo="erro" titulo="Sem permissão">
        Esta área é exclusiva do administrador.
      </Alerta>
    )
  }

  if (isLoading) return <TelaCarregando />

  if (isError) {
    return (
      <Alerta tipo="erro" titulo="Não foi possível carregar">
        {mensagemDeErro(error)}
      </Alerta>
    )
  }

  const pendentes = (pessoas ?? []).filter((p) => !p.ativo)
  const liberados = (pessoas ?? []).filter((p) => p.ativo)

  function executar(fn: () => void) {
    setErro(null)
    fn()
  }

  function aplicar(id: string, mudanca: { ativo?: boolean; papel?: 'admin' | 'operador' }) {
    alterar.mutate(
      { id, ...mudanca },
      {
        onSuccess: () => setConfirmacao({ tipo: 'nenhum' }),
        onError: (e) => setErro(mensagemDeErro(e)),
      },
    )
  }

  function abrirExclusao(pessoa: UsuarioAutorizadoRow) {
    setErroExclusao(null)
    setConfirmacao({ tipo: 'excluir', pessoa })
  }

  function fecharExclusao() {
    setErroExclusao(null)
    setConfirmacao({ tipo: 'nenhum' })
  }

  function abrirSenha(pessoa: UsuarioAutorizadoRow) {
    setNovaSenha('')
    setRepetirSenha('')
    setErroSenha(null)
    setSenhaTrocada(false)
    setConfirmacao({ tipo: 'senha', pessoa })
  }

  function fecharSenha() {
    // Zerar os campos ao fechar é parte da higiene: sem isto, a senha ficaria
    // no estado do React até a página ser recarregada, e reapareceria escrita
    // se o modal fosse aberto de novo para outra pessoa.
    setNovaSenha('')
    setRepetirSenha('')
    setErroSenha(null)
    setSenhaTrocada(false)
    setConfirmacao({ tipo: 'nenhum' })
  }

  function confirmarSenha(id: string) {
    setErroSenha(null)

    // Validação de tela: rápida e sem ida ao servidor. A regra que VALE é a da
    // função definir_senha, que confere o mesmo mínimo no banco.
    if (novaSenha.length < MINIMO_SENHA) {
      setErroSenha(`A senha precisa ter pelo menos ${MINIMO_SENHA} caracteres.`)
      return
    }
    if (novaSenha !== repetirSenha) {
      setErroSenha('As senhas não são iguais.')
      return
    }

    definirSenha.mutate(
      { id, senha: novaSenha },
      {
        onSuccess: () => {
          // Não fecha sozinho: a tela precisa dizer o que fazer em seguida,
          // que é avisar a pessoa e pedir que ela troque por uma só dela.
          setSenhaTrocada(true)
          setNovaSenha('')
          setRepetirSenha('')
        },
        onError: (e) => setErroSenha(mensagemDeErro(e)),
      },
    )
  }

  function confirmarExclusao(id: string) {
    setErroExclusao(null)
    excluir.mutate(id, {
      onSuccess: fecharExclusao,
      // Fica ABERTO no erro, de propósito: fechar o modal daria a impressão de
      // que deu certo. As recusas aqui são informativas, não falhas técnicas.
      onError: (e) => setErroExclusao(mensagemDeErro(e)),
    })
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Acessos"
        subtitulo="Quem pode entrar no sistema e o que cada um pode fazer"
      />

      {erro && (
        <div className="mb-4">
          <Alerta tipo="erro" titulo="Não foi possível alterar">
            {erro}
          </Alerta>
        </div>
      )}

      {/* Pendentes primeiro e em destaque: é a única coisa nesta tela que
          exige ação. */}
      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          Aguardando liberação
          {pendentes.length > 0 && (
            <span className="ml-2 rounded-full bg-aviso-200 px-2 py-0.5 text-sm text-aviso-700">
              {pendentes.length}
            </span>
          )}
        </h2>

        {pendentes.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum pedido pendente"
            descricao="Quando alguém criar um cadastro, ele aparece aqui para você liberar."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {pendentes.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-aviso-200 bg-aviso-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{p.nome ?? 'Sem nome informado'}</p>
                  <p className="text-sm text-slate-600">{p.email}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Pedido em {formatarDataHora(p.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    tamanho="sm"
                    carregando={alterar.isPending}
                    onClick={() => executar(() => aplicar(p.id, { ativo: true }))}
                  >
                    Liberar acesso
                  </Button>
                  {/* Cadastro indesejado se resolve aqui: quem está pendente
                      nunca conseguiu lançar nada (o RLS exige autorização),
                      então a exclusão sempre passa neste bloco. */}
                  <Button
                    variante="secundario"
                    tamanho="sm"
                    onClick={() => abrirExclusao(p)}
                  >
                    Excluir
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          Com acesso liberado
          <span className="ml-2 font-normal text-slate-500">({liberados.length})</span>
        </h2>

        <ul className="flex flex-col gap-2">
          {liberados.map((p) => {
            const souEu = p.user_id === acesso.userId
            return (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {p.nome ?? 'Sem nome informado'}
                    {p.papel === 'admin' && (
                      <span className="ml-2 rounded bg-marca-50 px-2 py-0.5 text-xs text-marca-700">
                        administrador
                      </span>
                    )}
                    {souEu && (
                      <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        você
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-slate-600">{p.email}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {/* Senha aparece TAMBÉM na própria linha, ao contrário dos
                      outros botões: trocar a própria senha não tranca ninguém
                      para fora, e é o caminho para você mesmo se destravar
                      quando o e-mail de recuperação não chega. */}
                  <Button variante="secundario" tamanho="sm" onClick={() => abrirSenha(p)}>
                    Alterar senha
                  </Button>

                  {/* O resto some na própria linha — o banco recusa mexer no
                      próprio acesso (trigger tg_proteger_admin), e esconder
                      aqui evita oferecer um botão que só daria erro. */}
                  {!souEu && (
                    <>
                    {p.papel === 'operador' ? (
                      <Button
                        variante="secundario"
                        tamanho="sm"
                        onClick={() => setConfirmacao({ tipo: 'promover', pessoa: p })}
                      >
                        Tornar administrador
                      </Button>
                    ) : (
                      <Button
                        variante="secundario"
                        tamanho="sm"
                        onClick={() => setConfirmacao({ tipo: 'rebaixar', pessoa: p })}
                      >
                        Remover administrador
                      </Button>
                    )}
                    <Button
                      variante="perigo"
                      tamanho="sm"
                      onClick={() => setConfirmacao({ tipo: 'revogar', pessoa: p })}
                    >
                      Revogar
                    </Button>
                    <Button
                      variante="perigo"
                      tamanho="sm"
                      onClick={() => abrirExclusao(p)}
                    >
                      Excluir
                    </Button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="mt-8">
        <Alerta tipo="info" titulo="Como funciona">
          Quem se cadastra entra na lista de espera e não vê nenhum dado até você
          liberar.
          <br />
          <strong>Revogar</strong> tira o acesso na hora — a pessoa continua na
          lista e nada é apagado. É o certo para quem saiu da equipe.
          <br />
          <strong>Excluir</strong> apaga o cadastro e a conta de login. É o certo
          para cadastro indesejado ou e-mail digitado errado. Quem já lançou
          algum dado não pode ser excluído.
          <br />
          <strong>Alterar senha</strong> destrava quem perdeu o acesso e não
          consegue receber o e-mail de recuperação. Combine a senha nova
          diretamente com a pessoa e peça que ela troque depois.
        </Alerta>
      </div>

      {/* ------------------------------ Confirmações ------------------------ */}

      <Modal
        aberto={confirmacao.tipo === 'revogar'}
        titulo="Revogar acesso"
        rotuloConfirmar="Revogar"
        varianteConfirmar="perigo"
        carregando={alterar.isPending}
        onConfirmar={() =>
          confirmacao.tipo === 'revogar' &&
          executar(() => aplicar(confirmacao.pessoa.id, { ativo: false }))
        }
        onCancelar={() => setConfirmacao({ tipo: 'nenhum' })}
      >
        <p>
          <strong>
            {confirmacao.tipo === 'revogar'
              ? (confirmacao.pessoa.nome ?? confirmacao.pessoa.email)
              : ''}
          </strong>{' '}
          deixa de ver os dados imediatamente. O que essa pessoa já lançou continua
          registrado, com o nome dela. Dá para liberar de novo depois.
        </p>
      </Modal>

      <Modal
        aberto={confirmacao.tipo === 'promover'}
        titulo="Tornar administrador"
        rotuloConfirmar="Tornar administrador"
        carregando={alterar.isPending}
        onConfirmar={() =>
          confirmacao.tipo === 'promover' &&
          executar(() => aplicar(confirmacao.pessoa.id, { papel: 'admin' }))
        }
        onCancelar={() => setConfirmacao({ tipo: 'nenhum' })}
      >
        <p>
          <strong>
            {confirmacao.tipo === 'promover'
              ? (confirmacao.pessoa.nome ?? confirmacao.pessoa.email)
              : ''}
          </strong>{' '}
          passa a poder liberar e revogar acessos, e a excluir atendidos
          permanentemente.
        </p>
      </Modal>

      <Modal
        aberto={confirmacao.tipo === 'rebaixar'}
        titulo="Remover administrador"
        rotuloConfirmar="Remover"
        varianteConfirmar="perigo"
        carregando={alterar.isPending}
        onConfirmar={() =>
          confirmacao.tipo === 'rebaixar' &&
          executar(() => aplicar(confirmacao.pessoa.id, { papel: 'operador' }))
        }
        onCancelar={() => setConfirmacao({ tipo: 'nenhum' })}
      >
        <p>
          A pessoa continua com acesso ao sistema, mas deixa de gerenciar acessos e
          de excluir atendidos.
        </p>
      </Modal>

      {/* ============================================================
          EXCLUSÃO DO CADASTRO

          Sem trava de digitar palavra, ao contrário da exclusão de atendido.
          A diferença é o tamanho do estrago: lá some prontuário, aqui some um
          login que a pessoa pode criar de novo em trinta segundos. Uma trava
          desproporcional ao risco só ensina a ignorar as travas.

          A proteção que importa está no banco: quem já lançou qualquer dado
          simplesmente não pode ser excluído.
      ============================================================ */}
      <Modal
        aberto={confirmacao.tipo === 'excluir'}
        titulo="Excluir cadastro"
        rotuloConfirmar="Excluir cadastro"
        varianteConfirmar="perigo"
        carregando={excluir.isPending}
        onConfirmar={() =>
          confirmacao.tipo === 'excluir' && confirmarExclusao(confirmacao.pessoa.id)
        }
        onCancelar={fecharExclusao}
      >
        {erroExclusao && (
          <div className="mb-3">
            <Alerta tipo="erro" titulo="Não foi possível excluir">
              {erroExclusao}
            </Alerta>
          </div>
        )}

        <p>
          O cadastro de{' '}
          <strong>
            {confirmacao.tipo === 'excluir'
              ? (confirmacao.pessoa.nome ?? confirmacao.pessoa.email)
              : ''}
          </strong>{' '}
          será apagado, junto com a conta de login e a senha. A pessoa some desta
          lista e, se quiser voltar, precisa se cadastrar do zero e esperar
          aprovação de novo.
        </p>

        <p className="mt-3">
          Se ela apenas saiu da equipe, prefira <strong>Revogar</strong>: o acesso
          acaba na hora e o cadastro fica registrado.
        </p>

        <p className="mt-3 text-slate-500">
          Se esta pessoa já tiver lançado algum atendido, registro ou evento, o
          sistema vai recusar a exclusão — apagar a conta apagaria a identificação
          de quem fez aqueles lançamentos.
        </p>
      </Modal>

      {/* ============================================================
          DEFINIR SENHA

          Existe porque o "Esqueci minha senha" depende de e-mail, e o e-mail
          é o elo frágil aqui (cota do plano gratuito). No meio de um evento,
          "espere uma hora" não serve.

          O custo está escrito na tela de propósito: quem define a senha de
          alguém pode entrar como essa pessoa. Esconder isso da interface não
          faria o fato deixar de existir — só faria a responsável decidir sem
          saber. O pedido final ("peça para trocar depois") é o que devolve a
          exclusividade da senha ao dono dela.
      ============================================================ */}
      <Modal
        aberto={confirmacao.tipo === 'senha'}
        titulo="Alterar senha"
        rotuloConfirmar={senhaTrocada ? 'Fechar' : 'Salvar nova senha'}
        rotuloCancelar={senhaTrocada ? 'Fechar' : 'Cancelar'}
        carregando={definirSenha.isPending}
        onConfirmar={() => {
          if (senhaTrocada) return fecharSenha()
          if (confirmacao.tipo === 'senha') confirmarSenha(confirmacao.pessoa.id)
        }}
        onCancelar={fecharSenha}
      >
        {senhaTrocada ? (
          <Alerta tipo="info" titulo="Senha alterada">
            Passe a senha nova para a pessoa por um canal direto — pessoalmente,
            ligação ou mensagem. Peça que ela entre e troque por uma senha só dela
            em "Esqueci minha senha" assim que puder, para voltar a ser a única a
            saber. As sessões que ela tinha abertas foram encerradas.
          </Alerta>
        ) : (
          <div className="flex flex-col gap-3">
            {erroSenha && <Alerta tipo="erro">{erroSenha}</Alerta>}

            <p>
              Você vai definir uma senha nova para{' '}
              <strong>
                {confirmacao.tipo === 'senha'
                  ? (confirmacao.pessoa.nome ?? confirmacao.pessoa.email)
                  : ''}
              </strong>
              . A senha atual deixa de funcionar na hora.
            </p>

            <Input
              label="Nova senha"
              type="password"
              autoComplete="new-password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              dica={`Mínimo de ${MINIMO_SENHA} caracteres.`}
            />

            <Input
              label="Repita a nova senha"
              type="password"
              autoComplete="new-password"
              value={repetirSenha}
              onChange={(e) => setRepetirSenha(e.target.value)}
            />

            <p className="text-slate-500">
              Enquanto a pessoa não trocar, vocês dois conhecem a senha dela — e
              tudo que for lançado com essa conta aparecerá no nome dela. Use isto
              para destravar quem perdeu o acesso, não como rotina.
            </p>
          </div>
        )}
      </Modal>
    </>
  )
}
