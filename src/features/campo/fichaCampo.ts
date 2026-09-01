/* ===========================================================================
   FICHA DE CAMPO — gerador do arquivo HTML offline

   O PROBLEMA:
   os eventos acontecem em local sem sinal de internet. O sistema inteiro
   depende do Supabase, então lá ele simplesmente não funciona.

   ⚠️  UMA VERSÃO SÓ, E ELA CARREGA PRONTUÁRIO.

   Existiram duas por um tempo: uma "simples" (só nomes) para os voluntários e
   uma "completa" (com histórico) para a responsável. A simples foi removida a
   pedido — na prática, ver o histórico durante o atendimento é justamente o
   que dá valor à ficha, e manter duas versões só gerava confusão sobre qual
   mandar para quem.

   O efeito é que TODO arquivo gerado leva histórico clínico e cadastro
   completo dos atendidos. A geração chegou a ser restrita ao administrador por
   isso, mas voltou a ficar aberta a qualquer pessoa autorizada — que já
   enxerga esses mesmos dados dentro do sistema. A diferença que sobra, e por
   isso o aviso na tela é direto: dentro do sistema o acesso pode ser revogado;
   num arquivo enviado, não. Quem tiver o arquivo, tem os dados.

   A SOLUÇÃO ESCOLHIDA, e por que não foi sincronização automática:

   este módulo monta um arquivo .html autossuficiente — formulário, validação,
   dados e armazenamento, tudo dentro de um arquivo só. A pessoa salva no
   aparelho, abre com dois cliques, anota o dia inteiro sem rede, e no fim
   exporta um texto que volta para o sistema.

   Sincronização automática (o app enviando sozinho quando a rede voltasse)
   seria mais "moderna" e é PIOR aqui: ela falha em segundo plano, sem ninguém
   ver, e a pessoa acha que salvou. Com exportação manual, o dado só sai do
   aparelho quando alguém aperta o botão, e o resultado aparece na tela. Falha
   silenciosa deixa de ser possível — e num sistema de saúde, perder
   atendimento em silêncio é o pior desfecho de todos.

   Não há senha no arquivo. Foi decisão consciente do responsável; dá para
   acrescentar depois com a criptografia nativa do navegador, sem biblioteca.
=========================================================================== */

/** Campos do cadastro que a ficha permite completar no evento. */
export type CampoCadastro = 'nascimento' | 'genero' | 'telefone' | 'endereco'

/** Uma pessoa já cadastrada, como vai embutida no arquivo. */
export interface AtendidoFicha {
  id: string
  nome: string
  nascimento: string | null

  /**
   * Quais campos do cadastro estão VAZIOS. Vai nas duas versões.
   *
   * Repare que é a lista dos que faltam, não os valores dos que existem: a
   * ficha de coleta consegue pedir o telefone de quem não tem, sem carregar o
   * telefone de quem tem. Levar "está faltando" custa quase nada se o arquivo
   * se perder; levar a agenda de contatos de todos os atendidos, não.
   */
  faltando?: CampoCadastro[]

  /** Valores atuais do cadastro. SÓ na versão completa. */
  cadastro?: {
    genero: string | null
    telefone: string | null
    endereco: string | null
  }

  /** Só na versão completa. Mais recente primeiro. */
  historico?: RegistroFicha[]
}

export interface RegistroFicha {
  data: string
  cond_diabetes: boolean
  cond_hipertensao: boolean
  cond_asma: boolean
  cond_dislipidemia: boolean
  cond_outros: boolean
  cond_outros_desc: string | null
  hf_diabetes: boolean
  hf_diabetes_quem: string | null
  hf_hipertensao: boolean
  hf_hipertensao_quem: string | null
  hf_asma: boolean
  hf_asma_quem: string | null
  hf_outros: boolean
  hf_outros_desc: string | null
  hf_outros_quem: string | null
  usa_medicamentos: boolean | null
  medicamentos_quais: string | null
  fumante: boolean | null
  fumante_passivo: boolean | null
  pressao_sistolica: number | null
  pressao_diastolica: number | null
  frequencia_cardiaca: number | null
  temperatura: number | null
  saturacao: number | null
  glicemia: number | null
  glicemia_jejum: string | null
  descricao: string | null
}

/** Quem pode aparecer como responsável pela coleta. */
export interface UsuarioFicha {
  user_id: string
  nome: string
}

export interface OpcoesFicha {
  /** Aparece no cabeçalho do arquivo, para saber de quando são os dados. */
  geradoEm: Date
  /**
   * Equipe com acesso ao sistema, para a lista de "quem está anotando".
   *
   * A ficha guarda o IDENTIFICADOR da conta escolhida, não o nome digitado. É o
   * que permite a importação creditar cada atendimento à pessoa certa: nome
   * digitado erra por acento, apelido e letra trocada, e atribuir prontuário à
   * pessoa errada é pior do que não atribuir.
   */
  usuarios: UsuarioFicha[]
}

/**
 * Injeta um valor JavaScript dentro de uma tag <script> com segurança.
 *
 * O `<` vira < porque a sequência `</script>` dentro de uma string
 * ENCERRA a tag para o navegador, mesmo estando entre aspas. É a forma
 * clássica de quebrar (ou injetar código em) uma página com dados embutidos —
 * bastaria um nome de idoso contendo `</script>`.
 */
function embutir(valor: unknown): string {
  return JSON.stringify(valor).replace(/</g, '\\u003c')
}

export function gerarFichaCampo(
  atendidos: AtendidoFicha[],
  opcoes: OpcoesFicha,
): string {
  const dados = {
    versao: 3,
    geradoEm: opcoes.geradoEm.toISOString(),
    usuarios: opcoes.usuarios,
    atendidos,
  }

  return PAGINA.replace('/*__DADOS__*/null', embutir(dados))
}

/* ---------------------------------------------------------------------------
   A PÁGINA

   HTML, CSS e JavaScript num template só. Sem framework, sem build, sem
   dependência externa: qualquer coisa buscada da internet quebraria o arquivo
   justamente onde ele precisa funcionar.

   O JavaScript daqui de dentro NÃO passa pelo TypeScript nem pelo lint — é
   texto para o compilador. Por isso está escrito de forma conservadora e
   comentada, e as regras que ele repete (limites de valor, o que se copia do
   último atendimento) estão marcadas com o arquivo de origem, para que uma
   mudança lá lembre de vir aqui.
--------------------------------------------------------------------------- */
const PAGINA = String.raw`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ficha de campo — Acompanhamento em Saúde</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 16px 16px 64px;
    font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #0f172a; background: #f1f5f9;
    max-width: 720px; margin-inline: auto;
  }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 24px 0 8px; }
  .sub { color: #64748b; font-size: 13px; margin: 0 0 16px; }
  .cartao {
    background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
    padding: 16px; margin-bottom: 12px;
  }
  label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 4px; }
  input[type=text], input[type=date], input[type=number], input[type=search], select, textarea {
    width: 100%; padding: 10px; font-size: 16px; font-family: inherit;
    border: 1px solid #cbd5e1; border-radius: 8px; background: #fff;
  }
  textarea { min-height: 80px; resize: vertical; }
  .campo { margin-bottom: 14px; }
  .linha { display: flex; gap: 10px; flex-wrap: wrap; }
  .linha > .campo { flex: 1 1 130px; }
  .check { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 15px; }
  .check input { width: 18px; height: 18px; }
  .radios { display: flex; gap: 14px; flex-wrap: wrap; font-size: 15px; }
  .radios label { font-weight: 400; display: flex; align-items: center; gap: 5px; margin: 0; }
  button {
    font: inherit; font-weight: 500; padding: 10px 16px; border-radius: 8px;
    border: 1px solid transparent; cursor: pointer; background: #1d4ed8; color: #fff;
  }
  button.sec { background: #fff; color: #334155; border-color: #cbd5e1; }
  button.perigo { background: #fff; color: #b91c1c; border-color: #fca5a5; }
  .barra { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
  .erro { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b;
          padding: 10px 12px; border-radius: 8px; font-size: 14px; margin-bottom: 12px; }
  .aviso { background: #fffbeb; border: 1px solid #fde68a; color: #92400e;
           padding: 10px 12px; border-radius: 8px; font-size: 14px; margin-bottom: 12px; }
  .ok { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534;
        padding: 10px 12px; border-radius: 8px; font-size: 14px; margin-bottom: 12px; }
  .item { display: flex; justify-content: space-between; align-items: center;
          gap: 10px; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
  .item:last-child { border-bottom: 0; }
  .item small { color: #64748b; }
  .oculto { display: none; }
  .hist { font-size: 14px; border-left: 3px solid #e2e8f0; padding-left: 12px; margin-bottom: 12px; }
  .hist b { display: block; }
  .saida { width: 100%; min-height: 220px; font-family: ui-monospace, monospace; font-size: 12px; }
  fieldset { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; margin: 0 0 14px; }
  legend { font-size: 14px; font-weight: 600; padding: 0 6px; }
  .dica { font-size: 12px; color: #64748b; margin-top: 3px; }
</style>
</head>
<body>

<h1>Ficha de campo</h1>
<p class="sub" id="cabecalho"></p>

<div id="tela-inicio">
  <div class="barra">
    <button id="btn-novo" onclick="irParaNovo()">+ Novo atendimento</button>
    <button class="sec" onclick="mostrar('tela-exportar'); montarExportacao()">Exportar anotações</button>
  </div>

  <div id="aviso-identificacao"></div>

  <div class="cartao">
    <label for="anotador">Quem está anotando</label>
    <select id="anotador" onchange="trocarAnotador()"></select>
    <div class="campo oculto" id="box_anotador_outro" style="margin-top:10px">
      <label for="anotador_outro">Nome completo de quem anota</label>
      <input type="text" id="anotador_outro" placeholder="Fulana de Tal"
             oninput="guardarAnotador()">
      <p class="dica">
        Esta pessoa ainda não tem acesso ao sistema. Na hora de lançar, o
        administrador vai precisar criar o acesso dela antes de importar.
      </p>
    </div>
    <p class="dica">Fica junto de cada atendimento, para registrar quem atendeu.</p>
  </div>

  <h2>Anotados neste aparelho (<span id="contador">0</span>)</h2>
  <div class="cartao" id="lista-anotados"></div>
</div>

<div id="tela-escolha" class="oculto">
  <div class="barra"><button class="sec" onclick="voltarInicio()">← Voltar</button></div>
  <div class="cartao">
    <h2 style="margin-top:0">Esta pessoa já tem cadastro?</h2>
    <div class="campo">
      <label for="busca">Procurar pelo nome</label>
      <input type="search" id="busca" placeholder="Digite parte do nome…" oninput="buscar(this.value)">
    </div>
    <div id="resultados"></div>
    <hr style="border:0;border-top:1px solid #e2e8f0;margin:16px 0">
    <button class="sec" onclick="abrirFormulario(null)">Não está na lista — primeira vez</button>
  </div>
</div>

<div id="tela-form" class="oculto">
  <div class="barra"><button class="sec" onclick="voltarInicio()">← Cancelar</button></div>
  <div id="msg-form"></div>
  <div id="bloco-historico"></div>

  <form id="form" onsubmit="return false">
    <fieldset id="fs-cadastro">
      <legend id="legenda-cadastro">Cadastro</legend>
      <p class="dica" id="dica-cadastro" style="margin-top:0;margin-bottom:12px"></p>
      <div class="campo" id="box_nome">
        <label for="nome">Nome completo *</label>
        <input type="text" id="nome">
      </div>
      <div class="linha">
        <div class="campo" id="box_nascimento">
          <label for="nascimento">Data de nascimento</label>
          <input type="date" id="nascimento">
        </div>
        <div class="campo" id="box_genero">
          <label for="genero">Gênero</label>
          <select id="genero">
            <option value="">Não informado</option>
            <option>Feminino</option><option>Masculino</option><option>Outros</option>
          </select>
        </div>
      </div>
      <div class="linha">
        <div class="campo" id="box_telefone">
          <label for="telefone">Telefone</label>
          <input type="text" id="telefone" placeholder="(92) 99999-9999">
        </div>
        <div class="campo" id="box_endereco">
          <label for="endereco">Endereço</label>
          <input type="text" id="endereco">
        </div>
      </div>
    </fieldset>

    <fieldset>
      <legend>Atendimento</legend>
      <div class="campo" style="max-width:220px">
        <label for="data">Data do atendimento *</label>
        <input type="date" id="data">
      </div>
    </fieldset>

    <fieldset>
      <legend>Condições de saúde</legend>
      <div class="check"><input type="checkbox" id="cond_diabetes"><label for="cond_diabetes">Diabetes</label></div>
      <div class="check"><input type="checkbox" id="cond_hipertensao"><label for="cond_hipertensao">Hipertensão</label></div>
      <div class="check"><input type="checkbox" id="cond_asma"><label for="cond_asma">Asma</label></div>
      <div class="check"><input type="checkbox" id="cond_dislipidemia"><label for="cond_dislipidemia">Dislipidemia</label></div>
      <div class="check"><input type="checkbox" id="cond_outros" onchange="alternar('cond_outros','box_cond_outros')"><label for="cond_outros">Outros</label></div>
      <div class="campo oculto" id="box_cond_outros">
        <label for="cond_outros_desc">Quais?</label>
        <input type="text" id="cond_outros_desc">
      </div>
    </fieldset>

    <fieldset>
      <legend>Histórico familiar</legend>
      <div class="check"><input type="checkbox" id="hf_diabetes" onchange="alternar('hf_diabetes','box_hf_diabetes')"><label for="hf_diabetes">Diabetes</label></div>
      <div class="campo oculto" id="box_hf_diabetes"><label for="hf_diabetes_quem">Quem?</label><input type="text" id="hf_diabetes_quem"></div>

      <div class="check"><input type="checkbox" id="hf_hipertensao" onchange="alternar('hf_hipertensao','box_hf_hipertensao')"><label for="hf_hipertensao">Hipertensão</label></div>
      <div class="campo oculto" id="box_hf_hipertensao"><label for="hf_hipertensao_quem">Quem?</label><input type="text" id="hf_hipertensao_quem"></div>

      <div class="check"><input type="checkbox" id="hf_asma" onchange="alternar('hf_asma','box_hf_asma')"><label for="hf_asma">Asma</label></div>
      <div class="campo oculto" id="box_hf_asma"><label for="hf_asma_quem">Quem?</label><input type="text" id="hf_asma_quem"></div>

      <div class="check"><input type="checkbox" id="hf_outros" onchange="alternar('hf_outros','box_hf_outros')"><label for="hf_outros">Outros</label></div>
      <div class="oculto" id="box_hf_outros">
        <div class="campo"><label for="hf_outros_desc">Quais?</label><input type="text" id="hf_outros_desc"></div>
        <div class="campo"><label for="hf_outros_quem">Quem?</label><input type="text" id="hf_outros_quem"></div>
      </div>
    </fieldset>

    <fieldset>
      <legend>Medicamentos e tabagismo</legend>
      <div class="campo">
        <label>Usa medicamentos?</label>
        <div class="radios">
          <label><input type="radio" name="usa_medicamentos" value="sim" onchange="alternarMed()"> Sim</label>
          <label><input type="radio" name="usa_medicamentos" value="nao" onchange="alternarMed()"> Não</label>
          <label><input type="radio" name="usa_medicamentos" value="" checked onchange="alternarMed()"> Não perguntado</label>
        </div>
      </div>
      <div class="campo oculto" id="box_medicamentos">
        <label for="medicamentos_quais">Quais?</label>
        <textarea id="medicamentos_quais"></textarea>
      </div>
      <div class="campo">
        <label>Fumante?</label>
        <div class="radios">
          <label><input type="radio" name="fumante" value="sim"> Sim</label>
          <label><input type="radio" name="fumante" value="nao"> Não</label>
          <label><input type="radio" name="fumante" value="" checked> Não perguntado</label>
        </div>
      </div>
      <div class="campo">
        <label>Fumante passivo?</label>
        <div class="radios">
          <label><input type="radio" name="fumante_passivo" value="sim"> Sim</label>
          <label><input type="radio" name="fumante_passivo" value="nao"> Não</label>
          <label><input type="radio" name="fumante_passivo" value="" checked> Não perguntado</label>
        </div>
      </div>
    </fieldset>

    <fieldset>
      <legend>Rastreamento em saúde</legend>
      <p class="dica" style="margin-top:0;margin-bottom:12px">
        Estes campos começam sempre vazios, mesmo para quem já tem histórico —
        são a medição de hoje. Deixe em branco o que não foi medido.
      </p>
      <div class="linha">
        <div class="campo"><label for="pressao_sistolica">Pressão sistólica</label><input type="number" id="pressao_sistolica" inputmode="numeric"><div class="dica">mmHg</div></div>
        <div class="campo"><label for="pressao_diastolica">Pressão diastólica</label><input type="number" id="pressao_diastolica" inputmode="numeric"><div class="dica">mmHg</div></div>
      </div>
      <div class="linha">
        <div class="campo"><label for="frequencia_cardiaca">Freq. cardíaca</label><input type="number" id="frequencia_cardiaca" inputmode="numeric"><div class="dica">bpm</div></div>
        <div class="campo"><label for="temperatura">Temperatura</label><input type="number" id="temperatura" step="0.1" inputmode="decimal"><div class="dica">°C</div></div>
      </div>
      <div class="linha">
        <div class="campo"><label for="saturacao">Saturação</label><input type="number" id="saturacao" inputmode="numeric"><div class="dica">%</div></div>
        <div class="campo"><label for="glicemia">Glicemia capilar</label><input type="number" id="glicemia" inputmode="numeric"><div class="dica">mg/dL</div></div>
      </div>
      <div class="campo">
        <label>Em jejum?</label>
        <div class="radios">
          <label><input type="radio" name="glicemia_jejum" value="Sim"> Sim</label>
          <label><input type="radio" name="glicemia_jejum" value="Nao"> Não</label>
          <label><input type="radio" name="glicemia_jejum" value="NaoSei"> Não sei</label>
          <label><input type="radio" name="glicemia_jejum" value="" checked> Não perguntado</label>
        </div>
        <p class="dica">Só preencha se mediu a glicemia.</p>
      </div>
    </fieldset>

    <fieldset>
      <legend>Observações</legend>
      <div class="campo"><textarea id="descricao"></textarea></div>
    </fieldset>

    <div class="barra">
      <button onclick="salvar()">Salvar atendimento</button>
      <button class="sec" onclick="voltarInicio()">Cancelar</button>
    </div>
  </form>
</div>

<div id="tela-exportar" class="oculto">
  <div class="barra"><button class="sec" onclick="voltarInicio()">← Voltar</button></div>
  <div class="cartao">
    <h2 style="margin-top:0">Exportar</h2>
    <p class="sub">
      Copie todo o texto abaixo e envie para quem vai lançar no sistema, ou
      salve o arquivo — ele já sai com o seu nome e a data.
    </p>
    <div id="msg-exportar"></div>
    <div class="barra">
      <button onclick="copiar()">Copiar tudo</button>
      <button class="sec" onclick="baixar()">Salvar como arquivo</button>
    </div>
    <textarea class="saida" id="saida" readonly></textarea>
    <div class="barra" style="margin-top:16px">
      <button class="perigo" onclick="limpar()">Apagar anotações deste aparelho</button>
    </div>
    <p class="dica">
      Só apague depois de confirmar que os dados foram lançados no sistema.
      Não há como recuperar.
    </p>
  </div>
</div>

<script>
"use strict";

/* Dados embutidos na geração do arquivo. */
var DADOS = /*__DADOS__*/null;

var CHAVE = "ficha-campo-v1";
var anotacoes = [];
var editandoIdoso = null;   // objeto do atendido escolhido, ou null = novo

/* -------------------------------------------------------------------------
   LIMITES DUROS — cópia de supabase/migrations/..._schema.sql
   Impedem salvar. Faixas propositalmente AMPLAS: pegam erro grosseiro de
   digitação, não julgam a saúde da pessoa.
------------------------------------------------------------------------- */
var LIMITES = {
  pressao_sistolica:   [40, 300, "Pressão sistólica"],
  pressao_diastolica:  [20, 200, "Pressão diastólica"],
  frequencia_cardiaca: [20, 250, "Frequência cardíaca"],
  temperatura:         [30, 45,  "Temperatura"],
  saturacao:           [50, 100, "Saturação"],
  glicemia:            [10, 900, "Glicemia"]
};

/* -------------------------------------------------------------------------
   FAIXAS DE AVISO — cópia de src/features/registros/utils/avisos.ts
   NÃO impedem salvar, só pedem confirmação. O texto fala de digitação e
   nunca de saúde: este sistema não opina sobre o estado clínico de ninguém.
------------------------------------------------------------------------- */
var AVISOS = {
  pressao_sistolica:   [70, 220, "Pressão sistólica"],
  pressao_diastolica:  [40, 130, "Pressão diastólica"],
  frequencia_cardiaca: [40, 150, "Frequência cardíaca"],
  temperatura:         [34, 40,  "Temperatura"],
  saturacao:           [85, 100, "Saturação"],
  glicemia:            [40, 400, "Glicemia"]
};

var CAMPOS_MEDIDOS = ["pressao_sistolica","pressao_diastolica","frequencia_cardiaca",
                      "temperatura","saturacao","glicemia"];

var CONDICOES = ["cond_diabetes","cond_hipertensao","cond_asma","cond_dislipidemia","cond_outros"];
var FAMILIAR  = ["hf_diabetes","hf_hipertensao","hf_asma","hf_outros"];

/* ---------------------------------------------------------------- utilidades */
function el(id) { return document.getElementById(id); }

function esc(t) {
  return String(t == null ? "" : t)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function hoje() {
  var d = new Date();
  // Montado na mão, e não com toISOString(): à noite, o fuso do Brasil já
  // está no dia seguinte em UTC, e o campo abriria com a data de amanhã.
  return d.getFullYear() + "-" +
         String(d.getMonth()+1).padStart(2,"0") + "-" +
         String(d.getDate()).padStart(2,"0");
}

function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  // Alternativa para navegador antigo. O identificador precisa ser único
  // porque é ele que impede o mesmo atendimento entrar duas vezes se o texto
  // for colado repetido.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c === "x" ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

function dataBr(iso) {
  if (!iso) return "—";
  var p = String(iso).slice(0,10).split("-");
  return p.length === 3 ? p[2]+"/"+p[1]+"/"+p[0] : iso;
}

function idade(nascimento) {
  if (!nascimento) return null;
  var n = new Date(nascimento + "T00:00:00"), h = new Date();
  var a = h.getFullYear() - n.getFullYear();
  var m = h.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && h.getDate() < n.getDate())) a--;
  return a;
}

function normalizar(t) {
  return String(t||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
}

/* --------------------------------------------------------- armazenamento */
function carregar() {
  try {
    var bruto = localStorage.getItem(CHAVE);
    anotacoes = bruto ? JSON.parse(bruto) : [];
  } catch (e) {
    anotacoes = [];
  }
  montarListaAnotadores();
}

/* -------------------------------------------------------------------------
   QUEM ESTÁ ANOTANDO

   Lista suspensa, e não campo de texto. O arquivo guarda o identificador da
   conta escolhida; o nome digitado só existe na opção "outra pessoa", que é o
   caminho de quem ainda não tem acesso.

   A diferença aparece na importação: identificador casa sempre, nome digitado
   erra em "Ana" vs "Ana Ribeiro de Souza". Um atendimento creditado à
   pessoa errada é pior do que um sem crédito nenhum.
------------------------------------------------------------------------- */
var OUTRA = "__outra__";

function montarListaAnotadores() {
  var sel = el("anotador");
  var usuarios = DADOS.usuarios || [];
  var html = '<option value="">— escolha —</option>';
  for (var i = 0; i < usuarios.length; i++) {
    html += '<option value="' + esc(usuarios[i].user_id) + '">' + esc(usuarios[i].nome) + '</option>';
  }
  html += '<option value="' + OUTRA + '">Outra pessoa — digitar o nome</option>';
  sel.innerHTML = html;

  var salvo = localStorage.getItem(CHAVE + "-anotador") || "";
  // Se a conta salva não está mais na lista (ficha nova, pessoa removida),
  // volta para vazio em vez de fingir que continua escolhida.
  var existe = salvo === OUTRA;
  for (var j = 0; j < usuarios.length; j++) if (usuarios[j].user_id === salvo) existe = true;
  sel.value = existe ? salvo : "";

  el("anotador_outro").value = localStorage.getItem(CHAVE + "-anotador-nome") || "";
  trocarAnotador();
}

function trocarAnotador() {
  el("box_anotador_outro").className =
    el("anotador").value === OUTRA ? "campo" : "campo oculto";
  guardarAnotador();
  atualizarBloqueio();
}

/* -------------------------------------------------------------------------
   Identificar-se vem ANTES de atender.

   O botão de novo atendimento fica desligado até a pessoa dizer quem é. Antes
   isso era só uma validação na hora de salvar — o que deixava alguém preencher
   uma ficha inteira, com o idoso na frente, para só então descobrir que faltava
   um passo lá atrás. Barrar na entrada custa um clique; barrar na saída custa
   um atendimento refeito.
------------------------------------------------------------------------- */
function atualizarBloqueio() {
  var pronto = autorAtual() !== null;
  var botao = el("btn-novo");

  botao.disabled = !pronto;
  botao.style.opacity = pronto ? "" : "0.5";
  botao.style.cursor = pronto ? "" : "not-allowed";

  el("aviso-identificacao").innerHTML = pronto
    ? ""
    : '<div class="aviso">Escolha abaixo quem está anotando para liberar os atendimentos. ' +
      'O nome fica junto de cada ficha, para registrar quem atendeu.</div>';
}

function guardarAnotador() {
  localStorage.setItem(CHAVE + "-anotador", el("anotador").value);
  localStorage.setItem(CHAVE + "-anotador-nome", el("anotador_outro").value);
}

/** { user_id, nome } de quem está anotando, ou null se ainda não escolheu. */
function autorAtual() {
  var v = el("anotador").value;
  if (!v) return null;

  if (v === OUTRA) {
    var nome = el("anotador_outro").value.trim();
    if (!nome) return null;
    // Sem user_id de propósito: é o sinal que faz a importação parar e avisar.
    return { user_id: null, nome: nome };
  }

  var usuarios = DADOS.usuarios || [];
  for (var i = 0; i < usuarios.length; i++) {
    if (usuarios[i].user_id === v) return { user_id: v, nome: usuarios[i].nome };
  }
  return null;
}

function persistir() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(anotacoes));
  } catch (e) {
    alert("Não foi possível salvar neste aparelho. Exporte o que já foi anotado agora, antes de continuar.");
  }
}

/* ------------------------------------------------------------- navegação */
function mostrar(id) {
  var telas = ["tela-inicio","tela-escolha","tela-form","tela-exportar"];
  for (var i = 0; i < telas.length; i++) {
    el(telas[i]).className = telas[i] === id ? "" : "oculto";
  }
  window.scrollTo(0,0);
}

function voltarInicio() { mostrar("tela-inicio"); renderLista(); atualizarBloqueio(); }

function irParaNovo() {
  // Segunda barreira: o botão já está desligado, mas alguém pode chamar esta
  // função pelo console. Confiar só no visual seria confiar no navegador.
  if (!autorAtual()) {
    atualizarBloqueio();
    el("anotador").focus();
    return;
  }
  el("busca").value = "";
  el("resultados").innerHTML = "";
  mostrar("tela-escolha");
}

/* ----------------------------------------------------------------- busca */
function buscar(termo) {
  var t = normalizar(termo).trim();
  if (t.length < 2) { el("resultados").innerHTML = ""; return; }

  var achados = DADOS.atendidos.filter(function(a) {
    return normalizar(a.nome).indexOf(t) !== -1;
  }).slice(0, 25);

  if (achados.length === 0) {
    el("resultados").innerHTML = '<p class="sub">Ninguém encontrado com esse nome.</p>';
    return;
  }

  var html = "";
  for (var i = 0; i < achados.length; i++) {
    var a = achados[i], id = idade(a.nascimento);
    html += '<div class="item"><div><b>' + esc(a.nome) + '</b><br><small>' +
            (id === null ? "idade não informada" : id + " anos") +
            '</small></div><button onclick="escolher(\'' + a.id + '\')">Atender</button></div>';
  }
  el("resultados").innerHTML = html;
}

function escolher(id) {
  var achado = null;
  for (var i = 0; i < DADOS.atendidos.length; i++) {
    if (DADOS.atendidos[i].id === id) { achado = DADOS.atendidos[i]; break; }
  }
  abrirFormulario(achado);
}

/* ------------------------------------------------------------ formulário */
var CAMPOS_CADASTRO = ["nascimento","genero","telefone","endereco"];
var ROTULO_CADASTRO = {
  nascimento: "data de nascimento", genero: "gênero",
  telefone: "telefone", endereco: "endereço"
};

/* -------------------------------------------------------------------------
   Monta o bloco de cadastro conforme o caso.

   Três situações diferentes, e a distinção importa:

     PESSOA NOVA      todos os campos, em branco, nome obrigatório.
     JÁ CADASTRADA,   só os campos que faltam, marcados como faltando. É a
     ficha de coleta  versão dos voluntários: ela sabe QUE falta telefone, mas
                      não carrega o telefone de quem já tem.
     JÁ CADASTRADA,   todos os campos com os valores atuais, para conferir e
     ficha completa   corrigir. Só a responsável tem esse arquivo.
------------------------------------------------------------------------- */
function montarBlocoCadastro(atendido) {
  function mostrarCampo(nome, visivel, faltando) {
    var box = el("box_" + nome);
    box.className = visivel ? "campo" : "campo oculto";
    if (!visivel) return;
    var rotulo = box.querySelector("label");
    var base = rotulo.textContent.replace(/ — faltando$/, "");
    rotulo.textContent = faltando ? base + " — faltando" : base;
    rotulo.style.color = faltando ? "#92400e" : "";
  }

  if (!atendido) {
    el("fs-cadastro").className = "";
    el("legenda-cadastro").textContent = "Cadastro";
    el("dica-cadastro").textContent = "Pessoa ainda não cadastrada. O nome é obrigatório; o resto pode ficar em branco.";
    mostrarCampo("nome", true, false);
    for (var i = 0; i < CAMPOS_CADASTRO.length; i++) mostrarCampo(CAMPOS_CADASTRO[i], true, false);
    return;
  }

  var faltando = atendido.faltando || [];
  var temValores = !!atendido.cadastro;   // só a versão completa traz isto

  // Nome nunca é editado aqui: trocar o nome de um cadastro existente é
  // decisão para a tela do sistema, com o histórico à vista, não no campo.
  mostrarCampo("nome", false, false);

  var algumVisivel = false;
  for (var j = 0; j < CAMPOS_CADASTRO.length; j++) {
    var campo = CAMPOS_CADASTRO[j];
    var falta = faltando.indexOf(campo) !== -1;
    var visivel = temValores || falta;
    mostrarCampo(campo, visivel, falta);
    if (visivel) algumVisivel = true;
  }

  if (temValores) {
    el("nascimento").value = atendido.nascimento || "";
    el("genero").value = atendido.cadastro.genero || "";
    el("telefone").value = atendido.cadastro.telefone || "";
    el("endereco").value = atendido.cadastro.endereco || "";
  }

  el("fs-cadastro").className = algumVisivel ? "" : "oculto";
  el("legenda-cadastro").textContent = "Completar cadastro";

  if (faltando.length > 0) {
    var nomes = [];
    for (var k = 0; k < faltando.length; k++) nomes.push(ROTULO_CADASTRO[faltando[k]]);
    el("dica-cadastro").textContent =
      "Faltando no cadastro: " + nomes.join(", ") + ". Preencha se conseguir a informação — é opcional.";
  } else {
    el("dica-cadastro").textContent =
      "Cadastro completo. Altere apenas se algum dado estiver errado ou desatualizado.";
  }
}

function abrirFormulario(atendido) {
  editandoIdoso = atendido;
  limparFormulario();
  el("msg-form").innerHTML = "";
  el("data").value = hoje();

  montarBlocoCadastro(atendido);

  var hist = (atendido && atendido.historico) ? atendido.historico : [];

  if (atendido) {
    el("msg-form").innerHTML = '<div class="ok"><b>' + esc(atendido.nome) + '</b> — ' +
      (idade(atendido.nascimento) === null ? "idade não informada" : idade(atendido.nascimento) + " anos") +
      '</div>';
  }

  /* -----------------------------------------------------------------
     PRÉ-PREENCHIMENTO — mesma regra de src/features/registros/utils/prefill.ts

     Copia o que descreve a SITUAÇÃO da pessoa (condições, histórico
     familiar, medicamentos, tabagismo). NUNCA copia medição: pressão,
     frequência, temperatura, saturação, glicemia, jejum e descrição
     começam vazios sempre.

     Copiar uma pressão antiga seria registrar uma medição que não
     aconteceu — e alguém acabaria não remedindo por já ver o campo cheio.
  ----------------------------------------------------------------- */
  if (hist.length > 0) {
    var u = hist[0];
    for (var i = 0; i < CONDICOES.length; i++) el(CONDICOES[i]).checked = !!u[CONDICOES[i]];
    el("cond_outros_desc").value = u.cond_outros_desc || "";
    for (var j = 0; j < FAMILIAR.length; j++) el(FAMILIAR[j]).checked = !!u[FAMILIAR[j]];
    el("hf_diabetes_quem").value = u.hf_diabetes_quem || "";
    el("hf_hipertensao_quem").value = u.hf_hipertensao_quem || "";
    el("hf_asma_quem").value = u.hf_asma_quem || "";
    el("hf_outros_desc").value = u.hf_outros_desc || "";
    el("hf_outros_quem").value = u.hf_outros_quem || "";
    marcarRadio("usa_medicamentos", boolParaRadio(u.usa_medicamentos));
    el("medicamentos_quais").value = u.medicamentos_quais || "";
    marcarRadio("fumante", boolParaRadio(u.fumante));
    marcarRadio("fumante_passivo", boolParaRadio(u.fumante_passivo));
    sincronizarCaixas();
  }

  el("bloco-historico").innerHTML = hist.length > 0 ? montarHistorico(hist) : "";
  mostrar("tela-form");
}

function montarHistorico(hist) {
  var html = '<div class="cartao"><h2 style="margin-top:0">Atendimentos anteriores (' + hist.length + ')</h2>';
  for (var i = 0; i < hist.length && i < 20; i++) {
    var r = hist[i], partes = [];
    if (r.pressao_sistolica != null && r.pressao_diastolica != null)
      partes.push("PA " + r.pressao_sistolica + "/" + r.pressao_diastolica + " mmHg");
    if (r.frequencia_cardiaca != null) partes.push("FC " + r.frequencia_cardiaca + " bpm");
    if (r.temperatura != null) partes.push("Temp " + r.temperatura + " °C");
    if (r.saturacao != null) partes.push("Sat " + r.saturacao + "%");
    if (r.glicemia != null) partes.push("Glicemia " + r.glicemia + " mg/dL" +
      (r.glicemia_jejum ? " (jejum: " + r.glicemia_jejum + ")" : ""));

    html += '<div class="hist"><b>' + dataBr(r.data) + '</b>' +
            (partes.length ? esc(partes.join(" · ")) : "<i>sem medições registradas</i>") +
            (r.descricao ? "<br>" + esc(r.descricao) : "") + "</div>";
  }
  return html + "</div>";
}

function boolParaRadio(v) { return v === null || v === undefined ? "" : (v ? "sim" : "nao"); }

function marcarRadio(nome, valor) {
  var rs = document.getElementsByName(nome);
  for (var i = 0; i < rs.length; i++) rs[i].checked = (rs[i].value === valor);
}

function lerRadio(nome) {
  var rs = document.getElementsByName(nome);
  for (var i = 0; i < rs.length; i++) if (rs[i].checked) return rs[i].value;
  return "";
}

function alternar(idCheck, idBox) {
  el(idBox).className = el(idCheck).checked ? "campo" : "campo oculto";
}

function alternarMed() {
  el("box_medicamentos").className = lerRadio("usa_medicamentos") === "sim" ? "campo" : "campo oculto";
}

function sincronizarCaixas() {
  alternar("cond_outros","box_cond_outros");
  alternar("hf_diabetes","box_hf_diabetes");
  alternar("hf_hipertensao","box_hf_hipertensao");
  alternar("hf_asma","box_hf_asma");
  el("box_hf_outros").className = el("hf_outros").checked ? "" : "oculto";
  alternarMed();
}

function limparFormulario() {
  var texto = ["nome","nascimento","genero","telefone","endereco","cond_outros_desc",
    "hf_diabetes_quem","hf_hipertensao_quem","hf_asma_quem","hf_outros_desc","hf_outros_quem",
    "medicamentos_quais","descricao"].concat(CAMPOS_MEDIDOS);
  for (var i = 0; i < texto.length; i++) el(texto[i]).value = "";
  var checks = CONDICOES.concat(FAMILIAR);
  for (var j = 0; j < checks.length; j++) el(checks[j]).checked = false;
  marcarRadio("usa_medicamentos",""); marcarRadio("fumante",""); marcarRadio("fumante_passivo","");
  marcarRadio("glicemia_jejum","");
  sincronizarCaixas();
}

/* ------------------------------------------------------------- validação */
function numero(id) {
  var v = el(id).value.trim();
  if (v === "") return null;
  var n = Number(v.replace(",", "."));
  return isFinite(n) ? n : NaN;
}

function validar(dados) {
  var erros = [];

  // Bloqueia aqui, e não na importação: sem isto, a pessoa descobriria dias
  // depois que os 20 atendimentos do dia estão sem responsável.
  if (!autorAtual()) {
    erros.push('Escolha quem está anotando, na tela inicial, antes de salvar o atendimento.');
  }

  if (!editandoIdoso && !dados.cadastro.nome) erros.push("O nome é obrigatório.");
  if (!dados.registro.data_atendimento) erros.push("A data do atendimento é obrigatória.");
  if (dados.registro.data_atendimento > hoje()) erros.push("A data do atendimento não pode ser no futuro.");

  for (var campo in LIMITES) {
    var v = dados.registro[campo];
    if (v === null) continue;
    if (isNaN(v)) { erros.push(LIMITES[campo][2] + ": valor inválido."); continue; }
    if (v < LIMITES[campo][0] || v > LIMITES[campo][1]) {
      erros.push(LIMITES[campo][2] + " fora do limite aceito (" +
                 LIMITES[campo][0] + " a " + LIMITES[campo][1] + ").");
    }
  }

  // Fato físico, não julgamento clínico: pega a inversão 80/120 na digitação.
  var s = dados.registro.pressao_sistolica, d = dados.registro.pressao_diastolica;
  if (s !== null && d !== null && !isNaN(s) && !isNaN(d) && s <= d) {
    erros.push("A pressão sistólica precisa ser maior que a diastólica. Confira se os dois valores não foram trocados.");
  }

  // Coerência entre marcação e texto — mesmas regras dos CHECKs do banco.
  if (dados.registro.cond_outros && !dados.registro.cond_outros_desc)
    erros.push('Marcou "Outros" nas condições: descreva quais.');
  if (dados.registro.hf_outros && !dados.registro.hf_outros_desc)
    erros.push('Marcou "Outros" no histórico familiar: descreva quais.');
  if (dados.registro.usa_medicamentos === true && !dados.registro.medicamentos_quais)
    erros.push('Marcou que usa medicamentos: informe quais.');
  if (dados.registro.glicemia_jejum && dados.registro.glicemia === null)
    erros.push('"Em jejum" só se aplica quando a glicemia foi medida.');

  return erros;
}

function coletarAvisos(reg) {
  var lista = [];
  for (var campo in AVISOS) {
    var v = reg[campo];
    if (v === null || isNaN(v)) continue;
    if (v < AVISOS[campo][0] || v > AVISOS[campo][1]) {
      lista.push(AVISOS[campo][2] + ": " + v);
    }
  }
  return lista;
}

/* ---------------------------------------------------------------- salvar */
function coletar() {
  function txt(id) { return el(id).value.trim(); }
  function tri(nome) { var v = lerRadio(nome); return v === "" ? null : v === "sim"; }

  return {
    cadastro: {
      nome: txt("nome"),
      data_nascimento: txt("nascimento") || null,
      genero: txt("genero") || null,
      telefone: txt("telefone") || null,
      endereco: txt("endereco") || null
    },
    registro: {
      data_atendimento: txt("data"),
      cond_diabetes: el("cond_diabetes").checked,
      cond_hipertensao: el("cond_hipertensao").checked,
      cond_asma: el("cond_asma").checked,
      cond_dislipidemia: el("cond_dislipidemia").checked,
      cond_outros: el("cond_outros").checked,
      cond_outros_desc: txt("cond_outros_desc") || null,
      hf_diabetes: el("hf_diabetes").checked,
      hf_diabetes_quem: txt("hf_diabetes_quem") || null,
      hf_hipertensao: el("hf_hipertensao").checked,
      hf_hipertensao_quem: txt("hf_hipertensao_quem") || null,
      hf_asma: el("hf_asma").checked,
      hf_asma_quem: txt("hf_asma_quem") || null,
      hf_outros: el("hf_outros").checked,
      hf_outros_desc: txt("hf_outros_desc") || null,
      hf_outros_quem: txt("hf_outros_quem") || null,
      usa_medicamentos: tri("usa_medicamentos"),
      medicamentos_quais: txt("medicamentos_quais") || null,
      fumante: tri("fumante"),
      fumante_passivo: tri("fumante_passivo"),
      pressao_sistolica: numero("pressao_sistolica"),
      pressao_diastolica: numero("pressao_diastolica"),
      frequencia_cardiaca: numero("frequencia_cardiaca"),
      temperatura: numero("temperatura"),
      saturacao: numero("saturacao"),
      glicemia: numero("glicemia"),
      glicemia_jejum: lerRadio("glicemia_jejum") || null,
      descricao: txt("descricao") || null
    }
  };
}

/**
 * O que a pessoa preencheu ou corrigiu no cadastro de quem JÁ existe.
 *
 * Devolve só o que MUDOU, nunca o cadastro inteiro. Se voltasse tudo, a
 * importação sobrescreveria campos que ninguém tocou — e um campo em branco
 * na tela apagaria um dado bom que estava no banco. Enviar apenas a diferença
 * torna impossível apagar sem querer.
 */
function coletarComplemento() {
  if (!editandoIdoso) return null;

  var atual = editandoIdoso.cadastro || {};
  var conhecido = {
    nascimento: editandoIdoso.nascimento || "",
    genero: atual.genero || "",
    telefone: atual.telefone || "",
    endereco: atual.endereco || ""
  };

  var mudou = {}, algum = false;
  for (var i = 0; i < CAMPOS_CADASTRO.length; i++) {
    var campo = CAMPOS_CADASTRO[i];
    // Campo que nem apareceu na tela não pode ter sido preenchido.
    if (el("box_" + campo).className.indexOf("oculto") !== -1) continue;
    var valor = el(campo).value.trim();
    if (valor === "" || valor === conhecido[campo]) continue;
    mudou[campo] = valor;
    algum = true;
  }
  return algum ? mudou : null;
}

function salvar() {
  var dados = coletar();
  var erros = validar(dados);

  if (erros.length > 0) {
    el("msg-form").innerHTML = '<div class="erro"><b>Corrija antes de salvar:</b><br>' +
      esc(erros.join(" ")) + "</div>";
    window.scrollTo(0,0);
    return;
  }

  var avisos = coletarAvisos(dados.registro);
  if (avisos.length > 0) {
    var texto = "Valor incomum, confirme se foi digitado corretamente:\n\n" +
                avisos.join("\n") + "\n\nSalvar assim mesmo?";
    if (!confirm(texto)) return;
  }

  anotacoes.push({
    id: uuid(),                                  // gerado aqui: impede duplicata na importação
    autor: autorAtual(),                         // { user_id, nome } — user_id null = sem conta
    salvoEm: new Date().toISOString(),
    idoso_id: editandoIdoso ? editandoIdoso.id : null,
    nomeReferencia: editandoIdoso ? editandoIdoso.nome : dados.cadastro.nome,
    cadastroNovo: editandoIdoso ? null : dados.cadastro,
    cadastroComplemento: editandoIdoso ? coletarComplemento() : null,
    registro: dados.registro
  });

  persistir();
  voltarInicio();
}

/* ------------------------------------------------------------ lista do dia */
function renderLista() {
  el("contador").textContent = anotacoes.length;

  if (anotacoes.length === 0) {
    el("lista-anotados").innerHTML = '<p class="sub" style="margin:0">Nada anotado ainda.</p>';
    return;
  }

  var html = "";
  for (var i = anotacoes.length - 1; i >= 0; i--) {
    var a = anotacoes[i];
    html += '<div class="item"><div><b>' + esc(a.nomeReferencia) + '</b>' +
            (a.cadastroNovo ? ' <small>(cadastro novo)</small>' : '') +
            (a.cadastroComplemento ? ' <small>(+ cadastro completado)</small>' : '') +
            '<br><small>' + dataBr(a.registro.data_atendimento) +
            (a.autor ? " · por " + esc(a.autor.nome) : "") +
            (a.autor && !a.autor.user_id ? " (sem acesso ao sistema)" : "") +
            '</small></div><button class="perigo" onclick="apagar(\'' + a.id + '\')">Apagar</button></div>';
  }
  el("lista-anotados").innerHTML = html;
}

function apagar(id) {
  if (!confirm("Apagar esta anotação? Não há como recuperar.")) return;
  anotacoes = anotacoes.filter(function(a) { return a.id !== id; });
  persistir();
  renderLista();
}

/* -------------------------------------------------------------- exportar */
function montarExportacao() {
  if (anotacoes.length === 0) {
    el("msg-exportar").innerHTML = '<div class="aviso">Não há nada anotado para exportar.</div>';
    el("saida").value = "";
    return;
  }
  el("msg-exportar").innerHTML = '<div class="ok">' + anotacoes.length +
    ' atendimento(s) prontos para exportar.</div>';
  var semAcesso = [];
  for (var i = 0; i < anotacoes.length; i++) {
    var a = anotacoes[i];
    if (a.autor && !a.autor.user_id && semAcesso.indexOf(a.autor.nome) === -1) {
      semAcesso.push(a.autor.nome);
    }
  }
  if (semAcesso.length > 0) {
    el("msg-exportar").innerHTML += '<div class="aviso">' +
      'Atenção: ' + esc(semAcesso.join(", ")) +
      ' não tem acesso ao sistema. Avise o administrador para criar o acesso ' +
      'antes de importar, senão a importação vai recusar o arquivo.</div>';
  }

  el("saida").value = JSON.stringify({
    origem: "ficha-campo",
    versao: 3,
    // Quem estava com o aparelho, no topo do arquivo. Serve para quem recebe
    // cinco exportações por mensagem saber de quem é cada uma sem abrir.
    // A atribuição de cada atendimento continua vindo do campo "autor" de
    // cada um, não daqui.
    responsavel: autorAtual(),
    exportadoEm: new Date().toISOString(),
    listaGeradaEm: DADOS.geradoEm,
    atendimentos: anotacoes
  }, null, 2);
}

function copiar() {
  var area = el("saida");
  if (!area.value) return;
  area.removeAttribute("readonly");
  area.select();
  area.setSelectionRange(0, 999999);          // iOS ignora select() sozinho
  try { document.execCommand("copy"); } catch (e) {}
  if (navigator.clipboard) {
    navigator.clipboard.writeText(area.value).catch(function() {});
  }
  area.setAttribute("readonly","readonly");
  el("msg-exportar").innerHTML = '<div class="ok">Copiado. Cole numa mensagem e envie.</div>';
}

/**
 * Nome de arquivo legível: "atendimentos-ana-ribeiro-2026-08-31.json".
 *
 * Sem acento, sem espaço e sem maiúscula porque o arquivo vai passar por
 * WhatsApp, e-mail e pasta de downloads de sistemas diferentes — e é onde nome
 * com caractere especial vira lixo ou some.
 */
function apelidoArquivo() {
  var autor = autorAtual();
  var nome = autor ? autor.nome : "";
  var limpo = nome
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return "atendimentos" + (limpo ? "-" + limpo : "") + "-" + hoje() + ".json";
}

function baixar() {
  if (!el("saida").value) return;
  var blob = new Blob([el("saida").value], { type: "application/json" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = apelidoArquivo();
  a.click();
  URL.revokeObjectURL(a.href);
}

function limpar() {
  if (!confirm("Isto apaga TODAS as anotações deste aparelho e não há como recuperar.\n\nSó continue se os dados já estiverem lançados no sistema.")) return;
  if (!confirm("Confirma mesmo? São " + anotacoes.length + " atendimento(s).")) return;
  anotacoes = [];
  persistir();
  montarExportacao();
  renderLista();
}

/* ----------------------------------------------------------------- início */
(function iniciar() {
  var d = new Date(DADOS.geradoEm);
  el("cabecalho").textContent =
    "Lista de " + DADOS.atendidos.length + " atendidos, gerada em " +
    d.toLocaleDateString("pt-BR") + " às " + d.toLocaleTimeString("pt-BR").slice(0,5) +
    ". Funciona sem internet.";
  carregar();
  renderLista();
  atualizarBloqueio();
})();
</script>
</body>
</html>`
