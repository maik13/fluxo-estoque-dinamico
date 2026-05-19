import { EstoqueItem } from '@/types/estoque';

const formatarClassificacao = (item: EstoqueItem): string => {
  const partes = [];
  if (item.especificacao) partes.push(item.especificacao);
  if (item.marca) partes.push(item.marca);
  if (item.unidade) partes.push(item.unidade);
  if (item.condicao) partes.push(item.condicao);
  
  if (partes.length === 0) return 'Sem classificação definida';
  return partes.join(' • ');
};

export const imprimirRelatorioContado = (
  itens: EstoqueItem[],
  filtroTexto: string,
  nomeEstoque: string,
  alocacoes: Record<string, { alocada: boolean; saldoPendente: number; localAtual?: string }>
) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  // 1. Calcular resumo geral
  let noAlmoxarifadoGeral = 0;
  let emUsoProjetoGeral = 0;
  let semSaldoGeral = 0;

  itens.forEach(item => {
    const isAlocado = alocacoes[item.id]?.alocada;
    if (isAlocado) {
      emUsoProjetoGeral++;
    } else if (item.estoqueAtual > 0) {
      noAlmoxarifadoGeral++;
    } else {
      semSaldoGeral++;
    }
  });

  const totalCodigosGeral = itens.length;

  // 2. Agrupar e ordenar itens por nome
  const agrupadoPorNome = new Map<string, EstoqueItem[]>();
  const itensOrdenados = [...itens].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  
  itensOrdenados.forEach(item => {
    const key = item.nome || 'Sem Nome';
    if (!agrupadoPorNome.has(key)) agrupadoPorNome.set(key, []);
    agrupadoPorNome.get(key)!.push(item);
  });

  // Gerar linhas da tabela executiva
  const linhasTabelaExecutiva = Array.from(agrupadoPorNome.entries()).map(([nome, itensDoNome]) => {
    let noAlmoxarifado = 0;
    let emUsoProjeto = 0;
    let semSaldo = 0;

    itensDoNome.forEach(item => {
      const isAlocado = alocacoes[item.id]?.alocada;
      if (isAlocado) {
        emUsoProjeto++;
      } else if (item.estoqueAtual > 0) {
        noAlmoxarifado++;
      } else {
        semSaldo++;
      }
    });

    return `
      <tr>
        <td style="font-weight: bold;">${nome}</td>
        <td style="text-align: center;">${itensDoNome.length}</td>
        <td style="text-align: center; color: #2e7d32;">${noAlmoxarifado}</td>
        <td style="text-align: center; color: #f57c00;">${emUsoProjeto}</td>
        <td style="text-align: center; color: #c62828;">${semSaldo}</td>
      </tr>
    `;
  }).join('');

  // Gerar detalhamento por item
  const detalhamentoItens = Array.from(agrupadoPorNome.entries()).map(([nome, itensDoNome]) => {
    // Agrupar por classificação
    const agrupadoPorClassificacao = new Map<string, EstoqueItem[]>();
    itensDoNome.forEach(item => {
      const classificacao = formatarClassificacao(item);
      if (!agrupadoPorClassificacao.has(classificacao)) agrupadoPorClassificacao.set(classificacao, []);
      agrupadoPorClassificacao.get(classificacao)!.push(item);
    });

    const classificacoesOrdenadas = Array.from(agrupadoPorClassificacao.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    const htmlClassificacoes = classificacoesOrdenadas.map(([classificacao, itensDaClassificacao]) => {
      let noAlmoxarifadoClass = 0;
      let emUsoProjetoClass = 0;
      let semSaldoClass = 0;

      itensDaClassificacao.forEach(item => {
        const isAlocado = alocacoes[item.id]?.alocada;
        if (isAlocado) {
          emUsoProjetoClass++;
        } else if (item.estoqueAtual > 0) {
          noAlmoxarifadoClass++;
        } else {
          semSaldoClass++;
        }
      });

      const itensOrdenadosPorCodigo = [...itensDaClassificacao].sort((a, b) => 
        (a.codigoBarras || '').localeCompare(b.codigoBarras || '')
      );

      const linhasTabelaCodigos = itensOrdenadosPorCodigo.map(item => {
        const isAlocado = alocacoes[item.id]?.alocada;
        let status = '';
        let saldoText = '';
        let projetoLocal = '-';
        
        if (isAlocado) {
          status = 'Em uso/projeto';
          saldoText = `Pendente: ${alocacoes[item.id]?.saldoPendente}`;
          projetoLocal = alocacoes[item.id]?.localAtual || "Local não identificado";
        } else if (item.estoqueAtual > 0) {
          status = 'No almoxarifado';
          saldoText = item.estoqueAtual.toString();
        } else {
          status = 'Sem saldo';
          saldoText = '0';
        }

        const localizacaoAlmox = [item.localizacao, item.caixaOrganizador].filter(Boolean).join(' - ') || '-';

        return `
          <tr>
            <td style="font-family: monospace; font-size: 11px;">${item.codigoBarras}</td>
            <td>${item.marca || '-'}</td>
            <td>${item.especificacao || '-'}</td>
            <td>${status}</td>
            <td>${localizacaoAlmox}</td>
            <td>${projetoLocal}</td>
            <td style="text-align: right; font-weight: bold;">${saldoText}</td>
          </tr>
        `;
      }).join('');

      return `
        <div class="classificacao-block" style="margin-top: 15px; margin-bottom: 20px; page-break-inside: avoid;">
          <div style="background-color: #f5f5f5; padding: 8px 12px; border-radius: 4px; font-weight: 600; font-size: 13px; display: flex; justify-content: space-between; align-items: center;">
            <span>Classificação: ${classificacao}</span>
            <span style="font-size: 11px; font-weight: normal;">
              Códigos: <strong>${itensDaClassificacao.length}</strong> | 
              Almoxarifado: <strong style="color: #2e7d32;">${noAlmoxarifadoClass}</strong> | 
              Em uso: <strong style="color: #f57c00;">${emUsoProjetoClass}</strong> | 
              Sem saldo: <strong style="color: #c62828;">${semSaldoClass}</strong>
            </span>
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px;">
            <thead>
              <tr style="background-color: #fafafa;">
                <th style="width: 15%;">Código</th>
                <th style="width: 12%;">Marca</th>
                <th style="width: 20%;">Especificação</th>
                <th style="width: 15%;">Status</th>
                <th style="width: 18%;">Localização almox.</th>
                <th style="width: 12%;">Projeto/Local</th>
                <th style="width: 8%; text-align: right;">Saldo</th>
              </tr>
            </thead>
            <tbody>
              ${linhasTabelaCodigos}
            </tbody>
          </table>
        </div>
      `;
    }).join('');

    return `
      <div class="item-block" style="margin-top: 25px; border-bottom: 2px solid #eaeaea; padding-bottom: 15px; page-break-inside: avoid;">
        <h2 style="color: #1a5276; font-size: 18px; margin-bottom: 5px; margin-top: 0; text-transform: uppercase;">${nome}</h2>
        ${htmlClassificacoes}
      </div>
    `;
  }).join('');

  const filtroTextoInfo = filtroTexto ? `<div class="filtro-info"><strong>Filtro aplicado:</strong> Busca por "${filtroTexto}"</div>` : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Relatório de Estoque Contado</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 25px; color: #333; line-height: 1.4; background-color: #fff; }
        h1 { color: #1a5276; font-size: 24px; margin-bottom: 5px; margin-top: 0; font-weight: 700; text-align: center; }
        .subtitle { text-align: center; font-size: 14px; color: #555; margin-bottom: 20px; font-weight: 500; }
        .meta-info { display: flex; justify-content: space-between; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 20px; font-size: 12px; color: #666; }
        .filtro-info { background-color: #fff8e1; border-left: 4px solid #ffb300; padding: 8px 12px; margin-bottom: 20px; font-size: 12px; border-radius: 0 4px 4px 0; }
        
        /* Cards de resumo */
        .resumo-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; }
        .resumo-card { border: 1px solid #ddd; border-radius: 6px; padding: 12px; text-align: center; background-color: #fff; }
        .resumo-val { font-size: 20px; font-weight: bold; margin-top: 4px; }
        .resumo-lbl { font-size: 10px; text-transform: uppercase; color: #666; letter-spacing: 0.5px; }
        
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #e0e0e0; padding: 6px 10px; text-align: left; }
        th { background-color: #f1f5f9; color: #334155; font-weight: 600; font-size: 11px; }
        tr:nth-child(even) { background-color: #f8fafc; }
        
        .footer { margin-top: 40px; text-align: center; color: #888; font-size: 10px; border-top: 1px solid #eee; padding-top: 10px; }
        
        @media print {
          body { padding: 0; font-size: 12px; }
          .item-block { page-break-inside: avoid; }
          .classificacao-block { page-break-inside: avoid; }
          .no-print { display: none; }
          @page { margin: 1.5cm; }
        }
      </style>
    </head>
    <body>
      <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
        <span style="font-weight: bold; font-size: 18px; color: #1a5276; margin-right: 8px;">Bambusa</span>
        <span style="color: #888; font-size: 14px;">| Gestão de Estoque</span>
      </div>
      <h1>RELATÓRIO DE ESTOQUE CONTADO</h1>
      <div class="subtitle">Visão Executiva e Detalhada dos Itens de Estoque</div>
      
      <div class="meta-info">
        <div><strong>Almoxarifado Ativo:</strong> ${nomeEstoque || 'Geral'}</div>
        <div><strong>Emissão:</strong> ${new Date().toLocaleString('pt-BR')}</div>
        <div><strong>Itens Considerados:</strong> ${totalCodigosGeral}</div>
      </div>

      ${filtroTextoInfo}

      <!-- Resumo Geral -->
      <h3 style="margin-top: 0; border-bottom: 1px solid #1a5276; color: #1a5276; font-size: 14px; padding-bottom: 4px; text-transform: uppercase;">Resumo Geral</h3>
      <div class="resumo-grid">
        <div class="resumo-card">
          <div class="resumo-lbl">Cadastrados</div>
          <div class="resumo-val">${totalCodigosGeral}</div>
        </div>
        <div class="resumo-card" style="border-left: 4px solid #2e7d32;">
          <div class="resumo-lbl" style="color: #2e7d32;">No Almoxarifado</div>
          <div class="resumo-val" style="color: #2e7d32;">${noAlmoxarifadoGeral}</div>
        </div>
        <div class="resumo-card" style="border-left: 4px solid #f57c00;">
          <div class="resumo-lbl" style="color: #f57c00;">Em Uso / Projeto</div>
          <div class="resumo-val" style="color: #f57c00;">${emUsoProjetoGeral}</div>
        </div>
        <div class="resumo-card" style="border-left: 4px solid #c62828;">
          <div class="resumo-lbl" style="color: #c62828;">Sem Saldo</div>
          <div class="resumo-val" style="color: #c62828;">${semSaldoGeral}</div>
        </div>
      </div>

      <!-- Tabela Executiva -->
      <h3 style="margin-top: 25px; border-bottom: 1px solid #1a5276; color: #1a5276; font-size: 14px; padding-bottom: 4px; text-transform: uppercase;">Tabela Executiva por Item</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px;">
        <thead>
          <tr>
            <th>Item</th>
            <th style="width: 15%; text-align: center;">Códigos Cadastrados</th>
            <th style="width: 18%; text-align: center;">No Almoxarifado</th>
            <th style="width: 18%; text-align: center;">Em Uso / Projeto</th>
            <th style="width: 15%; text-align: center;">Sem Saldo</th>
          </tr>
        </thead>
        <tbody>
          ${linhasTabelaExecutiva}
        </tbody>
      </table>

      <!-- Detalhamento por Item -->
      <div style="page-break-before: always;">
        <h3 style="border-bottom: 1px solid #1a5276; color: #1a5276; font-size: 14px; padding-bottom: 4px; text-transform: uppercase; margin-bottom: 15px;">Detalhamento de Códigos</h3>
        ${detalhamentoItens}
      </div>

      <div class="footer">
        Relatório de Estoque Contado — Bambusa Almoxarifado Inteligente. Gerado em ${new Date().toLocaleString('pt-BR')}.
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.print();
};
