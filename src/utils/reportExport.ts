import * as XLSX from 'xlsx';
import { GrupoAgrupado, ItemAgrupado } from '@/hooks/useConsolidacao';

/**
 * Função para exportar o resumo macro dos grupos para Excel
 */
export const exportarResumoGruposExcel = (grupos: GrupoAgrupado[], filtrosDescricao: string) => {
  const workbook = XLSX.utils.book_new();
  
  const dados = grupos.map(g => ({
    'Grupo': g.nome,
    'Total Saída': g.totalSaida,
    'Total Devolvido': g.totalDevolvido,
    'Saldo em Campo': g.saldo,
    'Aproveitamento (%)': g.totalSaida > 0 ? Math.round((g.totalDevolvido / g.totalSaida) * 100) : 100,
    'Qtd Itens': g.quantidadeItens,
    'Status': g.status
  }));

  const worksheet = XLSX.utils.json_to_sheet(dados);
  
  // Ajuste de largura de colunas
  worksheet['!cols'] = [
    { wch: 30 }, // Grupo
    { wch: 15 }, // Total Saída
    { wch: 15 }, // Total Devolvido
    { wch: 15 }, // Saldo
    { wch: 18 }, // Aproveitamento
    { wch: 10 }, // Qtd Itens
    { wch: 12 }, // Status
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Resumo Grupos');

  // Adicionar aba de filtros/contexto
  const infoData = [
    ['RELATÓRIO GERENCIAL - RESUMO POR GRUPO'],
    ['Gerado em:', new Date().toLocaleString('pt-BR')],
    ['Filtros aplicados:', filtrosDescricao],
  ];
  const infoSheet = XLSX.utils.aoa_to_sheet(infoData);
  XLSX.utils.book_append_sheet(workbook, infoSheet, 'Informações');

  const nomeArquivo = `resumo-gerencial-${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, nomeArquivo);
};

/**
 * Função para exportar os itens detalhados de um grupo específico para Excel
 */
export const exportarItensGrupoExcel = (grupoNome: string, itens: ItemAgrupado[], filtrosDescricao: string) => {
  const workbook = XLSX.utils.book_new();

  const dados = itens.map(item => ({
    'Item': item.itemSnapshot?.nome || 'Item Desconhecido',
    'Código': item.itemSnapshot?.codigoBarras || '-',
    'Tipo': item.itemSnapshot?.tipoItem || '-',
    'Total Saída': item.totalSaida,
    'Total Devolvido': item.totalDevolvido,
    'Saldo': item.pendente,
    'Status': item.statusItem === 'devolvido' ? 'Devolvido' : (item.statusItem === 'parcial' ? 'Parcial' : 'Pendente'),
    'Última Saída': item.ultimaSaida ? new Date(item.ultimaSaida).toLocaleDateString('pt-BR') : '-',
    'Último Destinatário': item.destinatario || '-'
  }));

  const worksheet = XLSX.utils.json_to_sheet(dados);

  // Ajuste de largura de colunas
  worksheet['!cols'] = [
    { wch: 40 }, // Item
    { wch: 15 }, // Código
    { wch: 15 }, // Tipo
    { wch: 12 }, // Total Saída
    { wch: 12 }, // Total Devolvido
    { wch: 12 }, // Saldo
    { wch: 12 }, // Status
    { wch: 15 }, // Última Saída
    { wch: 25 }, // Destinatário
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Itens do Grupo');

  // Adicionar aba de informações
  const infoData = [
    ['DETALHAMENTO DE GRUPO'],
    ['Grupo:', grupoNome],
    ['Gerado em:', new Date().toLocaleString('pt-BR')],
    ['Filtros aplicados:', filtrosDescricao],
  ];
  const infoSheet = XLSX.utils.aoa_to_sheet(infoData);
  XLSX.utils.book_append_sheet(workbook, infoSheet, 'Informações');

  const nomeArquivo = `detalhe-grupo-${grupoNome.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, nomeArquivo);
};
