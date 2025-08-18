import * as XLSX from 'xlsx';
import { EstoqueItem } from '@/types/estoque';

interface ExportOptions {
  titulo: string;
  nomeEstoque: string;
  itens: EstoqueItem[];
  incluirEstatisticas?: boolean;
}

export const exportarExcel = ({
  titulo,
  nomeEstoque,
  itens,
  incluirEstatisticas = true
}: ExportOptions) => {
  // Criar workbook
  const workbook = XLSX.utils.book_new();

  // Preparar dados organizados
  const dadosOrganizados = itens.map(item => ({
    'Código de Barras': item.codigoBarras,
    'Nome do Item': item.nome,
    'Categoria': item.categoria || '',
    'Subcategoria': item.subcategoria || '',
    'Marca': item.marca || '',
    'Especificação': item.especificacao || '',
    'Localização': item.localizacao || '',
    'Caixa/Organizador': item.caixaOrganizador || '',
    'Origem': item.origem || '',
    'Responsável': item.responsavel || '',
    'Estoque Atual': item.estoqueAtual,
    'Quantidade Mínima': item.quantidadeMinima || '',
    'Unidade': item.unidade,
    'Condição': item.condicao,
    'Tipo de Serviço': item.tipoServico || '',
    'Sub Destino': item.subDestino || '',
    'Metragem': item.metragem || '',
    'Peso (kg)': item.peso || '',
    'Comprimento Lixa': item.comprimentoLixa || '',
    'Polaridade Disjuntor': item.polaridadeDisjuntor || '',
    'Data de Cadastro': item.dataCriacao ? new Date(item.dataCriacao).toLocaleDateString('pt-BR') : '',
    'Última Movimentação': item.ultimaMovimentacao ? 
      new Date(item.ultimaMovimentacao.dataHora).toLocaleDateString('pt-BR') + ' ' + 
      new Date(item.ultimaMovimentacao.dataHora).toLocaleTimeString('pt-BR') : '',
    'Tipo Última Mov.': item.ultimaMovimentacao?.tipo || '',
    'Responsável Última Mov.': item.ultimaMovimentacao?.responsavel || '',
    'Status do Estoque': getStatusEstoque(item)
  }));

  // Criar aba principal com os dados
  const worksheet = XLSX.utils.json_to_sheet(dadosOrganizados);

  // Definir larguras das colunas para melhor visualização
  const columnWidths = [
    { wch: 15 }, // Código de Barras
    { wch: 30 }, // Nome do Item
    { wch: 15 }, // Categoria
    { wch: 15 }, // Subcategoria
    { wch: 15 }, // Marca
    { wch: 25 }, // Especificação
    { wch: 20 }, // Localização
    { wch: 20 }, // Caixa/Organizador
    { wch: 15 }, // Origem
    { wch: 15 }, // Responsável
    { wch: 12 }, // Estoque Atual
    { wch: 12 }, // Quantidade Mínima
    { wch: 10 }, // Unidade
    { wch: 10 }, // Condição
    { wch: 15 }, // Tipo de Serviço
    { wch: 15 }, // Sub Destino
    { wch: 10 }, // Metragem
    { wch: 10 }, // Peso
    { wch: 15 }, // Comprimento Lixa
    { wch: 15 }, // Polaridade Disjuntor
    { wch: 15 }, // Data de Cadastro
    { wch: 20 }, // Última Movimentação
    { wch: 15 }, // Tipo Última Mov
    { wch: 20 }, // Responsável Última Mov
    { wch: 15 }  // Status do Estoque
  ];

  worksheet['!cols'] = columnWidths;

  // Adicionar a aba principal
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Estoque Completo');

  // Se incluir estatísticas, criar aba de resumo
  if (incluirEstatisticas) {
    const totalItens = itens.length;
    const comEstoque = itens.filter(item => item.estoqueAtual > 0).length;
    const estoqueZero = itens.filter(item => item.estoqueAtual === 0).length;
    const estoqueBaixo = itens.filter(item => 
      item.quantidadeMinima && item.estoqueAtual <= item.quantidadeMinima
    ).length;

    // Estatísticas por categoria
    const estatisticasPorCategoria = itens.reduce((acc, item) => {
      const categoria = item.categoria || 'Sem Categoria';
      if (!acc[categoria]) {
        acc[categoria] = { total: 0, comEstoque: 0, semEstoque: 0 };
      }
      acc[categoria].total++;
      if (item.estoqueAtual > 0) {
        acc[categoria].comEstoque++;
      } else {
        acc[categoria].semEstoque++;
      }
      return acc;
    }, {} as Record<string, { total: number; comEstoque: number; semEstoque: number }>);

    // Dados do resumo
    const dadosResumo = [
      { 'Métrica': 'RESUMO GERAL', 'Valor': '', 'Observação': '' },
      { 'Métrica': 'Total de Itens', 'Valor': totalItens, 'Observação': 'Todos os itens cadastrados' },
      { 'Métrica': 'Itens com Estoque', 'Valor': comEstoque, 'Observação': 'Quantidade > 0' },
      { 'Métrica': 'Itens com Estoque Baixo', 'Valor': estoqueBaixo, 'Observação': 'Abaixo do mínimo' },
      { 'Métrica': 'Itens com Estoque Zerado', 'Valor': estoqueZero, 'Observação': 'Quantidade = 0' },
      { 'Métrica': '', 'Valor': '', 'Observação': '' },
      { 'Métrica': 'ESTATÍSTICAS POR CATEGORIA', 'Valor': '', 'Observação': '' },
      ...Object.entries(estatisticasPorCategoria).map(([categoria, stats]) => ({
        'Métrica': categoria,
        'Valor': `${stats.total} itens`,
        'Observação': `${stats.comEstoque} com estoque, ${stats.semEstoque} zerados`
      }))
    ];

    const worksheetResumo = XLSX.utils.json_to_sheet(dadosResumo);
    worksheetResumo['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 40 }];
    
    XLSX.utils.book_append_sheet(workbook, worksheetResumo, 'Resumo e Estatísticas');
  }

  // Criar aba com itens organizados por categoria
  const itensPorCategoria = itens.reduce((acc, item) => {
    const categoria = item.categoria || 'Sem Categoria';
    if (!acc[categoria]) {
      acc[categoria] = [];
    }
    acc[categoria].push(item);
    return acc;
  }, {} as Record<string, EstoqueItem[]>);

  // Criar dados organizados por categoria
  const dadosPorCategoria: any[] = [];
  
  Object.entries(itensPorCategoria).forEach(([categoria, itensCategoria]) => {
    // Adicionar cabeçalho da categoria
    dadosPorCategoria.push({
      'Item': `=== ${categoria.toUpperCase()} (${itensCategoria.length} itens) ===`,
      'Código': '',
      'Estoque': '',
      'Localização': '',
      'Condição': '',
      'Status': ''
    });
    
    // Adicionar itens da categoria
    itensCategoria.forEach(item => {
      dadosPorCategoria.push({
        'Item': item.nome,
        'Código': item.codigoBarras,
        'Estoque': `${item.estoqueAtual} ${item.unidade}`,
        'Localização': `${item.localizacao} ${item.caixaOrganizador ? '- ' + item.caixaOrganizador : ''}`.trim(),
        'Condição': item.condicao,
        'Status': getStatusEstoque(item)
      });
    });
    
    // Adicionar linha em branco
    dadosPorCategoria.push({
      'Item': '',
      'Código': '',
      'Estoque': '',
      'Localização': '',
      'Condição': '',
      'Status': ''
    });
  });

  const worksheetCategorias = XLSX.utils.json_to_sheet(dadosPorCategoria);
  worksheetCategorias['!cols'] = [
    { wch: 40 }, // Item
    { wch: 15 }, // Código
    { wch: 15 }, // Estoque
    { wch: 30 }, // Localização
    { wch: 10 }, // Condição
    { wch: 15 }  // Status
  ];
  
  XLSX.utils.book_append_sheet(workbook, worksheetCategorias, 'Por Categoria');

  // Gerar e baixar arquivo
  const nomeArquivo = `estoque-${nomeEstoque.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, nomeArquivo);
};

const getStatusEstoque = (item: EstoqueItem): string => {
  if (item.estoqueAtual === 0) return 'ZERADO';
  if (item.quantidadeMinima && item.estoqueAtual <= item.quantidadeMinima) return 'BAIXO';
  return 'OK';
};