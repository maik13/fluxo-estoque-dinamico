import jsPDF from 'jspdf';
import { format } from 'date-fns';
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
  iniciado_atrasado: 'Iniciado após o prazo',
  atrasado_para_iniciar: 'Atrasado para iniciar',
  em_risco: 'Possível atraso',
  aguardando_inicio: 'Aguardando início',
};

const variacaoTexto = (peca: PontualidadeMSPPeca) => {
  if (peca.situacao === 'antecipado') return `${Math.abs(peca.diferencaDias)} dia(s) antes`;
  if (peca.situacao === 'iniciado_atrasado') return `${peca.diferencaDias} dia(s) após`;
  if (peca.situacao === 'atrasado_para_iniciar') return `${peca.diferencaDias} dia(s) sem início`;
  if (peca.situacao === 'em_risco') return 'Sem apontamento no período';
  return '—';
};

const linhas = (resumo: ResumoPontualidadeMSP) => resumo.pecas.map((peca) => ({
  'Peça / projeto': peca.projetoNome,
  Cidade: peca.cidade ?? '',
  'OPs programadas': peca.opsImportadas,
  'Início previsto': dataPt(peca.inicioPlanejado),
  'Fim previsto': dataPt(peca.fimPlanejado),
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
  ['Iniciadas após o prazo', resumo.iniciadosAtrasados],
  ['Atrasadas para iniciar', resumo.atrasadosParaIniciar],
  ['Possível atraso', resumo.emRisco],
  ['Aguardando início', resumo.aguardandoInicio],
  [],
  ['Critério', 'Período programado pelas OPs da peça, confrontado com o primeiro apontamento registrado. Amarelo indica período em curso sem apontamento; vermelho, prazo final vencido. Dias corridos.'],
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

const corDaSituacao = (situacao: SituacaoPontualidadeMSP): [number, number, number] => {
  if (situacao === 'antecipado') return [37, 99, 235];
  if (situacao === 'iniciado_no_prazo') return [22, 163, 74];
  if (situacao === 'iniciado_atrasado' || situacao === 'atrasado_para_iniciar') return [220, 38, 38];
  if (situacao === 'em_risco') return [217, 119, 6];
  return [148, 163, 184];
};

const diferencaDias = (inicio: string, fim: string) => Math.round(
  (new Date(`${fim}T12:00:00`).getTime() - new Date(`${inicio}T12:00:00`).getTime()) / 86_400_000,
);

const dataHoje = () => format(new Date(), 'yyyy-MM-dd');

/** Gera o Gantt compacto em uma única folha A4 paisagem. */
export const exportarRelatorioPontualidadePdf = (resumo: ResumoPontualidadeMSP) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const margem = 7;
  const larguraNome = 80;
  const inicioGrade = margem + larguraNome;
  const fimGrade = largura - margem;
  const larguraGrade = fimGrade - inicioGrade;
  const hoje = dataHoje();
  const menorData = resumo.pecas.map((peca) => peca.inicioPlanejado).reduce((menor, data) => data < menor ? data : menor, hoje);
  const maiorData = resumo.pecas
    .flatMap((peca) => [peca.fimPlanejado, peca.primeiroApontamento ?? '', hoje])
    .reduce((maior, data) => data > maior ? data : maior, menorData);
  const totalDias = Math.max(1, diferencaDias(menorData, maiorData) + 1);
  const xDaData = (data: string) => inicioGrade + diferencaDias(menorData, data) / totalDias * larguraGrade;
  const larguraDaBarra = (inicio: string, fim: string) => Math.max(0.8, (diferencaDias(inicio, fim) + 1) / totalDias * larguraGrade);
  const yCabecalho = 37;
  const yLinhas = 46;
  const alturaDisponivel = altura - yLinhas - 7;
  const alturaLinha = Math.max(2.8, Math.min(5, alturaDisponivel / Math.max(1, resumo.pecas.length)));

  doc.setFontSize(16);
  doc.text('Gantt de pontualidade da produção', margem, 12);
  doc.setFontSize(8);
  doc.setTextColor(85);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, margem, 17);
  doc.text('Barra = período programado. Verde = no prazo, azul = antecipada, amarelo = possível atraso, vermelho = atrasada.', margem, 22);

  const indicadores = [
    `Peças programadas: ${resumo.total}`,
    `Antecipadas: ${resumo.antecipados}`,
    `No prazo: ${resumo.noPrazo}`,
    `Com atraso: ${resumo.iniciadosAtrasados + resumo.atrasadosParaIniciar}`,
    `Possível atraso: ${resumo.emRisco}`,
    `Aguardando início: ${resumo.aguardandoInicio}`,
  ];
  doc.setFontSize(7.5);
  doc.setTextColor(25);
  doc.text(indicadores.join('     '), margem, 28);

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.rect(margem, yCabecalho - 4, fimGrade - margem, 11, 'F');
  doc.setFontSize(6);
  doc.setTextColor(51, 65, 85);
  doc.text('Peça / projeto', margem + 1, yCabecalho);
  for (let indice = 0; indice < totalDias; indice += 1) {
    const data = new Date(`${menorData}T12:00:00`);
    data.setDate(data.getDate() + indice);
    const x = inicioGrade + indice / totalDias * larguraGrade;
    doc.setDrawColor(indice % 7 === 0 ? 148 : 226, indice % 7 === 0 ? 163 : 232, indice % 7 === 0 ? 184 : 240);
    doc.line(x, yCabecalho - 4, x, yLinhas + alturaLinha * resumo.pecas.length);
    if (indice % 7 === 0) {
      doc.setTextColor(71, 85, 105);
      doc.text(String(data.getDate()), x + 0.5, yCabecalho);
    }
  }
  doc.setTextColor(51, 65, 85);
  doc.text(`${dataPt(menorData)} a ${dataPt(maiorData)}`, inicioGrade, yCabecalho - 1.5);

  resumo.pecas.forEach((peca, indice) => {
    const y = yLinhas + indice * alturaLinha;
    doc.setDrawColor(226, 232, 240);
    doc.line(margem, y + alturaLinha, fimGrade, y + alturaLinha);
    doc.setFontSize(alturaLinha < 3.5 ? 4.5 : 5.5);
    doc.setTextColor(15, 23, 42);
    const nome = doc.splitTextToSize(peca.projetoNome, larguraNome - 3)[0] as string;
    doc.text(nome, margem + 1, y + alturaLinha * 0.62);
    const cor = corDaSituacao(peca.situacao);
    doc.setFillColor(...cor);
    doc.roundedRect(xDaData(peca.inicioPlanejado), y + alturaLinha * 0.24, larguraDaBarra(peca.inicioPlanejado, peca.fimPlanejado), Math.max(1.4, alturaLinha * 0.46), 0.4, 0.4, 'F');
  });
  if (hoje >= menorData && hoje <= maiorData) {
    const xHoje = xDaData(hoje);
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.5);
    doc.line(xHoje, yCabecalho - 4, xHoje, yLinhas + alturaLinha * resumo.pecas.length);
    doc.setFontSize(6);
    doc.text('Hoje', xHoje + 1, yCabecalho + 4);
  }
  doc.setFontSize(6);
  doc.setTextColor(100);
  doc.text('O PDF apresenta o Gantt compacto. As datas e o detalhamento continuam disponíveis no Excel.', margem, altura - 3);
  doc.save(`relatorio-pontualidade-producao-${dataArquivo()}.pdf`);
};
