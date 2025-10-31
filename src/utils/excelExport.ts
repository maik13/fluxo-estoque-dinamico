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
    'Valor': item.valor || '',
    'Data de Cadastro': item.dataCriacao ? new Date(item.dataCriacao).toLocaleDateString('pt-BR') : '',
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
    { wch: 15 }, // Data de Cadastro
    { wch: 20 }, // Última Movimentação
    { wch: 15 }, // Tipo Última Mov
    { wch: 15 }  // Status do Estoque
  ];

  worksheet['!cols'] = columnWidths;

  // Adicionar a aba principal
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Estoque Completo');

  // Se incluir estatísticas, criar aba de resumo
  if (incluirEstatisticas) {
    // Estatísticas gerais
    const totalItens = itens.length;
    const comEstoque = itens.filter(item => item.estoqueAtual > 0).length;
    const estoqueZero = itens.filter(item => item.estoqueAtual === 0).length;
    const estoqueBaixo = itens.filter(item => 
      item.quantidadeMinima && item.estoqueAtual <= item.quantidadeMinima
    ).length;

    // Dados do resumo
    const dadosResumo = [
      { 'Métrica': 'RESUMO GERAL', 'Valor': '', 'Observação': '' },
      { 'Métrica': 'Total de Itens', 'Valor': totalItens, 'Observação': 'Todos os itens cadastrados' },
      { 'Métrica': 'Itens com Estoque', 'Valor': comEstoque, 'Observação': 'Quantidade > 0' },
      { 'Métrica': 'Itens com Estoque Baixo', 'Valor': estoqueBaixo, 'Observação': 'Abaixo do mínimo' },
      { 'Métrica': 'Itens com Estoque Zerado', 'Valor': estoqueZero, 'Observação': 'Quantidade = 0' }
    ];

    const worksheetResumo = XLSX.utils.json_to_sheet(dadosResumo);
    worksheetResumo['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 40 }];
    
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