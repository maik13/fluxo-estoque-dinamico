import * as XLSX from 'xlsx';
import { EstoqueItem } from '@/types/estoque';
import { DadosEstoqueContado } from '@/hooks/useEstoqueContado';
import { supabase } from '@/integrations/supabase/client';

interface ExportOptions {
  titulo: string;
  nomeEstoque: string;
  itens: EstoqueItem[];
  incluirEstatisticas?: boolean;
}

const itemEstaPrecificado = (item: EstoqueItem): boolean =>
  typeof item.valor === 'number' && Number.isFinite(item.valor) && item.valor > 0;

const carregarUltimaAtualizacaoValor = async (): Promise<Map<string, string>> => {
  const mapa = new Map<string, string>();

  try {
    const { data, error } = await (supabase as any).rpc('listar_ultima_atualizacao_valor_itens_v1');

    if (error) {
      console.warn('Não foi possível carregar o histórico específico de valores:', error);
      return mapa;
    }

    for (const linha of data ?? []) {
      if (linha?.item_id && linha?.valor_atualizado_em) {
        mapa.set(String(linha.item_id), String(linha.valor_atualizado_em));
      }
    }
  } catch (error) {
    // A exportação continua funcionando mesmo se a auditoria ainda não estiver disponível.
    console.warn('Histórico específico de valores indisponível durante a exportação:', error);
  }

  return mapa;
};

const formatarDataAtualizacaoValor = (
  item: EstoqueItem,
  datasAtualizacao: Map<string, string>
): string => {
  if (!itemEstaPrecificado(item)) return '';

  const data = datasAtualizacao.get(item.id);
  if (!data) return 'Sem histórico específico';

  return new Date(data).toLocaleString('pt-BR');
};

export const exportarExcel = async ({
  titulo,
  nomeEstoque,
  itens,
  incluirEstatisticas = true
}: ExportOptions) => {
  // Consulta somente de leitura. Se o recurso de auditoria ainda não estiver aplicado,
  // o Excel continua sendo gerado normalmente e sinaliza os itens sem histórico específico.
  const datasAtualizacaoValor = await carregarUltimaAtualizacaoValor();

  // Criar workbook
  const workbook = XLSX.utils.book_new();

  // Preparar dados organizados
  const dadosOrganizados = itens.map(item => ({
    'Código de Barras': item.codigoBarras,
    'Nome do Item': item.nome,
    'Marca': item.marca || '',
    'Especificação': item.especificacao || '',
    'Localização': item.localizacao || '',
    'Caixa/Organizador': item.caixaOrganizador || '',
    'Origem': item.origem || '',
    'Estoque Atual': item.estoqueAtual,
    'Quantidade Mínima': item.quantidadeMinima || '',
    'Unidade': item.unidade,
    'Condição': item.condicao,
    'NCM': item.ncm || '',
    'Valor': itemEstaPrecificado(item) ? item.valor : '',
    'Última Atualização do Valor': formatarDataAtualizacaoValor(item, datasAtualizacaoValor),
    'Última Movimentação': item.ultimaMovimentacao ?
      new Date(item.ultimaMovimentacao.dataHora).toLocaleDateString('pt-BR') + ' ' +
      new Date(item.ultimaMovimentacao.dataHora).toLocaleTimeString('pt-BR') : '',
    'Tipo Última Mov.': item.ultimaMovimentacao?.tipo || '',
    'Status do Estoque': getStatusEstoque(item)
  }));

  // Criar aba principal com os dados
  const worksheet = XLSX.utils.json_to_sheet(dadosOrganizados);

  // Definir larguras das colunas para melhor visualização
  const columnWidths = [
    { wch: 15 }, // Código de Barras
    { wch: 30 }, // Nome do Item
    { wch: 15 }, // Marca
    { wch: 25 }, // Especificação
    { wch: 20 }, // Localização
    { wch: 20 }, // Caixa/Organizador
    { wch: 15 }, // Origem
    { wch: 12 }, // Estoque Atual
    { wch: 12 }, // Quantidade Mínima
    { wch: 10 }, // Unidade
    { wch: 10 }, // Condição
    { wch: 12 }, // NCM
    { wch: 12 }, // Valor
    { wch: 24 }, // Última Atualização do Valor
    { wch: 20 }, // Última Movimentação
    { wch: 15 }, // Tipo Última Mov
    { wch: 15 }  // Status do Estoque
  ];

  worksheet['!cols'] = columnWidths;

  // Adicionar a aba principal
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Estoque Completo');

  // Criar uma aba dedicada somente aos itens que já possuem valor cadastrado.
  // Para fins operacionais, valor nulo, inválido ou igual a zero é tratado como não precificado.
  const itensPrecificados = itens.filter(itemEstaPrecificado);
  const dadosPrecificados = itensPrecificados.map(item => {
    const valorUnitario = item.valor as number;
    const valorTotalEstoque = valorUnitario * item.estoqueAtual;

    return {
      'Código de Barras': item.codigoBarras,
      'Código Antigo': item.codigoAntigo || '',
      'Nome do Item': item.nome,
      'Marca': item.marca || '',
      'Especificação': item.especificacao || '',
      'Localização': item.localizacao || '',
      'Caixa/Organizador': item.caixaOrganizador || '',
      'Estoque Atual': item.estoqueAtual,
      'Quantidade Mínima': item.quantidadeMinima || '',
      'Unidade': item.unidade,
      'Valor Unitário (R$)': valorUnitario,
      'Última Atualização do Valor': formatarDataAtualizacaoValor(item, datasAtualizacaoValor),
      'Valor Total em Estoque (R$)': valorTotalEstoque,
      'NCM': item.ncm || '',
      'Condição': item.condicao || '',
      'Status do Estoque': getStatusEstoque(item)
    };
  });

  const worksheetPrecificados = XLSX.utils.json_to_sheet(
    dadosPrecificados.length > 0
      ? dadosPrecificados
      : [{ 'Mensagem': 'Nenhum item precificado encontrado nos filtros atuais.' }]
  );

  worksheetPrecificados['!cols'] = dadosPrecificados.length > 0
    ? [
        { wch: 15 },
        { wch: 15 },
        { wch: 32 },
        { wch: 18 },
        { wch: 30 },
        { wch: 22 },
        { wch: 22 },
        { wch: 14 },
        { wch: 16 },
        { wch: 10 },
        { wch: 18 },
        { wch: 24 },
        { wch: 24 },
        { wch: 14 },
        { wch: 14 },
        { wch: 16 }
      ]
    : [{ wch: 60 }];

  XLSX.utils.book_append_sheet(workbook, worksheetPrecificados, 'Itens Precificados');

  // Se incluir estatísticas, criar aba de resumo
  if (incluirEstatisticas) {
    // Estatísticas gerais
    const totalItens = itens.length;
    const comEstoque = itens.filter(item => item.estoqueAtual > 0).length;
    const estoqueZero = itens.filter(item => item.estoqueAtual === 0).length;
    const estoqueBaixo = itens.filter(item =>
      item.quantidadeMinima && item.estoqueAtual <= item.quantidadeMinima
    ).length;
    const totalPrecificados = itensPrecificados.length;
    const totalSemPreco = totalItens - totalPrecificados;
    const valorTotalEstoquePrecificado = itensPrecificados.reduce(
      (total, item) => total + (item.valor as number) * item.estoqueAtual,
      0
    );
    const precificadosComHistorico = itensPrecificados.filter(item => datasAtualizacaoValor.has(item.id)).length;
    const precificadosSemHistorico = totalPrecificados - precificadosComHistorico;

    // Dados do resumo
    const dadosResumo = [
      { 'Métrica': 'RESUMO GERAL', 'Valor': '', 'Observação': '' },
      { 'Métrica': 'Total de Itens', 'Valor': totalItens, 'Observação': 'Todos os itens considerados na exportação' },
      { 'Métrica': 'Itens Precificados', 'Valor': totalPrecificados, 'Observação': 'Valor unitário maior que zero' },
      { 'Métrica': 'Precificados com histórico de valor', 'Valor': precificadosComHistorico, 'Observação': 'Possuem data específica registrada na auditoria' },
      { 'Métrica': 'Precificados sem histórico específico', 'Valor': precificadosSemHistorico, 'Observação': 'Preço já existia antes da auditoria ou ainda não teve alteração registrada' },
      { 'Métrica': 'Itens sem Preço', 'Valor': totalSemPreco, 'Observação': 'Valor ausente, inválido ou igual a zero' },
      { 'Métrica': 'Valor Total do Estoque Precificado (R$)', 'Valor': valorTotalEstoquePrecificado, 'Observação': 'Valor unitário x saldo atual dos itens precificados' },
      { 'Métrica': 'Itens com Estoque', 'Valor': comEstoque, 'Observação': 'Quantidade > 0' },
      { 'Métrica': 'Itens com Estoque Baixo', 'Valor': estoqueBaixo, 'Observação': 'Abaixo do mínimo' },
      { 'Métrica': 'Itens com Estoque Zerado', 'Valor': estoqueZero, 'Observação': 'Quantidade = 0' }
    ];

    const worksheetResumo = XLSX.utils.json_to_sheet(dadosResumo);
    worksheetResumo['!cols'] = [{ wch: 42 }, { wch: 22 }, { wch: 65 }];

    XLSX.utils.book_append_sheet(workbook, worksheetResumo, 'Resumo e Estatísticas');
  }

  // Gerar e baixar arquivo
  const nomeArquivo = `estoque-${nomeEstoque.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, nomeArquivo);
};

const getStatusEstoque = (item: EstoqueItem): string => {
  if (item.estoqueAtual === 0) return 'ZERADO';
  if (item.quantidadeMinima && item.estoqueAtual <= item.quantidadeMinima) return 'BAIXO';
  return 'OK';
};

export const exportarExcelContado = (
  dados: DadosEstoqueContado,
  filtroTexto: string,
  nomeEstoque: string
) => {
  const workbook = XLSX.utils.book_new();

  const resumoGeral = [
    { Indicador: 'Estoque', Quantidade: nomeEstoque },
    { Indicador: 'Data/hora', Quantidade: new Date().toLocaleString('pt-BR') },
    { Indicador: 'Filtro aplicado', Quantidade: filtroTexto.trim() || '-' },
    { Indicador: 'Códigos cadastrados', Quantidade: dados.totais.codigosCadastrados },
    { Indicador: 'No almoxarifado', Quantidade: dados.totais.noAlmoxarifado },
    { Indicador: 'Em uso/projeto', Quantidade: dados.totais.emUsoProjeto },
    { Indicador: 'Sem saldo', Quantidade: dados.totais.semSaldo },
  ];

  const resumoPorItem = dados.grupos.map((grupo) => ({
    Item: grupo.nome,
    'Códigos cadastrados': grupo.totais.codigosCadastrados,
    'No almoxarifado': grupo.totais.noAlmoxarifado,
    'Em uso/projeto': grupo.totais.emUsoProjeto,
    'Sem saldo': grupo.totais.semSaldo,
  }));

  const detalhamento = dados.grupos.flatMap((grupo) =>
    grupo.classificacoes.flatMap((classificacao) =>
      classificacao.linhas.map((linha) => ({
        Item: grupo.nome,
        Classificação: classificacao.classificacao,
        Código: linha.codigo,
        Marca: linha.marca,
        Especificação: linha.especificacao,
        'Localização almox.': linha.localizacaoAlmox,
        Status: linha.status,
        'Projeto/Local de uso': linha.projetoLocalUso,
        Saldo: linha.saldo,
      }))
    )
  );

  const worksheetResumo = XLSX.utils.json_to_sheet(resumoGeral);
  worksheetResumo['!cols'] = [{ wch: 28 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(workbook, worksheetResumo, 'Resumo Geral');

  const worksheetItens = XLSX.utils.json_to_sheet(resumoPorItem);
  worksheetItens['!cols'] = [{ wch: 38 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(workbook, worksheetItens, 'Resumo por Item');

  const worksheetDetalhamento = XLSX.utils.json_to_sheet(detalhamento);
  worksheetDetalhamento['!cols'] = [
    { wch: 38 },
    { wch: 45 },
    { wch: 16 },
    { wch: 18 },
    { wch: 34 },
    { wch: 26 },
    { wch: 18 },
    { wch: 28 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(workbook, worksheetDetalhamento, 'Detalhamento');

  const nomeArquivo = `relatorio-contado-${nomeEstoque.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, nomeArquivo);
};
