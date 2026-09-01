/* ===========================================================================
   TESTES DA FICHA DE CAMPO

   POR QUE ESTE ARQUIVO É NECESSÁRIO:

   o JavaScript de dentro da ficha é uma STRING para o compilador. Ele não
   passa pelo TypeScript, não passa pelo lint, e um erro de sintaxe ali só
   apareceria quando alguém abrisse o arquivo — no evento, sem internet, sem
   ninguém para consertar. É o pior lugar possível para descobrir um erro.

   Então aqui a gente:
     1. gera a ficha de verdade;
     2. compila o script para garantir que a sintaxe é válida;
     3. confere que os dados embutidos sobrevivem intactos, inclusive com
        conteúdo hostil no nome;
     4. confere que as faixas copiadas continuam iguais às originais.

   O item 4 é o mais importante a longo prazo: as regras de validação existem
   em dois lugares (o sistema e a ficha) e nada no compilador liga um ao outro.
   Este teste é esse elo.
=========================================================================== */

import { FAIXAS_AVISO } from '../features/registros/utils/avisos'
import { gerarFichaCampo, type AtendidoFicha } from '../features/campo/fichaCampo'

let passou = 0
const falhas: string[] = []

function checar(nome: string, condicao: boolean, detalhe = '') {
  if (condicao) {
    passou++
    console.log('  ok      ' + nome)
  } else {
    falhas.push(nome + (detalhe ? ' -> ' + detalhe : ''))
    console.log('  FALHOU  ' + nome + (detalhe ? ' -> ' + detalhe : ''))
  }
}

/* --------------------------------------------------------------- cenário */

const atendidos: AtendidoFicha[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    nome: 'Maria Fictícia da Silva',
    nascimento: '1948-03-12',
    faltando: ['endereco'],
    cadastro: { genero: 'Feminino', telefone: '92988887777', endereco: null },
    historico: [
      {
        data: '2026-05-10',
        cond_diabetes: true,
        cond_hipertensao: true,
        cond_asma: false,
        cond_dislipidemia: false,
        cond_outros: false,
        cond_outros_desc: null,
        hf_diabetes: true,
        hf_diabetes_quem: 'mãe',
        hf_hipertensao: false,
        hf_hipertensao_quem: null,
        hf_asma: false,
        hf_asma_quem: null,
        hf_outros: false,
        hf_outros_desc: null,
        hf_outros_quem: null,
        usa_medicamentos: true,
        medicamentos_quais: 'Metformina 850mg',
        fumante: false,
        fumante_passivo: null,
        pressao_sistolica: 140,
        pressao_diastolica: 90,
        frequencia_cardiaca: 78,
        temperatura: 36.5,
        saturacao: 97,
        glicemia: 130,
        glicemia_jejum: 'Nao',
        descricao: 'Relatou tontura pela manhã.',
      },
    ],
  },
  {
    // Nome hostil de propósito: é o teste de injeção. Um nome assim, embutido
    // sem escapar, ENCERRARIA a tag <script> e quebraria o arquivo inteiro.
    id: '22222222-2222-2222-2222-222222222222',
    nome: '</script><script>alert(1)</script>',
    nascimento: null,
    faltando: ['nascimento', 'genero', 'telefone', 'endereco'],
    cadastro: { genero: null, telefone: null, endereco: null },
    historico: [],
  },
]

const EQUIPE = [
  { user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', nome: 'Ana Ribeiro de Souza' },
  { user_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', nome: 'Carlos Prado Lima' },
]

const html = gerarFichaCampo(atendidos, {
  geradoEm: new Date('2026-08-31T18:00:00Z'),
  usuarios: EQUIPE,
})

/* ------------------------------------------------------- estrutura básica */

console.log('=== FICHA DE CAMPO ===')

checar('gera um documento HTML', html.startsWith('<!doctype html>'))
checar('não sobrou o marcador de substituição', !html.includes('/*__DADOS__*/null'))
checar('é autossuficiente (sem buscar nada da rede)', !/(src|href)\s*=\s*["']https?:/i.test(html))

/* ------------------------------------------------- injeção pela tag script */

// Só pode existir UM par de <script>: o da aplicação. Se o nome hostil tivesse
// passado cru, apareceriam outros.
const aberturas = (html.match(/<script/gi) ?? []).length
const fechamentos = (html.match(/<\/script>/gi) ?? []).length
checar('existe exatamente uma tag <script>', aberturas === 1, `abriu ${aberturas}`)
checar('existe exatamente um </script>', fechamentos === 1, `fechou ${fechamentos}`)
checar('o alert do nome hostil não virou código', !html.includes('<script>alert(1)'))

/* -------------------------------------------------- sintaxe do script real */

const corpo = html.slice(html.indexOf('<script>') + '<script>'.length, html.indexOf('</script>'))

let sintaxeOk = true
let erroSintaxe = ''
try {
  // new Function COMPILA sem executar: valida a sintaxe sem precisar de
  // navegador, document ou localStorage.
  new Function(corpo)
} catch (e) {
  sintaxeOk = false
  erroSintaxe = e instanceof Error ? e.message : String(e)
}
checar('o JavaScript embutido compila', sintaxeOk, erroSintaxe)

/* -------------------------------------------------------- dados embutidos */

interface DadosEmbutidos {
  versao: number
  usuarios: { user_id: string; nome: string }[]
  atendidos: AtendidoFicha[]
}

const linhaDados = /var DADOS = (.*?);\n/s.exec(corpo)
checar('os dados foram embutidos', linhaDados !== null)

let dados: DadosEmbutidos | null = null
const json = linhaDados?.[1]

if (json) {
  try {
    // O JSON foi escrito com < como <. JSON.parse desfaz isso —
    // provando que o escape protege a tag sem corromper o conteúdo.
    dados = JSON.parse(json) as DadosEmbutidos
  } catch (e) {
    checar('os dados são JSON válido', false, e instanceof Error ? e.message : String(e))
  }
}

const maria = dados?.atendidos[0]
const hostil = dados?.atendidos[1]

checar('os dois atendidos estão lá', dados?.atendidos.length === 2)
checar(
  'o nome hostil volta EXATAMENTE como era',
  hostil?.nome === '</script><script>alert(1)</script>',
  hostil?.nome,
)
checar('o histórico veio junto na versão completa', (maria?.historico ?? []).length === 1)
checar('a pressão do histórico está intacta', maria?.historico?.[0]?.pressao_sistolica === 140)

// A equipe vai embutida para o campo "quem está anotando" ser uma lista. É o
// que faz a importação creditar cada atendimento à conta certa, em vez de
// tentar casar um nome digitado à mão.
checar('a equipe foi embutida', dados?.usuarios.length === 2)
checar(
  'a equipe leva identificador, não só o nome',
  dados?.usuarios[0]?.user_id === 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
)
checar('a versão do formato subiu para 3', dados?.versao === 3)

/* ------------------------------------------------------ conteúdo da ficha

   Existiu por um tempo uma versão "simples", sem histórico. Foi removida a
   pedido: na prática, consultar os anos anteriores durante o atendimento é o
   que dá valor à ficha.

   A consequência fica registrada aqui em forma de teste: TODA ficha gerada
   agora carrega cadastro e prontuário. Se um dia alguém quiser voltar a ter
   uma versão enxuta, é este bloco que vai falhar primeiro e lembrar do porquê.
*/
checar('a ficha leva os valores do cadastro', maria?.cadastro?.telefone === '92988887777')
checar(
  'a ficha marca quais campos do cadastro faltam',
  JSON.stringify(maria?.faltando) === JSON.stringify(['endereco']),
)
checar('a ficha leva o histórico clínico', (maria?.historico ?? []).length === 1)
checar('o histórico inclui medicamentos', html.includes('Metformina'))

/* ============================================================================
   COERÊNCIA ENTRE AS DUAS CÓPIAS DAS REGRAS

   A ficha repete, em JavaScript solto, as faixas que o sistema define em
   TypeScript. Duas cópias da mesma regra sempre divergem com o tempo — a menos
   que exista um teste ligando as duas. Este é o teste.
============================================================================ */

console.log('\n=== REGRAS DUPLICADAS ===')

function extrairFaixas(nomeObjeto: string): Record<string, [number, number]> {
  const bloco = new RegExp(`var ${nomeObjeto} = \\{([\\s\\S]*?)\\};`).exec(corpo)
  const conteudo = bloco?.[1]
  if (!conteudo) return {}

  const encontrado: Record<string, [number, number]> = {}
  const linha = /(\w+):\s*\[\s*(-?[\d.]+),\s*(-?[\d.]+)/g
  let m: RegExpExecArray | null
  while ((m = linha.exec(conteudo)) !== null) {
    const [, campo, min, max] = m
    if (campo && min && max) encontrado[campo] = [Number(min), Number(max)]
  }
  return encontrado
}

const avisosFicha = extrairFaixas('AVISOS')
checar('as faixas de aviso foram encontradas na ficha', Object.keys(avisosFicha).length === 6)

for (const [campo, faixa] of Object.entries(FAIXAS_AVISO)) {
  const naFicha = avisosFicha[campo]
  checar(
    `aviso de ${campo} igual ao do sistema`,
    naFicha !== undefined && naFicha[0] === faixa.min && naFicha[1] === faixa.max,
    naFicha ? `ficha ${naFicha[0]}-${naFicha[1]} vs sistema ${faixa.min}-${faixa.max}` : 'ausente',
  )
}

// Os limites duros moram no SQL, que não dá para importar. Ficam fixados aqui:
// se alguém mudar um CHECK no banco, este teste falha e obriga a atualizar a
// ficha junto.
const LIMITES_DO_BANCO: Record<string, [number, number]> = {
  pressao_sistolica: [40, 300],
  pressao_diastolica: [20, 200],
  frequencia_cardiaca: [20, 250],
  temperatura: [30, 45],
  saturacao: [50, 100],
  glicemia: [10, 900],
}

const limitesFicha = extrairFaixas('LIMITES')
for (const [campo, faixa] of Object.entries(LIMITES_DO_BANCO)) {
  const naFicha = limitesFicha[campo]
  checar(
    `limite duro de ${campo} igual ao do banco`,
    naFicha !== undefined && naFicha[0] === faixa[0] && naFicha[1] === faixa[1],
    naFicha ? `ficha ${naFicha[0]}-${naFicha[1]} vs banco ${faixa[0]}-${faixa[1]}` : 'ausente',
  )
}

/* ---------------------------------------------------------------- resultado */

console.log('')
// Lança em vez de process.exit(), igual aos outros testes: funciona sem os
// tipos de Node e ainda devolve código de saída diferente de zero.
if (falhas.length > 0) throw new Error(`${falhas.length} verificação(ões) falharam.`)
console.log(`TODOS OS ${passou} TESTES PASSARAM`)
