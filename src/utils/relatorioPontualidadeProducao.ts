import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { PontualidadeMSPPeca, ResumoPontualidadeMSP, SituacaoPontualidadeMSP } from '@/hooks/usePontualidadeMSPNatal2026';

const dataArquivo = () => new Date().toISOString().slice(0, 10);

const dataPt = (data: string | null) => {
  if (!data) return 'Sem apontamento';
  const [ano, mes, dia] = data.split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data;
};

const situacaoTexto: Record<SituacaoPontualidadeMSP, string> = {
  antecipado: 'Antecipado',
  iniciado_no_prazo: 'No prazo',
  iniciado_atrasado: 'Iniciado após o previsto',
  atrasado_para_iniciar: 'Atrasado para iniciar',
  aguardando_inicio: 'Aguardando início',
};

const variacaoTexto = (peca: PontualidadeMSPPeca) => {
  if (peca.situacao === 'antecipado') return `${Math.abs(peca.diferencaDias)} dia(s) antes`;
  if (peca.situacao === 'iniciado_atrasado') return `${peca.diferencaDias} dia(s) após`;
  if (peca.situacao === 'atrasado_para_iniciar') return `${peca.diferencaDias} dia(s) sem início`;
  return '—';
};

const linhas = (resumo: ResumoPontualidadeMSP) => resumo.pecas.map((peca) => ({
  'Peça / projeto': peca.projetoNome,
  Cidade: peca.cidade ?? '',
  'OPs programadas': peca.opsImportadas,
  'Início previsto': dataPt(peca.inicioPlanejado),
  'Primeiro apontamento': dataPt(peca.primeiroApontamento),
  Situação: situacaoTexto[peca.situacao],
  Variação: variacaoTexto(peca),
}));

const resumoLinhas = (resumo: ResumoPontualidadeMSP) => [
  ['Relatório de pontualidade da produção'],
  [`Gerado em ${new Date().toLocaleString('pt-BR')}`],
  [],
  ['Peças programadas', resumo.total],
  ['Antecipadas', resumo.antecipados],
  ['Início no prazo', resumo.noPrazo],
  ['Iniciadas após o previsto', resumo.iniciadosAtrasados],
  ['Atrasadas para iniciar', resumo.atrasadosParaIniciar],
  ['Aguardando início', resumo.aguardandoInicio],
  [],
  ['Critério', 'Primeiro início previsto das OPs da peça comparado ao primeiro apontamento válido. Dias corridos.'],
];

export const exportarRelatorioPontualidadeExcel = (resumo: ResumoPontualidadeMSP) => {
  const workbook = XLSX.utils.book_new();
  const planilhaResumo = XLSX.utils.aoa_to_sheet(resumoLinhas(resumo));
  planilhaResumo['!cols'] = [{ wch: 30 }, { wch: 95 }];
  XLSX.utils.book_append_sheet(workbook, planilhaResumo, 'Resumo');

  const planilhaDetalhamento = XLSX.utils.json_to_sheet(linhas(resumo));
  planilhaDetalhamento['!cols'] = [
    { wch: 52 }, { wch: 18 }, { wch: 16 }, { wch: 17 }, { wch: 22 }, { wch: 28 }, { wch: 19 },
  ];
  XLSX.utils.book_append_sheet(workbook, planilhaDetalhamento, 'Pontualidade por peça');
  XLSX.writeFile(workbook, `relatorio-pontualidade-producao-${dataArquivo()}.xlsx`);
};

export const exportarRelatorioPontualidadePdf = (resumo: ResumoPontualidadeMSP) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  doc.setFontSize(16);
  doc.text('Relatório de pontualidade da produção', 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(85);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 21);
  doc.text('Critério: início previsto da peça comparado ao primeiro apontamento válido. Dias corridos.', 14, 26);

  const indicadores = [
    `Peças programadas: ${resumo.total}`,
    `Antecipadas: ${resumo.antecipados}`,
    `No prazo: ${resumo.noPrazo}`,
    `Com atraso: ${resumo.iniciadosAtrasados + resumo.atrasadosParaIniciar}`,
    `Aguardando início: ${resumo.aguardandoInicio}`,
  ];
  doc.setFontSize(8.5);
  doc.setTextColor(25);
  doc.text(indicadores.join('     '), 14, 33);

  autoTable(doc, {
    startY: 38,
    head: [['Peça / projeto', 'Cidade', 'OPs', 'Início previsto', 'Primeiro apontamento', 'Situação', 'Variação']],
    body: resumo.pecas.map((peca) => [
      peca.projetoNome,
      peca.cidade ?? '',
      String(peca.opsImportadas),
      dataPt(peca.inicioPlanejado),
      dataPt(peca.primeiroApontamento),
      situacaoTexto[peca.situacao],
      variacaoTexto(peca),
    ]),
    styles: { fontSize: 7.5, cellPadding: 2.1, valign: 'middle' },
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 65 }, 1: { cellWidth: 25 }, 2: { halign: 'center' }, 3: { cellWidth: 25 }, 4: { cellWidth: 30 }, 5: { cellWidth: 36 }, 6: { cellWidth: 25 } },
    didDrawPage: () => {
      const pagina = doc.getCurrentPageInfo().pageNumber;
      doc.setFontSize(7);
      doc.setTextColor(110);
      doc.text(`Página ${pagina}`, largura - 24, doc.internal.pageSize.getHeight() - 7);
    },
  });
  doc.save(`relatorio-pontualidade-producao-${dataArquivo()}.pdf`);
};
