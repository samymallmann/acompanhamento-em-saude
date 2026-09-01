import { preencherDoUltimo, registroVazio } from '@/features/registros/utils/prefill'
import { coletarAvisos } from '@/features/registros/utils/avisos'
import { registroSchema } from '@/features/registros/schemas/registro.schema'
import { idosoSchema } from '@/features/idosos/schemas/idoso.schema'
import { mascararTelefone, formatarTelefone } from '@/lib/format'
import type { RegistroRow } from '@/types/database.types'

const ultimo: RegistroRow = {
  id: 'r1', idoso_id: 'i1', data_atendimento: '2026-08-01',
  cond_diabetes: true, cond_hipertensao: true, cond_asma: false,
  cond_dislipidemia: false, cond_outros: true, cond_outros_desc: 'Artrose',
  hf_diabetes: true, hf_diabetes_quem: 'mãe',
  hf_hipertensao: false, hf_hipertensao_quem: null,
  hf_asma: false, hf_asma_quem: null,
  hf_outros: false, hf_outros_desc: null, hf_outros_quem: null,
  usa_medicamentos: true, medicamentos_quais: 'Metformina',
  fumante: false, fumante_passivo: null,
  pressao_sistolica: 142, pressao_diastolica: 88, frequencia_cardiaca: 80,
  temperatura: 36.6, saturacao: 96, glicemia: 132, glicemia_jejum: 'Sim',
  descricao: 'Orientada sobre horários.',
  ativo: true, created_by: 'u1', created_at: '', updated_by: null, updated_at: '',
}

let falhas = 0
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? '  ok      ' : '  FALHOU  '}${msg}`)
  if (!cond) falhas++
}

console.log('=== PRE-PREENCHIMENTO: deve COPIAR ===')
const p = preencherDoUltimo(ultimo)
ok(p.cond_diabetes === true, 'condicao diabetes copiada')
ok(p.cond_outros_desc === 'Artrose', 'descricao de outros copiada')
ok(p.hf_diabetes_quem === 'mãe', 'historico familiar "quem" copiado')
ok(p.usa_medicamentos === 'sim', 'usa medicamentos copiado')
ok(p.medicamentos_quais === 'Metformina', 'quais medicamentos copiado')
ok(p.fumante === 'nao', 'fumante copiado como nao')
ok(p.fumante_passivo === '', 'fumante passivo null vira "nao informado"')

console.log('=== PRE-PREENCHIMENTO: NUNCA pode copiar ===')
ok(p.pressao_sistolica === '', 'sistolica vazia')
ok(p.pressao_diastolica === '', 'diastolica vazia')
ok(p.frequencia_cardiaca === '', 'frequencia cardiaca vazia')
ok(p.temperatura === '', 'temperatura vazia')
ok(p.saturacao === '', 'saturacao vazia')
ok(p.glicemia === '', 'glicemia vazia')
ok(p.glicemia_jejum === '', 'em jejum vazio')
ok(p.descricao === '', 'descricao vazia')

console.log('=== PRIMEIRO REGISTRO ===')
const v = preencherDoUltimo(null)
ok(JSON.stringify(v) === JSON.stringify(registroVazio()), 'sem anterior, tudo vazio')

console.log('=== AVISOS (nao bloqueiam) ===')
ok(coletarAvisos({ frequencia_cardiaca: 38 }).length === 1, 'FC 38 gera aviso')
ok(coletarAvisos({ frequencia_cardiaca: 80 }).length === 0, 'FC 80 nao gera aviso')
ok(coletarAvisos({ pressao_sistolica: 190 }).length === 0, 'sistolica 190 NAO avisa (valor real de hipertenso)')
ok(coletarAvisos({ pressao_sistolica: 250 }).length === 1, 'sistolica 250 avisa')
ok(coletarAvisos({ glicemia: '' }).length === 0, 'campo vazio nao avisa')

console.log('=== BLOQUEIOS (Zod) ===')
const base = { ...registroVazio(), data_atendimento: '2026-08-01' }
const tenta = (extra: Record<string, unknown>) => registroSchema.safeParse({ ...base, ...extra })
ok(tenta({}).success, 'registro minimo valido')
ok(tenta({ pressao_sistolica: '1200' }).success === false, 'sistolica 1200 bloqueada')
ok(tenta({ pressao_sistolica: '80', pressao_diastolica: '120' }).success === false, 'pressao invertida bloqueada')
ok(tenta({ pressao_sistolica: '190', pressao_diastolica: '110' }).success, 'pressao alta porem plausivel passa')
ok(tenta({ temperatura: '5' }).success === false, 'temperatura 5 bloqueada')
ok(tenta({ cond_outros: true }).success === false, 'outros sem descricao bloqueado')
ok(tenta({ cond_outros: true, cond_outros_desc: 'Artrose' }).success, 'outros com descricao passa')
ok(tenta({ usa_medicamentos: 'sim' }).success === false, 'medicamento sem quais bloqueado')
ok(tenta({ glicemia_jejum: 'Sim' }).success === false, 'jejum sem glicemia bloqueado')
ok(tenta({ data_atendimento: '2027-01-01' }).success === false, 'data futura bloqueada')
ok(tenta({ frequencia_cardiaca: '38' }).success, 'FC 38 PASSA no bloqueio (so avisa)')

console.log('=== CONVERSOES ===')
const r = tenta({ glicemia: '99', glicemia_jejum: 'Sim', fumante: 'nao', descricao: '  ' })
if (r.success) {
  ok(r.data.glicemia === 99, 'string vira numero')
  ok(r.data.fumante === false, '"nao" vira false')
  ok(r.data.usa_medicamentos === null, 'nao respondido vira null')
  ok(r.data.descricao === null, 'texto so com espacos vira null')
} else { ok(false, 'parse falhou: ' + JSON.stringify(r.error.issues[0])) }

console.log('=== TELEFONE ===')
ok(mascararTelefone('92988881111') === '(92) 98888-1111', 'celular formatado')
ok(mascararTelefone('9232345678') === '(92) 3234-5678', 'fixo formatado')
ok(mascararTelefone('abc92def98888') === '(92) 9888-8', 'letras sao descartadas, sobram so os digitos')
ok(mascararTelefone('') === '', 'vazio continua vazio')
ok(mascararTelefone('929888811119999') === '(92) 98888-1111', 'corta em 11 digitos')
ok(formatarTelefone(null) === '—', 'telefone ausente vira travessao')
ok(formatarTelefone('(92) 98888-1111') === '(92) 98888-1111', 'valor antigo ja formatado continua certo')

const tel = (v: string) => idosoSchema.safeParse({ nome: 'Fulano', telefone: v })
ok(tel('(92) 98888-1111').success, 'celular completo aceito')
ok(tel('(92) 3234-5678').success, 'fixo completo aceito')
ok(tel('').success, 'telefone vazio aceito (nao e obrigatorio)')
ok(tel('92988').success === false, 'telefone incompleto bloqueado')
// Texto sem nenhum digito equivale a campo vazio: como a mascara impede
// digitar letra, isso so aconteceria em colagem — e virar "sem telefone" e
// mais util do que recusar o cadastro inteiro.
const soLetras = tel('abcdef')
ok(soLetras.success && soLetras.data.telefone === null, 'texto sem digito equivale a vazio')
const salvo = tel('(92) 98888-1111')
ok(salvo.success && salvo.data.telefone === '92988881111', 'banco recebe so digitos')
const vazio2 = tel('')
ok(vazio2.success && vazio2.data.telefone === null, 'vazio vira null, nao string vazia')

console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`)

// Lança em vez de process.exit(): funciona sem os tipos de Node e ainda assim
// devolve código de saída diferente de zero, que é o que um CI observa.
if (falhas > 0) throw new Error(`${falhas} verificação(ões) falharam.`)
