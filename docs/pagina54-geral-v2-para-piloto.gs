/**
 * Automação oficial da Página54 durante o piloto.
 *
 * Fluxo permitido:
 *   RELATÓRIO GERAL V.2 (somente leitura) -> planilha piloto -> sistema.
 *
 * A Geral V2 nunca recebe IDs, fórmulas, formatação ou retornos do sistema.
 * Somente a Página54, a partir da linha 261, participa deste fluxo.
 *
 * Propriedade obrigatória do Script:
 *   PAGINA54_SYNC_TOKEN
 */
const PAGINA54_PILOTO = {
  spreadsheetId: '1rbdYW0eFmVZr4BQ2l_Q3KFIRheaxQY8XR2HvGstLgPA',
  aba: 'Página54',
  primeiraLinha: 2,
  ultimaColuna: 25, // A:Y; Y é o ID de integração do piloto.
  tamanhoLote: 100,
  endpoint: 'https://zhnmblqzvvicqzkzqvrb.supabase.co/functions/v1/pagina54-sync',
};

const PAGINA54_GERAL_V2 = {
  spreadsheetId: '1N_8WEPnZVXrPwz9DedRYdEO3tmPVK84IP7iaFYR8KKk',
  aba: 'Página54',
  primeiraLinha: 261,
  ultimaColunaDeDados: 21, // A:U. V:Y pertencem exclusivamente ao piloto.
  hashesProperty: 'PAGINA54_GERAL_V2_HASHES_V1',
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Financeiro piloto')
    .addItem('Atualizar agora da Geral V2', 'atualizarAgoraDaGeralV2')
    .addItem('Ativar atualização automática da Geral V2', 'ativarSincronizacaoGeralV2Automatica')
    .addItem('Importar alterações feitas no piloto', 'sincronizarAlteracoesDaPlanilha')
    .addToUi();
}

/**
 * Acionador periódico: seguro para executar a cada 10 minutos.
 * Não chama SpreadsheetApp.getUi(), pois acionadores não têm interface.
 */
function sincronizarGeralV2ParaPiloto() {
  const trava = LockService.getScriptLock();
  if (!trava.tryLock(30 * 1000)) return;

  try {
    const piloto = obterAbaPiloto_();
    const geral = SpreadsheetApp.openById(PAGINA54_GERAL_V2.spreadsheetId)
      .getSheetByName(PAGINA54_GERAL_V2.aba);
    if (!geral) throw new Error('Aba Página54 não encontrada na RELATÓRIO GERAL V.2.');

    const ultimaLinha = geral.getLastRow();
    if (ultimaLinha < PAGINA54_GERAL_V2.primeiraLinha) return;

    garantirCapacidadeDoPiloto_(piloto, ultimaLinha);

    const quantidade = ultimaLinha - PAGINA54_GERAL_V2.primeiraLinha + 1;
    const origem = geral.getRange(
      PAGINA54_GERAL_V2.primeiraLinha,
      1,
      quantidade,
      PAGINA54_GERAL_V2.ultimaColunaDeDados,
    );
    const valores = origem.getValues();
    const formulas = origem.getFormulas();
    const hashesAnteriores = obterHashesDaGeralV2_();
    const hashesAtuais = Object.assign({}, hashesAnteriores);
    const alteradas = [];

    valores.forEach((valoresDaLinha, indice) => {
      const numeroDaLinha = PAGINA54_GERAL_V2.primeiraLinha + indice;
      const linhaComFormula = linhaComFormulas_(valoresDaLinha, formulas[indice]);
      const hash = assinaturaDaLinha_(linhaComFormula, valoresDaLinha);

      // Linhas vazias não removem nada no piloto nem no sistema.
      // Isso evita apagar histórico por acidente em uma edição da Geral V2.
      if (!ehLancamento_(valoresDaLinha)) {
        delete hashesAtuais[numeroDaLinha];
        return;
      }

      if (hashesAnteriores[numeroDaLinha] === hash) return;

      // Só A:U é espelhado. V:X registram origem no piloto e Y preserva o ID.
      piloto.getRange(numeroDaLinha, 1, 1, PAGINA54_GERAL_V2.ultimaColunaDeDados)
        .setValues([linhaComFormula]);
      piloto.getRange(numeroDaLinha, 22, 1, 3).setValues([[
        'RELATÓRIO GERAL V.2',
        'GERAL_V2',
        new Date(),
      ]]);

      hashesAtuais[numeroDaLinha] = hash;
      alteradas.push(numeroDaLinha);
    });

    salvarHashesDaGeralV2_(hashesAtuais);

    if (alteradas.length) {
      garantirIds_(piloto);
      sincronizarLinhas_(piloto, alteradas, false);
    }
  } finally {
    trava.releaseLock();
  }
}

function atualizarAgoraDaGeralV2() {
  sincronizarGeralV2ParaPiloto();
  SpreadsheetApp.getUi().alert('A Geral V2 foi conferida e as alterações foram enviadas ao sistema.');
}

function ativarSincronizacaoGeralV2Automatica() {
  // A Geral V2 é a fonte oficial. Remove somente antigos agendamentos de
  // retorno do sistema que poderiam sobrescrever o espelho no piloto.
  const funcoesAntigas = new Set([
    'sincronizarGeralV2ParaPiloto',
    'trazerAlteracoesDoSistema',
    'sincronizarSistemaParaPlanilha',
  ]);
  ScriptApp.getProjectTriggers().forEach((acionador) => {
    if (funcoesAntigas.has(acionador.getHandlerFunction())) {
      ScriptApp.deleteTrigger(acionador);
    }
  });

  ScriptApp.newTrigger('sincronizarGeralV2ParaPiloto')
    .timeBased()
    .everyMinutes(10)
    .create();

  SpreadsheetApp.getUi().alert(
    'Automação ativada: a cada 10 minutos a Página54 da Geral V2 (linha 261 em diante) será atualizada no piloto e no sistema.'
  );
}

function onEdit(evento) {
  const intervalo = evento && evento.range;
  if (!intervalo) return;
  const aba = intervalo.getSheet();
  if (!ehPlanilhaPiloto_(aba) || intervalo.getLastRow() < PAGINA54_PILOTO.primeiraLinha) return;
  if (intervalo.getColumn() > PAGINA54_PILOTO.ultimaColuna) return;

  const inicio = Math.max(intervalo.getRow(), PAGINA54_PILOTO.primeiraLinha);
  const linhas = [];
  for (let linha = inicio; linha <= intervalo.getLastRow(); linha += 1) linhas.push(linha);
  sincronizarLinhas_(aba, linhas, true);
}

function sincronizarAlteracoesDaPlanilha() {
  const aba = obterAbaPiloto_();
  sincronizarLinhas_(aba, linhasComLancamento_(aba), false);
}

function sincronizarLinhas_(aba, numerosDeLinha, registrarOrigem) {
  if (!numerosDeLinha.length) return;
  garantirIds_(aba);

  let valores = aba.getRange(1, 1, aba.getLastRow(), PAGINA54_PILOTO.ultimaColuna)
    .getDisplayValues();
  const porNumero = {};
  valores.forEach((linha, indice) => { porNumero[indice + 1] = linha; });
  const numerosValidos = numerosDeLinha.filter((numero) => ehLancamento_(porNumero[numero]));
  if (!numerosValidos.length) return;

  if (registrarOrigem) {
    registrarOrigemDaPlanilha_(aba, numerosValidos);
    valores = aba.getRange(1, 1, aba.getLastRow(), PAGINA54_PILOTO.ultimaColuna)
      .getDisplayValues();
  }

  const linhas = numerosValidos.map((numero) => ({
    linha: numero,
    dados: dadosDaLinha_(valores[numero - 1]),
  }));

  for (let inicio = 0; inicio < linhas.length; inicio += PAGINA54_PILOTO.tamanhoLote) {
    const resposta = chamarIntegracao_({
      action: 'importar_linhas',
      rows: linhas.slice(inicio, inicio + PAGINA54_PILOTO.tamanhoLote),
    });
    if (!resposta.ok || (resposta.results || []).some((resultado) => !resultado.ok)) {
      throw new Error(`Falha ao importar lote: ${JSON.stringify(resposta)}`);
    }
  }
}

function garantirIds_(aba) {
  const ultimaLinha = aba.getLastRow();
  if (ultimaLinha < PAGINA54_PILOTO.primeiraLinha) return;
  const valores = aba.getRange(
    PAGINA54_PILOTO.primeiraLinha, 1,
    ultimaLinha - PAGINA54_PILOTO.primeiraLinha + 1,
    PAGINA54_PILOTO.ultimaColuna,
  ).getDisplayValues();
  const ids = valores.map((linha) => [ehLancamento_(linha) ? (linha[24] || Utilities.getUuid()) : linha[24]]);
  aba.getRange(PAGINA54_PILOTO.primeiraLinha, 25, ids.length, 1).setValues(ids);
}

function registrarOrigemDaPlanilha_(aba, linhas) {
  const autor = Session.getActiveUser().getEmail() || 'Planilha piloto';
  linhas.forEach((linha) => {
    aba.getRange(linha, 22, 1, 3).setValues([[autor, 'PLANILHA_PILOTO', new Date()]]);
  });
}

function linhasComLancamento_(aba) {
  const inicio = PAGINA54_PILOTO.primeiraLinha;
  const quantidade = aba.getLastRow() - inicio + 1;
  if (quantidade <= 0) return [];
  return aba.getRange(inicio, 1, quantidade, PAGINA54_PILOTO.ultimaColuna)
    .getDisplayValues()
    .map((linha, indice) => ehLancamento_(linha) ? indice + inicio : null)
    .filter(Boolean);
}

function dadosDaLinha_(linha) {
  const dados = {};
  'ABCDEFGHIJKLMNOPQRSTUVWXY'.split('').forEach((letra, indice) => { dados[letra] = linha[indice] || ''; });
  dados.integracao_id = linha[24] || '';
  dados.autor_ultima_alteracao = linha[21] || '';
  dados.origem_alteracao = linha[22] || '';
  dados.ultima_atualizacao = linha[23] || '';
  return dados;
}

function ehLancamento_(linha) {
  return Boolean(linha && (linha[2] || linha[4] || linha[8] || linha[9]));
}

function linhaComFormulas_(valores, formulas) {
  return valores.map((valor, indice) => formulas[indice] || valor);
}

function assinaturaDaLinha_(linhaComFormula, valores) {
  const normalizar = (valor) => valor instanceof Date ? valor.getTime() : valor;
  return Utilities.base64EncodeWebSafe(JSON.stringify({
    entrada: linhaComFormula.map(normalizar),
    resultado: valores.map(normalizar),
  }));
}

function obterHashesDaGeralV2_() {
  const texto = PropertiesService.getScriptProperties().getProperty(PAGINA54_GERAL_V2.hashesProperty);
  try { return texto ? JSON.parse(texto) : {}; } catch (erro) { return {}; }
}

function salvarHashesDaGeralV2_(hashes) {
  PropertiesService.getScriptProperties().setProperty(
    PAGINA54_GERAL_V2.hashesProperty,
    JSON.stringify(hashes),
  );
}

function garantirCapacidadeDoPiloto_(aba, ultimaLinhaNecessaria) {
  const maximo = aba.getMaxRows();
  if (maximo >= ultimaLinhaNecessaria) return;
  const novasLinhas = ultimaLinhaNecessaria - maximo;
  aba.insertRowsAfter(maximo, novasLinhas);
  // As linhas novas usam a aparência da última linha existente no piloto.
  aba.getRange(maximo, 1, 1, PAGINA54_PILOTO.ultimaColuna).copyTo(
    aba.getRange(maximo + 1, 1, novasLinhas, PAGINA54_PILOTO.ultimaColuna),
    SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
    false,
  );
}

function ehPlanilhaPiloto_(aba) {
  return aba.getParent().getId() === PAGINA54_PILOTO.spreadsheetId && aba.getName() === PAGINA54_PILOTO.aba;
}

function obterAbaPiloto_() {
  const planilha = SpreadsheetApp.getActive();
  if (planilha.getId() !== PAGINA54_PILOTO.spreadsheetId) {
    throw new Error('Este script é exclusivo da planilha piloto.');
  }
  const aba = planilha.getSheetByName(PAGINA54_PILOTO.aba);
  if (!aba) throw new Error('Aba Página54 não encontrada na planilha piloto.');
  return aba;
}

function chamarIntegracao_(body) {
  const token = PropertiesService.getScriptProperties().getProperty('PAGINA54_SYNC_TOKEN');
  if (!token) throw new Error('Defina a propriedade PAGINA54_SYNC_TOKEN antes de sincronizar.');

  const resposta = UrlFetchApp.fetch(PAGINA54_PILOTO.endpoint, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-pagina54-token': token },
    payload: JSON.stringify(Object.assign({
      spreadsheet_id: PAGINA54_PILOTO.spreadsheetId,
      spreadsheet_titulo: SpreadsheetApp.getActive().getName(),
      aba: PAGINA54_PILOTO.aba,
    }, body)),
  });
  const codigo = resposta.getResponseCode();
  const texto = resposta.getContentText() || '{}';
  let json;
  try { json = JSON.parse(texto); } catch (erro) { throw new Error(`Resposta inválida da integração: ${texto}`); }
  if (codigo >= 300) throw new Error(json.erro || `Erro HTTP ${codigo}`);
  return json;
}
