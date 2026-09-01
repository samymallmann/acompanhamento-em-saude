import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Alerta } from '@/components/ui/Feedback'
import { mensagemDeErro } from '@/lib/erros'
import {
  conferir,
  useImportarFicha,
  type Conferencia,
  type ResultadoImportacao,
} from '../api/useImportarFicha'

/* ===========================================================================
   Importar ficha de campo.

   Disponível para qualquer pessoa autorizada (migration 0013). Vale lembrar do
   que isso significa: a importação grava atendimentos em nome de quem coletou,
   e não de quem importa — é a única exceção do sistema à regra
   `created_by = auth.uid()`.

   O desenho central: NADA entra no banco antes de a pessoa ver o que vai
   entrar. São três estados na tela, nesta ordem:

     1. colar/escolher o arquivo
     2. conferência — quantos, quantos já entraram, quem coletou
     3. resultado

   Esse passo 2 não é enfeite. Importar prontuário em lote a partir de um
   arquivo vindo de fora é a operação de maior alcance do sistema: um clique
   pode criar dezenas de registros. Ver antes é o que transforma isso numa
   decisão em vez de um salto no escuro.
=========================================================================== */

export function ImportarFicha({ onFechar }: { onFechar: () => void }) {
  const [texto, setTexto] = useState('')
  const [conferencia, setConferencia] = useState<Conferencia | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [conferindo, setConferindo] = useState(false)
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null)

  const importar = useImportarFicha()

  async function lerArquivo(arquivo: File | undefined) {
    if (!arquivo) return
    setErro(null)
    setConferencia(null)
    const conteudo = await arquivo.text()
    setTexto(conteudo)
    void executarConferencia(conteudo)
  }

  async function executarConferencia(valor: string) {
    setErro(null)
    setResultado(null)
    setConferindo(true)
    try {
      setConferencia(await conferir(valor))
    } catch (e) {
      setConferencia(null)
      setErro(mensagemDeErro(e))
    } finally {
      setConferindo(false)
    }
  }

  function confirmar() {
    setErro(null)
    importar.mutate(texto, {
      onSuccess: (r) => {
        setResultado(r)
        setConferencia(null)
        setTexto('')
      },
      onError: (e) => setErro(mensagemDeErro(e)),
    })
  }

  /* ------------------------------------------------------------ resultado */

  if (resultado) {
    return (
      <div className="flex flex-col gap-4 text-sm text-slate-600">
        <Alerta tipo="info" titulo="Importação concluída">
          <ul className="mt-1 list-inside list-disc">
            <li>{resultado.importados} atendimento(s) lançados</li>
            {resultado.cadastros_novos > 0 && (
              <li>{resultado.cadastros_novos} cadastro(s) criados</li>
            )}
            {resultado.cadastros_completados > 0 && (
              <li>{resultado.cadastros_completados} cadastro(s) completados</li>
            )}
            {resultado.pulados > 0 && (
              <li>{resultado.pulados} já tinham sido importados antes e foram ignorados</li>
            )}
          </ul>
        </Alerta>
        <p>
          Cada atendimento ficou registrado no nome de quem coletou. Confira no
          perfil de qualquer atendido: a etiqueta "por Fulano" no histórico.
        </p>
        <div>
          <Button onClick={onFechar}>Fechar</Button>
        </div>
      </div>
    )
  }

  /* --------------------------------------------------------- conferência */

  const bloqueado = (conferencia?.semAcesso.length ?? 0) > 0
  const nadaNovo = conferencia !== null && conferencia.jaImportados === conferencia.total

  return (
    <div className="flex flex-col gap-4 text-sm text-slate-600">
      <p>
        Cole aqui o texto que a ficha de campo gerou, ou escolha o arquivo
        <code className="mx-1 rounded bg-slate-100 px-1">.json</code> salvo por ela.
        Nada é gravado antes de você conferir.
      </p>

      {erro && (
        <Alerta tipo="erro" titulo="Não foi possível importar">
          {erro}
        </Alerta>
      )}

      <div>
        <input
          type="file"
          accept="application/json,.json"
          onChange={(e) => void lerArquivo(e.target.files?.[0])}
          className="text-sm file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
        />
      </div>

      <textarea
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value)
          setConferencia(null)
          setResultado(null)
        }}
        placeholder="Cole o texto aqui…"
        className="h-40 w-full rounded-lg border border-slate-300 p-3 font-mono text-xs"
      />

      {conferencia && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="font-medium text-slate-900">Conferência</p>
          <ul className="mt-2 list-inside list-disc">
            <li>
              {conferencia.total - conferencia.jaImportados} atendimento(s) a lançar
            </li>
            {conferencia.cadastrosNovos > 0 && (
              <li>{conferencia.cadastrosNovos} cadastro(s) novos serão criados</li>
            )}
            {conferencia.complementos > 0 && (
              <li>{conferencia.complementos} cadastro(s) serão completados</li>
            )}
            {conferencia.jaImportados > 0 && (
              <li>{conferencia.jaImportados} já foram importados antes — serão ignorados</li>
            )}
          </ul>

          {/* Bloqueio, não aviso: importar sem isto resolvido faria os
              atendimentos entrarem sem responsável, e o banco recusa mesmo. */}
          {bloqueado && (
            <div className="mt-3">
              <Alerta tipo="aviso" titulo="Falta criar acesso">
                <p>
                  {conferencia.semAcesso.join(', ')} anotou atendimentos mas ainda não
                  tem acesso ao sistema.
                </p>
                <p className="mt-2">
                  Vá na aba <strong>Acessos</strong>, crie e libere o acesso dessa pessoa,
                  e volte aqui com o mesmo arquivo. Nada se perde.
                </p>
              </Alerta>
            </div>
          )}

          {nadaNovo && !bloqueado && (
            <div className="mt-3">
              <Alerta tipo="info" titulo="Nada novo para importar">
                Todos os atendimentos deste arquivo já estão no sistema.
              </Alerta>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!conferencia ? (
          <Button
            carregando={conferindo}
            disabled={!texto.trim()}
            onClick={() => void executarConferencia(texto)}
          >
            Conferir
          </Button>
        ) : (
          <Button
            carregando={importar.isPending}
            disabled={bloqueado || nadaNovo}
            onClick={confirmar}
          >
            Importar {conferencia.total - conferencia.jaImportados} atendimento(s)
          </Button>
        )}
        <Button variante="secundario" onClick={onFechar}>
          Cancelar
        </Button>
      </div>

      <p className="text-xs text-slate-500">
        Se algum atendimento for recusado, <strong>nenhum</strong> é importado — a
        mensagem diz qual foi. Reimportar o mesmo arquivo é seguro: o que já entrou
        é ignorado.
      </p>
    </div>
  )
}
