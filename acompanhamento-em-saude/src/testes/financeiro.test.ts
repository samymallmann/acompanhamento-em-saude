import { formatarMoeda, mascararMoeda, moedaParaNumero, numeroParaMoeda } from '@/lib/format'
import {
  compraLoteSchema,
  eventoSchema,
  produtoSchema,
} from '@/features/financeiro/schemas/financeiro.schema'

let falhas = 0
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? '  ok      ' : '  FALHOU  '}${msg}`)
  if (!cond) falhas++
}

console.log('=== MASCARA DE MOEDA (digita centavos) ===')
ok(mascararMoeda('1') === '0,01', 'um digito vira 0,01')
ok(mascararMoeda('12') === '0,12', 'dois digitos viram 0,12')
ok(mascararMoeda('1290') === '12,90', '1290 vira 12,90')
ok(mascararMoeda('123456') === '1.234,56', 'milhar com ponto separador')
ok(mascararMoeda('abc') === '', 'letras sao descartadas')
ok(mascararMoeda('') === '', 'vazio continua vazio')

console.log('=== CONVERSOES ===')
ok(moedaParaNumero('12,90') === 12.9, 'campo vira numero para o banco')
ok(moedaParaNumero('') === null, 'campo vazio vira null')
ok(moedaParaNumero('1.234,56') === 1234.56, 'milhar convertido corretamente')
ok(numeroParaMoeda(12.9) === '12,90', 'numero do banco volta para o campo')
ok(numeroParaMoeda(0) === '0,00', 'zero volta como 0,00')
ok(numeroParaMoeda(null) === '', 'null vira campo vazio')
ok(formatarMoeda(12.9) === 'R$ 12,90', 'exibicao em reais')
ok(formatarMoeda(null) === '—', 'sem valor vira travessao')

console.log('=== PRODUTO ===')
const prod = (v: Record<string, unknown>) =>
  produtoSchema.safeParse({ nome: 'Vaso', quantidade: '2', valor_unitario: '12,90', ...v })
ok(prod({}).success, 'produto valido')
const p1 = prod({})
ok(p1.success && p1.data.valor_unitario === 12.9, 'valor convertido para numero')
ok(p1.success && p1.data.quantidade === 2, 'quantidade convertida para inteiro')
ok(prod({ nome: '' }).success === false, 'nome vazio bloqueado')
ok(prod({ quantidade: '0' }).success === false, 'quantidade zero bloqueada')
ok(prod({ valor_unitario: '0' }).success, 'valor zero aceito (brinde, F10)')
ok(prod({ valor_unitario: '' }).success === false, 'valor vazio bloqueado')
const peso = prod({ nome: '2 kg de batata', quantidade: '1' })
ok(peso.success, 'item por peso cabe com a unidade no nome (F7)')

console.log('=== COMPRA EM LOTE ===')
const lote = (v: Record<string, unknown>) =>
  compraLoteSchema.safeParse({ descricao: 'Mercado', texto_nota: '', valor_total: '42,30', ...v })
ok(lote({}).success, 'compra em lote valida')
const l1 = lote({})
ok(l1.success && l1.data.texto_nota === null, 'texto vazio vira null (F5: opcional)')
ok(lote({ descricao: '' }).success === false, 'descricao vazia bloqueada (F6)')
ok(lote({ texto_nota: 'CUPOM FISCAL\n1x arroz 5,90' }).success, 'texto da nota aceito como esta')
const l2 = lote({ texto_nota: 'total 999,99' })
ok(l2.success && l2.data.valor_total === 42.3, 'valor NAO e extraido do texto — vale o digitado')

console.log('=== EVENTO ===')
const ev = (v: Record<string, unknown>) =>
  eventoSchema.safeParse({ nome: 'Chá de bebê', data_evento: '', ...v })
ok(ev({}).success, 'evento so com nome')
ok(ev({ nome: '' }).success === false, 'nome vazio bloqueado')
ok(ev({ data_evento: '2027-12-25' }).success, 'data futura aceita (F9)')
const e1 = ev({})
ok(e1.success && e1.data.data_evento === null, 'data vazia vira null')

console.log('=== SOMA: por que o banco e nao o JS ===')
const emJs = 0.1 + 0.1 + 0.1
ok(emJs !== 0.3, `JS: 0.1+0.1+0.1 = ${emJs} (por isso os totais sao somados no banco)`)

console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`)
if (falhas > 0) throw new Error(`${falhas} verificacao(oes) falharam.`)
