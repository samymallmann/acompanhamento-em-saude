import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Alerta, CabecalhoPagina, EstadoVazio, TelaCarregando } from '@/components/ui/Feedback'
import { Input } from '@/components/ui/Input'
import { ModalSimples } from '@/components/ui/Modal'
import { useGerarFichaCampo } from '@/features/campo/api/useFichaCampo'
import { ImportarFicha } from '@/features/campo/components/ImportarFicha'
import { useDebounce } from '@/hooks/useDebounce'
import { mensagemDeErro } from '@/lib/erros'
import { calcularIdade, formatarData, formatarTelefone } from '@/lib/format'
import { useIdosos } from '../api/useIdosos'

export function ListaIdososPage() {
  const navigate = useNavigate()
  const [busca, setBusca] = useState('')
  const buscaAdiada = useDebounce(busca)
  const { data: idosos, isLoading, isError, error } = useIdosos(buscaAdiada)

  const gerarFicha = useGerarFichaCampo()
  const [fichaAberta, setFichaAberta] = useState(false)
  const [importarAberto, setImportarAberto] = useState(false)

  return (
    <>
      <CabecalhoPagina
        titulo="Atendidos"
        subtitulo="Cadastro e histórico de atendimentos"
        acoes={
          <>
            <Button onClick={() => navigate('/idosos/novo')}>+ Novo atendido</Button>
            {/* Ambos disponíveis para qualquer pessoa autorizada. A importação
                grava em nome de terceiros — a exceção aberta pela migration
                0012 e alargada pela 0013, com o custo explicado lá. */}
            <Button variante="secundario" onClick={() => setFichaAberta(true)}>
              Ficha de campo
            </Button>
            <Button variante="secundario" onClick={() => setImportarAberto(true)}>
              Importar ficha
            </Button>
          </>
        }
      />

      <ModalSimples
        aberto={importarAberto}
        titulo="Importar ficha de campo"
        largura="40rem"
        onFechar={() => setImportarAberto(false)}
      >
        <ImportarFicha onFechar={() => setImportarAberto(false)} />
      </ModalSimples>

      {/* ============================================================
          FICHA DE CAMPO

          Gera um arquivo .html autossuficiente para usar no evento, onde não
          há internet. O arquivo carrega os dados dentro de si — por isso as
          duas versões, e por isso o aviso: a partir do download, aquele
          arquivo está fora de tudo que protege o sistema.
      ============================================================ */}
      <ModalSimples
        aberto={fichaAberta}
        titulo="Ficha de campo"
        largura="34rem"
        onFechar={() => {
          setFichaAberta(false)
          gerarFicha.reset()
        }}
      >
        <div className="flex flex-col gap-4 text-sm text-slate-600">
          <p>
            Gera um arquivo para anotar atendimentos <strong>sem internet</strong>.
            Salve no computador ou envie para quem vai ajudar. Abrindo o arquivo, a
            pessoa anota o dia inteiro e no fim exporta o texto para você lançar aqui.
          </p>

          {gerarFicha.isError && (
            <Alerta tipo="erro" titulo="Não foi possível gerar">
              {mensagemDeErro(gerarFicha.error)}
            </Alerta>
          )}

          {gerarFicha.isSuccess && (
            <Alerta tipo="info" titulo="Arquivo baixado">
              {gerarFicha.data.quantidade} atendidos incluídos. Procure na pasta de
              downloads. Para abrir, dê dois cliques — não precisa de internet.
            </Alerta>
          )}

          <div className="rounded-xl border border-slate-200 p-4">
            <p className="font-medium text-slate-900">O que vai no arquivo</p>
            <ul className="mt-1 list-inside list-disc">
              <li>Cadastro de cada atendido, com aviso do que está faltando</li>
              <li>Histórico dos atendimentos anteriores, para consultar na hora</li>
              <li>A lista da equipe, para a pessoa escolher o próprio nome</li>
            </ul>
          </div>

          {/* O aviso fica em destaque porque a exposição é real: a partir do
              download, aquele arquivo não tem mais login, RLS nem revogação. */}
          <div className="rounded-xl border border-aviso-200 bg-aviso-50 p-4">
            <p className="font-medium text-aviso-700">Antes de enviar para alguém</p>
            <p className="mt-1 text-aviso-700">
              O arquivo carrega dados de saúde e não tem senha nem login. Quem tiver
              o arquivo, tem os dados — e não há como revogar depois de enviado.
              Mande só para quem vai atender, e peça que apague quando o evento
              acabar.
            </p>
          </div>

          <div>
            <Button carregando={gerarFicha.isPending} onClick={() => gerarFicha.mutate()}>
              Gerar ficha de campo
            </Button>
          </div>

          <p className="text-xs text-slate-500">
            Os dados ficam congelados no momento da geração. Gere o arquivo pouco
            antes de sair, para não faltar quem foi cadastrado depois.
          </p>
        </div>
      </ModalSimples>

      <div className="mb-4 max-w-sm">
        <Input
          label="Buscar por nome"
          type="search"
          placeholder="Digite parte do nome…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {isError && (
        <Alerta tipo="erro" titulo="Não foi possível carregar a lista">
          {mensagemDeErro(error)}
        </Alerta>
      )}

      {isLoading && <TelaCarregando />}

      {idosos && idosos.length === 0 && (
        <EstadoVazio
          titulo={buscaAdiada ? 'Nenhum atendido encontrado' : 'Nenhum atendido cadastrado ainda'}
          descricao={
            buscaAdiada
              ? `Nenhum nome contém "${buscaAdiada}". Verifique a grafia — a busca hoje diferencia acentos.`
              : 'Cadastre a primeira pessoa para começar o acompanhamento.'
          }
          acao={
            !buscaAdiada && (
              <Button onClick={() => navigate('/idosos/novo')}>+ Novo atendido</Button>
            )
          }
        />
      )}

      {idosos && idosos.length > 0 && (
        <>
          {/* Desktop: tabela. Densidade de informação é o que importa numa
              tela de trabalho. */}
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Nascimento</th>
                  <th className="px-4 py-3 font-medium">Idade</th>
                  <th className="px-4 py-3 font-medium">Telefone</th>
                </tr>
              </thead>
              <tbody>
                {idosos.map((idoso) => {
                  const idade = calcularIdade(idoso.data_nascimento)
                  return (
                    <tr
                      key={idoso.id}
                      // A linha INTEIRA é clicável, não só o nome.
                      // Não dá para envolver um <tr> num <a> (o HTML não
                      // permite), então a navegação vai no onClick da linha.
                      // O modificador (Ctrl/Cmd/Shift) é respeitado: assim
                      // "abrir em nova aba" pelo nome continua funcionando sem
                      // a linha navegar junto na aba atual.
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey) return
                        navigate(`/idosos/${idoso.id}`)
                      }}
                      className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-marca-50/40"
                    >
                      <td className="px-4 py-3">
                        {/* O nome continua sendo um <Link> de verdade: é o que
                            dá navegação por teclado, "abrir em nova aba" e
                            copiar endereço. O clique na linha é conveniência
                            de mouse, não substitui o link. */}
                        <Link
                          to={`/idosos/${idoso.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-medium text-slate-900 hover:text-marca-700 hover:underline"
                        >
                          {idoso.nome}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatarData(idoso.data_nascimento)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {idade === null ? '—' : `${idade} anos`}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatarTelefone(idoso.telefone)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Celular: cartões empilhados. Tabela de 4 colunas em tela de 375px
              vira rolagem horizontal, que é péssimo de usar em pé. */}
          <ul className="flex flex-col gap-2 md:hidden">
            {idosos.map((idoso) => {
              const idade = calcularIdade(idoso.data_nascimento)
              return (
                <li key={idoso.id}>
                  <Link
                    to={`/idosos/${idoso.id}`}
                    className="block rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-marca-600"
                  >
                    <p className="font-medium text-slate-900">{idoso.nome}</p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {idade === null ? 'Idade não informada' : `${idade} anos`}
                      {idoso.telefone && ` · ${formatarTelefone(idoso.telefone)}`}
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>

          <p className="mt-4 text-sm text-slate-500">
            {idosos.length} {idosos.length === 1 ? 'atendido' : 'atendidos'}
          </p>
        </>
      )}
    </>
  )
}
