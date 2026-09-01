import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Alerta, CabecalhoPagina, TelaCarregando } from '@/components/ui/Feedback'
import { Modal, ModalSimples } from '@/components/ui/Modal'
import { mensagemDeErro } from '@/lib/erros'
import { formatarData } from '@/lib/format'
import type { CompraLoteRow, ProdutoEventoRow } from '@/types/database.types'
import {
  useAutores,
  useComprasLote,
  useExcluirEvento,
  useEvento,
  useExcluirCompraLote,
  useExcluirProduto,
  useProdutos,
  useReativarEvento,
  useSalvarCompraLote,
  useSalvarProduto,
  useTotais,
} from '../api/useFinanceiro'
import { CompraLoteForm, ProdutoForm } from '../components/FormulariosLancamento'
import {
  ListaComprasLote,
  ListaProdutos,
  ResumoTotais,
} from '../components/ListasLancamentos'
import type {
  CompraLoteFormSaida,
  ProdutoFormSaida,
} from '../schemas/financeiro.schema'

/** O que está aberto no momento. Um estado só evita modais concorrentes. */
type Aberto =
  | { tipo: 'nenhum' }
  | { tipo: 'produto'; item?: ProdutoEventoRow }
  | { tipo: 'lote'; item?: CompraLoteRow }
  | { tipo: 'excluir-produto'; item: ProdutoEventoRow }
  | { tipo: 'excluir-lote'; item: CompraLoteRow }
  | { tipo: 'excluir-evento' }

export function EventoPage() {
  const { id } = useParams<{ id: string }>()
  const eventoId = id!
  const navigate = useNavigate()

  const { data: evento, isLoading, isError, error } = useEvento(eventoId)
  const { data: produtos } = useProdutos(eventoId)
  const { data: compras } = useComprasLote(eventoId)
  const { data: totais } = useTotais(eventoId)
  const autorDe = useAutores()

  const [aberto, setAberto] = useState<Aberto>({ tipo: 'nenhum' })
  const [erroModal, setErroModal] = useState<string | null>(null)

  const produtoEditando = aberto.tipo === 'produto' ? aberto.item : undefined
  const loteEditando = aberto.tipo === 'lote' ? aberto.item : undefined

  const salvarProduto = useSalvarProduto(eventoId, produtoEditando?.id)
  const salvarLote = useSalvarCompraLote(eventoId, loteEditando?.id)
  const excluirProduto = useExcluirProduto(eventoId)
  const excluirLote = useExcluirCompraLote(eventoId)
  const excluirEvento = useExcluirEvento()
  const reativarEvento = useReativarEvento()

  function fechar() {
    setAberto({ tipo: 'nenhum' })
    setErroModal(null)
  }

  async function aoSalvarProduto(dados: ProdutoFormSaida) {
    setErroModal(null)
    try {
      await salvarProduto.mutateAsync(dados)
      fechar()
    } catch (e) {
      setErroModal(mensagemDeErro(e))
    }
  }

  async function aoSalvarLote(dados: CompraLoteFormSaida) {
    setErroModal(null)
    try {
      await salvarLote.mutateAsync(dados)
      fechar()
    } catch (e) {
      setErroModal(mensagemDeErro(e))
    }
  }

  if (isLoading) return <TelaCarregando />

  if (isError) {
    return (
      <Alerta tipo="erro" titulo="Não foi possível carregar">
        {mensagemDeErro(error)}
      </Alerta>
    )
  }

  if (!evento) {
    return (
      <Alerta tipo="erro" titulo="Evento não encontrado">
        O endereço pode estar incorreto.
      </Alerta>
    )
  }

  return (
    <>
      <div className="mb-2">
        <Link to="/financeiro" className="text-sm text-marca-700 hover:underline">
          ← Voltar para os eventos
        </Link>
      </div>

      <CabecalhoPagina
        titulo={evento.nome}
        subtitulo={evento.data_evento ? formatarData(evento.data_evento) : 'sem data definida'}
        acoes={
          <Button
            variante="secundario"
            onClick={() => navigate(`/financeiro/${eventoId}/editar`)}
          >
            Editar evento
          </Button>
        }
      />

      {/* F13: evento inativo continua acessível por link direto. */}
      {!evento.ativo && (
        <div className="mb-4">
          <Alerta tipo="aviso" titulo="Evento inativo">
            Não aparece na lista, mas os lançamentos continuam guardados.
            <div className="mt-2">
              <Button
                variante="secundario"
                tamanho="sm"
                carregando={reativarEvento.isPending}
                onClick={() => reativarEvento.mutate(eventoId)}
              >
                Reativar evento
              </Button>
            </div>
          </Alerta>
        </div>
      )}

      {/* Totais no topo, sempre visíveis, sem precisar rolar. */}
      <ResumoTotais
        produtos={totais?.total_produtos ?? 0}
        lotes={totais?.total_lotes ?? 0}
        geral={totais?.total_geral ?? 0}
      />

      {/* Os DOIS botões ficam aqui em cima, juntos.
          Antes cada um ficava no cabeçalho da sua seção, e o de compra em lote
          só aparecia depois de rolar a lista inteira de produtos — quanto mais
          produtos lançados, mais longe ele ficava. Agora as duas ações estão
          sempre à mão, na mesma altura, em qualquer tamanho de tela.
          No celular os botões ocupam metade da largura cada um. */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:flex">
        <Button onClick={() => setAberto({ tipo: 'produto' })}>+ Produto</Button>
        <Button onClick={() => setAberto({ tipo: 'lote' })}>+ Compra em lote</Button>
      </div>

      {/* Duas colunas no computador, empilhado no celular.
          `items-start` impede que a coluna mais curta estique junto com a mais
          longa — sem isso, uma lista com 1 item ficaria com um vazio enorme
          embaixo para acompanhar a altura da outra. */}
      <div className="mb-8 grid items-start gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Produtos individuais
            {produtos && produtos.length > 0 && (
              <span className="ml-2 font-normal text-slate-500">({produtos.length})</span>
            )}
          </h2>
          <ListaProdutos
            produtos={produtos ?? []}
            autorDe={autorDe}
            onEditar={(item) => setAberto({ tipo: 'produto', item })}
            onExcluir={(item) => setAberto({ tipo: 'excluir-produto', item })}
          />
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Compras em lote
            {compras && compras.length > 0 && (
              <span className="ml-2 font-normal text-slate-500">({compras.length})</span>
            )}
          </h2>
          <ListaComprasLote
            compras={compras ?? []}
            autorDe={autorDe}
            onEditar={(item) => setAberto({ tipo: 'lote', item })}
            onExcluir={(item) => setAberto({ tipo: 'excluir-lote', item })}
          />
        </section>
      </div>

      <Button
        variante="perigo"
        tamanho="sm"
        onClick={() => setAberto({ tipo: 'excluir-evento' })}
      >
        Excluir evento
      </Button>

      {/* --- Modais (F8) ---------------------------------------------------- */}

      <ModalSimples
        aberto={aberto.tipo === 'produto'}
        titulo={produtoEditando ? 'Editar produto' : 'Adicionar produto'}
        onFechar={fechar}
      >
        <ProdutoForm
          produto={produtoEditando}
          salvando={salvarProduto.isPending}
          erro={erroModal}
          onSalvar={aoSalvarProduto}
          onCancelar={fechar}
        />
      </ModalSimples>

      <ModalSimples
        aberto={aberto.tipo === 'lote'}
        titulo={loteEditando ? 'Editar compra em lote' : 'Adicionar compra em lote'}
        largura="40rem"
        onFechar={fechar}
      >
        <CompraLoteForm
          compra={loteEditando}
          salvando={salvarLote.isPending}
          erro={erroModal}
          onSalvar={aoSalvarLote}
          onCancelar={fechar}
        />
      </ModalSimples>

      {/* F11: confirmação antes de excluir. É soft delete — sai da tela e não
          dá para desfazer por aqui, então perguntar é barato. */}
      <Modal
        aberto={aberto.tipo === 'excluir-produto'}
        titulo="Excluir produto"
        rotuloConfirmar="Excluir"
        varianteConfirmar="perigo"
        carregando={excluirProduto.isPending}
        onConfirmar={() => {
          if (aberto.tipo !== 'excluir-produto') return
          excluirProduto.mutate(aberto.item.id, { onSuccess: fechar })
        }}
        onCancelar={fechar}
      >
        <p>
          Excluir <strong>{aberto.tipo === 'excluir-produto' ? aberto.item.nome : ''}</strong> da
          lista? O total do evento será recalculado.
        </p>
      </Modal>

      <Modal
        aberto={aberto.tipo === 'excluir-lote'}
        titulo="Excluir compra em lote"
        rotuloConfirmar="Excluir"
        varianteConfirmar="perigo"
        carregando={excluirLote.isPending}
        onConfirmar={() => {
          if (aberto.tipo !== 'excluir-lote') return
          excluirLote.mutate(aberto.item.id, { onSuccess: fechar })
        }}
        onCancelar={fechar}
      >
        <p>
          Excluir <strong>{aberto.tipo === 'excluir-lote' ? aberto.item.descricao : ''}</strong> da
          lista? O total do evento será recalculado.
        </p>
      </Modal>

      {/* Exclusão REAL — diferente de tudo o mais no sistema, não dá para
          desfazer. O texto diz isso com todas as letras e mostra quantos
          lançamentos vão junto, para a decisão ser informada. */}
      <Modal
        aberto={aberto.tipo === 'excluir-evento'}
        titulo="Tem certeza que deseja excluir este evento?"
        rotuloConfirmar="Sim, excluir"
        rotuloCancelar="Não, manter"
        varianteConfirmar="perigo"
        carregando={excluirEvento.isPending}
        onConfirmar={() =>
          excluirEvento.mutate(eventoId, {
            onSuccess: () => {
              fechar()
              navigate('/financeiro')
            },
          })
        }
        onCancelar={fechar}
      >
        <p className="mb-2">
          O evento <strong>{evento.nome}</strong> será apagado do banco de dados junto
          com {(produtos?.length ?? 0) + (compras?.length ?? 0)} lançamento(s).
        </p>
        <p className="font-medium text-red-700">Não é possível desfazer.</p>
      </Modal>
    </>
  )
}
