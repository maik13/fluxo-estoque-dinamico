import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DadosEstoqueContado, GrupoItemEstoqueContado } from '@/hooks/useEstoqueContado';

const dataArquivo = () => new Date().toISOString().split('T')[0];

const nomeArquivoSeguro = (nome: string) =>
  nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'estoque';

const nomeArquivoRelatorioContado = (nomeEstoque: string) =>
  `relatorio-estoque-contado-${nomeArquivoSeguro(nomeEstoque)}-${dataArquivo()}.pdf`;

const adicionarRodape = (doc: jsPDF) => {
  const pageCount = (doc as any).internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Pagina ${page} de ${pageCount} | Sistema de Gestao de Estoque`, pageWidth / 2, pageHeight - 8, {
      align: 'center',
    });
  }
};

const adicionarResumoItem = (doc: jsPDF, grupo: GrupoItemEstoqueContado, y: number) => {
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(grupo.nome.toUpperCase(), 14, y);

  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(
    `Codigos cadastrados: ${grupo.totais.codigosCadastrados} | No almoxarifado: ${grupo.totais.noAlmoxarifado} | Em uso/projeto: ${grupo.totais.emUsoProjeto} | Sem saldo: ${grupo.totais.semSaldo}`,
    14,
    y + 5
  );
};

const criarDocumentoContado = (
  dados: DadosEstoqueContado,
  filtroTexto: string,
  nomeEstoque: string
) => {
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.width;
  let yPosition = 16;

  doc.setFontSize(18);
  doc.setTextColor(41, 128, 185);
  doc.text('RELATORIO DE ESTOQUE CONTADO', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Estoque: ${nomeEstoque || 'Estoque Atual'}`, 14, yPosition);
  doc.text(`Data/hora: ${new Date().toLocaleString('pt-BR')}`, pageWidth - 14, yPosition, { align: 'right' });
  yPosition += 6;

  if (filtroTexto.trim()) {
    doc.setTextColor(80, 80, 80);
    doc.text(`Filtro aplicado: ${filtroTexto.trim()}`, 14, yPosition);
    yPosition += 6;
  }

  autoTable(doc, {
    startY: yPosition,
    head: [['Indicador', 'Quantidade']],
    body: [
      ['Codigos cadastrados', dados.totais.codigosCadastrados],
      ['No almoxarifado', dados.totais.noAlmoxarifado],
      ['Em uso/projeto', dados.totais.emUsoProjeto],
      ['Sem saldo', dados.totais.semSaldo],
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [41, 128, 185], textColor: [255, 255, 255] },
    margin: { left: 14, right: 14 },
    tableWidth: 100,
  });

  yPosition = ((doc as any).lastAutoTable?.finalY || yPosition) + 10;

  autoTable(doc, {
    startY: yPosition,
    head: [['Item', 'Codigos', 'No almoxarifado', 'Em uso/projeto', 'Sem saldo']],
    body: dados.grupos.map((grupo) => [
      grupo.nome,
      grupo.totais.codigosCadastrados,
      grupo.totais.noAlmoxarifado,
      grupo.totais.emUsoProjeto,
      grupo.totais.semSaldo,
    ]),
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 2, lineColor: [210, 210, 210], lineWidth: 0.1 },
    headStyles: { fillColor: [41, 128, 185], textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 130 },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
    },
    margin: { left: 14, right: 14 },
  });

  dados.grupos.forEach((grupo) => {
    doc.addPage();
    yPosition = 16;
    adicionarResumoItem(doc, grupo, yPosition);
    yPosition += 10;

    grupo.classificacoes.forEach((classificacao) => {
      const linhas = classificacao.linhas.map((linha) => [
        String(linha.codigo),
        linha.marca,
        linha.especificacao,
        linha.localizacaoAlmox,
        linha.status,
        linha.projetoLocalUso,
        linha.saldo,
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [[
          `${classificacao.classificacao} | Codigos: ${classificacao.totais.codigosCadastrados} | No almoxarifado: ${classificacao.totais.noAlmoxarifado} | Em uso/projeto: ${classificacao.totais.emUsoProjeto} | Sem saldo: ${classificacao.totais.semSaldo}`,
          '',
          '',
          '',
          '',
          '',
          '',
        ]],
        body: [
          ['Codigo', 'Marca', 'Especificacao', 'Localizacao almox.', 'Status', 'Projeto/Local de uso', 'Saldo'],
          ...linhas,
        ],
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.5, lineColor: [215, 215, 215], lineWidth: 0.1 },
        headStyles: { fillColor: [235, 240, 245], textColor: [20, 20, 20], fontStyle: 'bold' },
        bodyStyles: { textColor: [30, 30, 30] },
        didParseCell: (data) => {
          if (data.row.index === 0 && data.section === 'body') {
            data.cell.styles.fillColor = [245, 245, 245];
            data.cell.styles.fontStyle = 'bold';
          }
        },
        columnStyles: {
          0: { cellWidth: 28 },
          1: { cellWidth: 30 },
          2: { cellWidth: 58 },
          3: { cellWidth: 45 },
          4: { cellWidth: 32 },
          5: { cellWidth: 48 },
          6: { cellWidth: 28, halign: 'right' },
        },
        margin: { left: 14, right: 14 },
      });

      yPosition = ((doc as any).lastAutoTable?.finalY || yPosition) + 7;

      if (yPosition > 180) {
        doc.addPage();
        yPosition = 16;
      }
    });
  });

  adicionarRodape(doc);
  return doc;
};

const escaparHtml = (valor: unknown) =>
  String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const criarHtmlRelatorioContado = (
  dados: DadosEstoqueContado,
  filtroTexto: string,
  nomeEstoque: string
) => {
  const resumoItens = dados.grupos.map((grupo) => `
    <tr>
      <td>${escaparHtml(grupo.nome)}</td>
      <td>${grupo.totais.codigosCadastrados}</td>
      <td>${grupo.totais.noAlmoxarifado}</td>
      <td>${grupo.totais.emUsoProjeto}</td>
      <td>${grupo.totais.semSaldo}</td>
    </tr>
  `).join('');

  const detalhamento = dados.grupos.map((grupo) => `
    <section class="item">
      <h2>${escaparHtml(grupo.nome)}</h2>
      <p class="summary">
        Códigos cadastrados: <strong>${grupo.totais.codigosCadastrados}</strong> |
        No almoxarifado: <strong>${grupo.totais.noAlmoxarifado}</strong> |
        Em uso/projeto: <strong>${grupo.totais.emUsoProjeto}</strong> |
        Sem saldo: <strong>${grupo.totais.semSaldo}</strong>
      </p>
      ${grupo.classificacoes.map((classificacao) => `
        <div class="classificacao">
          <h3>${escaparHtml(classificacao.classificacao)}</h3>
          <p class="summary">
            Códigos: <strong>${classificacao.totais.codigosCadastrados}</strong> |
            No almoxarifado: <strong>${classificacao.totais.noAlmoxarifado}</strong> |
            Em uso/projeto: <strong>${classificacao.totais.emUsoProjeto}</strong> |
            Sem saldo: <strong>${classificacao.totais.semSaldo}</strong>
          </p>
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Marca</th>
                <th>Especificação</th>
                <th>Localização almox.</th>
                <th>Status</th>
                <th>Projeto/Local de uso</th>
                <th class="num">Saldo</th>
              </tr>
            </thead>
            <tbody>
              ${classificacao.linhas.map((linha) => `
                <tr>
                  <td class="mono">${escaparHtml(linha.codigo)}</td>
                  <td>${escaparHtml(linha.marca)}</td>
                  <td>${escaparHtml(linha.especificacao)}</td>
                  <td>${escaparHtml(linha.localizacaoAlmox)}</td>
                  <td>${escaparHtml(linha.status)}</td>
                  <td>${escaparHtml(linha.projetoLocalUso)}</td>
                  <td class="num">${escaparHtml(linha.saldo)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('')}
    </section>
  `).join('');

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Relatório de Estoque Contado</title>
        <style>
          body { color: #111827; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.35; margin: 24px; background: #fff; }
          .toolbar { align-items: center; background: #111827; color: #fff; display: flex; gap: 8px; justify-content: space-between; left: 0; padding: 10px 16px; position: sticky; right: 0; top: 0; z-index: 10; }
          .toolbar button { background: #22c55e; border: 0; border-radius: 4px; color: #fff; cursor: pointer; font-weight: 700; padding: 8px 12px; }
          .toolbar button.secondary { background: #374151; }
          h1 { color: #111827; font-size: 22px; margin: 24px 0 8px; text-align: center; }
          h2 { border-top: 1px solid #d1d5db; font-size: 15px; margin: 24px 0 4px; padding-top: 12px; text-transform: uppercase; }
          h3 { color: #374151; font-size: 12px; margin: 14px 0 4px; text-transform: uppercase; }
          .meta { border-bottom: 1px solid #d1d5db; display: flex; justify-content: space-between; margin-bottom: 14px; padding-bottom: 8px; }
          .filter { background: #f9fafb; border: 1px solid #d1d5db; border-radius: 4px; display: inline-block; margin-bottom: 14px; padding: 6px 8px; }
          .cards { display: grid; gap: 8px; grid-template-columns: repeat(4, 1fr); margin: 14px 0; }
          .card { border: 1px solid #d1d5db; border-radius: 4px; padding: 8px; text-align: center; }
          .card strong { display: block; font-size: 18px; }
          table { border-collapse: collapse; margin: 8px 0 14px; width: 100%; }
          th, td { border: 1px solid #d1d5db; padding: 5px 6px; text-align: left; vertical-align: top; }
          th { background: #f3f4f6; font-size: 11px; }
          .summary { color: #4b5563; margin: 0 0 8px; }
          .mono { font-family: Consolas, monospace; }
          .num { text-align: right; }
          .item, .classificacao { break-inside: avoid; }
          @media print {
            body { margin: 12mm; }
            .toolbar { display: none; }
            h1 { margin-top: 0; }
            @page { margin: 12mm; }
          }
        </style>
      </head>
      <body>
        <div class="toolbar">
          <span>Relatório contado pronto para impressão</span>
          <div>
            <button class="secondary" onclick="history.back()">Voltar</button>
            <button onclick="window.print()">Imprimir</button>
          </div>
        </div>

        <h1>RELATÓRIO DE ESTOQUE CONTADO</h1>
        <div class="meta">
          <span><strong>Estoque:</strong> ${escaparHtml(nomeEstoque || 'Estoque Atual')}</span>
          <span><strong>Data/hora:</strong> ${escaparHtml(new Date().toLocaleString('pt-BR'))}</span>
        </div>
        ${filtroTexto.trim() ? `<div class="filter"><strong>Filtro aplicado:</strong> ${escaparHtml(filtroTexto.trim())}</div>` : ''}

        <div class="cards">
          <div class="card">Códigos cadastrados<strong>${dados.totais.codigosCadastrados}</strong></div>
          <div class="card">No almoxarifado<strong>${dados.totais.noAlmoxarifado}</strong></div>
          <div class="card">Em uso/projeto<strong>${dados.totais.emUsoProjeto}</strong></div>
          <div class="card">Sem saldo<strong>${dados.totais.semSaldo}</strong></div>
        </div>

        <h2>Tabela executiva</h2>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Códigos</th>
              <th>No almoxarifado</th>
              <th>Em uso/projeto</th>
              <th>Sem saldo</th>
            </tr>
          </thead>
          <tbody>${resumoItens}</tbody>
        </table>

        <h2>Detalhamento por item</h2>
        ${detalhamento}
      </body>
    </html>
  `;
};

const visualizarHtmlNaAbaAtual = (html: string) => {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.location.assign(url);
};

export const exportarPDFContado = (
  dados: DadosEstoqueContado,
  filtroTexto: string,
  nomeEstoque: string
) => {
  const doc = criarDocumentoContado(dados, filtroTexto, nomeEstoque);
  doc.save(nomeArquivoRelatorioContado(nomeEstoque));
};

export const imprimirRelatorioContado = (
  dados: DadosEstoqueContado,
  filtroTexto: string,
  nomeEstoque: string
) => {
  visualizarHtmlNaAbaAtual(criarHtmlRelatorioContado(dados, filtroTexto, nomeEstoque));
};
