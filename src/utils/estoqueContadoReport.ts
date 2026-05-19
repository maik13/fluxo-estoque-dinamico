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
    if (!mapaHasKeyIgnoreCase(agrupadoPorNome, key)) {
      agrupadoPorNome.set(key, []);
    }
    getMapKeyIgnoreCase(agrupadoPorNome, key).push(item);
  });

  // Helper functions for map key access
  function mapaHasKeyIgnoreCase(map: Map<string, any>, searchKey: string) {
    for (const key of map.keys()) {
      if (key.toLowerCase() === searchKey.toLowerCase()) return true;
    }
    return false;
  }

  function getMapKeyIgnoreCase(map: Map<string, any>, searchKey: string) {
    for (const [key, value] of map.entries()) {
      if (key.toLowerCase() === searchKey.toLowerCase()) return value;
    }
    return undefined;
  }

  // Gerar linhas da tabela executiva por item
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
        <td style="font-weight: 600; text-transform: uppercase;">${nome}</td>
        <td style="text-align: center;">${itensDoNome.length}</td>
        <td style="text-align: center;">${noAlmoxarifado}</td>
        <td style="text-align: center;">${emUsoProjeto}</td>
        <td style="text-align: center;">${semSaldo}</td>
      </tr>
    `;
  }).join('');

  // Gerar detalhamento por item
  const detalhamentoItens = Array.from(agrupadoPorNome.entries()).map(([nome, itensDoNome]) => {
    // Calcular resumo específico do item
    let noAlmoxarifadoNome = 0;
    let emUsoProjetoNome = 0;
    let semSaldoNome = 0;

    itensDoNome.forEach(item => {
      const isAlocado = alocacoes[item.id]?.alocada;
      if (isAlocado) {
        emUsoProjetoNome++;
      } else if (item.estoqueAtual > 0) {
        noAlmoxarifadoNome++;
      } else {
        semSaldoNome++;
      }
    });

    // Agrupar itens do nome por classificação
    const agrupadoPorClassificacao = new Map<string, EstoqueItem[]>();
    itensDoNome.forEach(item => {
      const classificacao = formatarClassificacao(item);
      if (!agrupadoPorClassificacao.has(classificacao)) {
        agrupadoPorClassificacao.set(classificacao, []);
      }
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
            <td style="font-family: monospace; font-size: 10px; font-weight: 500;">${item.codigoBarras}</td>
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
          <div style="font-weight: 600; font-size: 12px; color: #333; margin-bottom: 5px; border-bottom: 1px dotted #ccc; padding-bottom: 3px; display: flex; justify-content: space-between; align-items: flex-end;">
            <span style="font-size: 12px; text-transform: uppercase;">${classificacao}</span>
            <span style="font-size: 11px; font-weight: normal; color: #555;">
              Códigos: <strong>${itensDaClassificacao.length}</strong> | 
              No almoxarifado: <strong>${noAlmoxarifadoClass}</strong> | 
              Em uso/projeto: <strong>${emUsoProjetoClass}</strong> | 
              Sem saldo: <strong>${semSaldoClass}</strong>
            </span>
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 11px;">
            <thead>
              <tr style="background-color: #fafafa;">
                <th style="width: 14%; border: 1px solid #ddd; padding: 4px 8px; text-align: left; font-weight: 600; font-size: 10px;">Código</th>
                <th style="width: 12%; border: 1px solid #ddd; padding: 4px 8px; text-align: left; font-weight: 600; font-size: 10px;">Marca</th>
                <th style="width: 24%; border: 1px solid #ddd; padding: 4px 8px; text-align: left; font-weight: 600; font-size: 10px;">Especificação</th>
                <th style="width: 15%; border: 1px solid #ddd; padding: 4px 8px; text-align: left; font-weight: 600; font-size: 10px;">Status</th>
                <th style="width: 15%; border: 1px solid #ddd; padding: 4px 8px; text-align: left; font-weight: 600; font-size: 10px;">Localização almox.</th>
                <th style="width: 13%; border: 1px solid #ddd; padding: 4px 8px; text-align: left; font-weight: 600; font-size: 10px;">Projeto/Local de uso</th>
                <th style="width: 7%; border: 1px solid #ddd; padding: 4px 8px; text-align: right; font-weight: 600; font-size: 10px;">Saldo</th>
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
      <div class="item-block" style="margin-top: 25px; margin-bottom: 20px; page-break-inside: avoid; border-top: 1px solid #ddd; padding-top: 15px;">
        <h2 style="font-size: 15px; font-weight: bold; color: #111; margin: 0 0 5px 0; text-transform: uppercase;">${nome}</h2>
        <div style="font-size: 11px; color: #555; margin-bottom: 12px; font-weight: 500;">
          Códigos cadastrados: <strong>${itensDoNome.length}</strong> | 
          No almoxarifado: <strong>${noAlmoxarifadoNome}</strong> | 
          Em uso/projeto: <strong>${emUsoProjetoNome}</strong> | 
          Sem saldo: <strong>${semSaldoNome}</strong>
        </div>
        ${htmlClassificacoes}
      </div>
    `;
  }).join('');

  const filtroTextoInfo = filtroTexto ? `<div class="filtro-info"><strong>Filtro aplicado:</strong> ${filtroTexto}</div>` : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Relatório de Estoque Contado</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #222; line-height: 1.35; background-color: #fff; font-size: 11px; }
        h1 { color: #000; font-size: 20px; margin-bottom: 4px; margin-top: 0; font-weight: 700; text-align: center; text-transform: uppercase; }
        .subtitle { text-align: center; font-size: 12px; color: #444; margin-bottom: 15px; font-weight: 500; }
        .meta-info { display: flex; justify-content: space-between; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-bottom: 15px; font-size: 11px; color: #444; }
        .filtro-info { background-color: #fcfcfc; border: 1px solid #ddd; padding: 6px 10px; margin-bottom: 15px; font-size: 11px; border-radius: 4px; display: inline-block; }
        
        /* Resumo no topo */
        .resumo-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
        .resumo-card { border: 1px solid #ccc; border-radius: 4px; padding: 10px; text-align: center; background-color: #fff; }
        .resumo-val { font-size: 16px; font-weight: bold; margin-top: 2px; color: #000; }
        .resumo-lbl { font-size: 9px; text-transform: uppercase; color: #555; font-weight: 600; letter-spacing: 0.3px; }
        
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 5px 8px; text-align: left; }
        th { background-color: #f5f5f5; color: #222; font-weight: 600; font-size: 10px; }
        tr:nth-child(even) { background-color: #fcfcfc; }
        
        .footer { margin-top: 30px; text-align: center; color: #666; font-size: 9px; border-top: 1px solid #ddd; padding-top: 8px; }
        
        @media print {
          body { padding: 0; font-size: 11px; color: #000; }
          .item-block { page-break-inside: avoid; }
          .classificacao-block { page-break-inside: avoid; }
          .no-print { display: none; }
          @page { margin: 1.2cm 1.2cm; }
        }
      </style>
    </head>
    <body>
      <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 5px; font-size: 12px; font-weight: 600; color: #444;">
        Bambusa Almoxarifado Inteligente
      </div>
      <h1>RELATÓRIO DE ESTOQUE CONTADO</h1>
      
      <div class="meta-info" style="margin-top: 10px;">
        <div><strong>Estoque:</strong> ${nomeEstoque || 'Almoxarifado Principal'}</div>
        <div><strong>Emissão:</strong> ${new Date().toLocaleString('pt-BR')}</div>
        <div><strong>Total de códigos considerados:</strong> ${totalCodigosGeral}</div>
      </div>

      ${filtroTextoInfo}

      <!-- Resumo Geral -->
      <div class="resumo-grid">
        <div class="resumo-card">
          <div class="resumo-lbl">Códigos cadastrados</div>
          <div class="resumo-val">${totalCodigosGeral}</div>
        </div>
        <div class="resumo-card">
          <div class="resumo-lbl">No Almoxarifado</div>
          <div class="resumo-val">${noAlmoxarifadoGeral}</div>
        </div>
        <div class="resumo-card">
          <div class="resumo-lbl">Em Uso / Projeto</div>
          <div class="resumo-val">${emUsoProjetoGeral}</div>
        </div>
        <div class="resumo-card">
          <div class="resumo-lbl">Sem Saldo</div>
          <div class="resumo-val">${semSaldoGeral}</div>
        </div>
      </div>

      <!-- Tabela Executiva -->
      <h3 style="margin-top: 15px; margin-bottom: 8px; font-size: 12px; text-transform: uppercase; font-weight: bold; border-bottom: 1px solid #333; padding-bottom: 2px;">Tabela Executiva por Item</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px;">
        <thead>
          <tr>
            <th style="padding: 4px 8px;">Item</th>
            <th style="width: 15%; text-align: center; padding: 4px 8px;">Códigos</th>
            <th style="width: 18%; text-align: center; padding: 4px 8px;">No Almoxarifado</th>
            <th style="width: 18%; text-align: center; padding: 4px 8px;">Em Uso / Projeto</th>
            <th style="width: 15%; text-align: center; padding: 4px 8px;">Sem Saldo</th>
          </tr>
        </thead>
        <tbody>
          ${linhasTabelaExecutiva}
        </tbody>
      </table>

      <!-- Detalhamento por Item -->
      <h3 style="margin-top: 25px; margin-bottom: 10px; font-size: 12px; text-transform: uppercase; font-weight: bold; border-bottom: 1px solid #333; padding-bottom: 2px;">Detalhamento por Item</h3>
      <div>
        ${detalhamentoItens}
      </div>

      <div class="footer">
        Relatório de Estoque Contado — Bambusa. Impresso em ${new Date().toLocaleString('pt-BR')}.
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.print();
};
