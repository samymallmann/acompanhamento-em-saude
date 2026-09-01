import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alerta, CabecalhoPagina, TelaCarregando } from '@/components/ui/Feedback'
import { useIdoso } from '@/features/idosos/api/useIdosos'
import { mensagemDeErro } from '@/lib/erros'
import { useCriarRegistro, useUltimoRegistro } from '../api/useRegistros'
import { RegistroForm } from '../components/RegistroForm'
import type { RegistroFormSaida } from '../schemas/registro.schema'
import { preencherDoUltimo } from '../utils/prefill'

export function NovoRegistroPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const idosoId = id!

  const { data: idoso } = useIdoso(idosoId)
  const { data: ultimo, isLoading } = useUltimoRegistro(idosoId)
  const criar = useCriarRegistro(idosoId)
  const [erro, setErro] = useState<string | null>(null)

  // Espera o último registro chegar antes de montar o formulário. Montar antes
  // exigiria um reset() depois, e o RHF perderia o que a usuária já digitou.
  if (isLoading) return <TelaCarregando mensagem="Buscando o último atendimento…" />

  async function salvar(dados: RegistroFormSaida) {
    setErro(null)
    try {
      // Salvar SEMPRE cria um registro novo. O anterior permanece intacto.
      await criar.mutateAsync({ ...dados, idoso_id: idosoId })
      navigate(`/idosos/${idosoId}`)
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <>
      <div className="mb-2">
        <Link to={`/idosos/${idosoId}`} className="text-sm text-marca-700 hover:underline">
          ← Voltar para o perfil
        </Link>
      </div>

      <CabecalhoPagina titulo="Novo registro de atendimento" subtitulo={idoso?.nome} />

      {!ultimo && (
        <div className="mb-4 max-w-3xl">
          <Alerta tipo="info" titulo="Primeiro atendimento">
            Não há registro anterior para esta pessoa, então todos os campos começam
            vazios.
          </Alerta>
        </div>
      )}

      <RegistroForm
        valoresIniciais={preencherDoUltimo(ultimo ?? null)}
        ultimoRegistro={ultimo ?? null}
        salvando={criar.isPending}
        erro={erro}
        onSalvar={salvar}
        onCancelar={() => navigate(`/idosos/${idosoId}`)}
      />
    </>
  )
}
