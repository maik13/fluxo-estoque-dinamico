import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EstoqueItem } from '@/types/estoque';

interface RelatorioOptions {
  titulo: string;
  nomeEstoque: string;
  itens: EstoqueItem[];
  incluirLogo?: boolean;
  logoBase64?: string;
}

export const gerarRelatorioPDF = async ({
  titulo,
  nomeEstoque,
  itens,
  incluirLogo = true,
  logoBase64
}: RelatorioOptions) => {
  const doc = new jsPDF();
  
  // Configurações
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  let yPosition = 20;

  // Logo (se fornecido)
  if (incluirLogo && logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 20, yPosition, 30, 30);
      yPosition += 35;
    } catch (error) {
      console.warn('Erro ao adicionar logo:', error);
    }
  }

  // Cabeçalho
  doc.setFontSize(20);
  doc.setTextColor(41, 128, 185);
  doc.text(titulo, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(`Estoque: ${nomeEstoque}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Estatísticas resumidas
  const totalItens = itens.length;
  const comEstoque = itens.filter(item => item.estoqueAtual > 0).length;
  const estoqueZero = itens.filter(item => item.estoqueAtual === 0).length;
  const estoqueBaixo = itens.filter(item => 
    item.quantidadeMinima && item.estoqueAtual <= item.quantidadeMinima
  ).length;

  // Box de estatísticas
  doc.setFillColor(240, 248, 255);
  doc.rect(20, yPosition, pageWidth - 40, 25, 'F');
  
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text('📊 RESUMO DO ESTOQUE', 25, yPosition + 8);
  
  doc.setFontSize(10);
  const resumoTexto = [
    `Total de Itens: ${totalItens}`,
    `Com Estoque: ${comEstoque}`,
    `Estoque Baixo: ${estoqueBaixo}`,
    `Estoque Zerado: ${estoqueZero}`
  ];
  
  resumoTexto.forEach((texto, index) => {
    const x = 25 + (index * 40);
    doc.text(texto, x, yPosition + 18);
  });

  yPosition += 35;

  // Preparar dados da tabela otimizados para A4
  const dadosTabela = itens.map(item => [
    item.codigoBarras,
    item.nome.length > 35 ? item.nome.substring(0, 35) + '...' : item.nome,
    item.categoria || '-',
    item.localizacao || '-',
    item.caixaOrganizador || '-',
    item.estoqueAtual.toString(),
    item.unidade,
    getStatusEstoque(item)
  ]);

  // Criar tabela otimizada para A4
  autoTable(doc, {
    head: [['Código', 'Nome', 'Categoria', 'Localização', 'Caixa/Org.', 'Estoque', 'Un.', 'Status']],
    body: dadosTabela,
    startY: yPosition,
    theme: 'striped',
    styles: {
      fontSize: 6,
      cellPadding: 1,
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center'
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248]
    },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' }, // Código
      1: { cellWidth: 45 }, // Nome
      2: { cellWidth: 22, halign: 'center' }, // Categoria
      3: { cellWidth: 25 }, // Localização
      4: { cellWidth: 20 }, // Caixa/Org
      5: { cellWidth: 15, halign: 'right' }, // Estoque
      6: { cellWidth: 10, halign: 'center' }, // Unidade
      7: { cellWidth: 12, halign: 'center' } // Status
    },
    margin: { top: 5, right: 10, bottom: 20, left: 10 },
    didDrawPage: function (data) {
      // Adicionar rodapé
      const pageNumber = (doc as any).internal.getNumberOfPages();
      
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Página ${data.pageNumber} | Sistema de Gestão de Estoque`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }
  });

  // Salvar arquivo
  const nomeArquivo = `relatorio-estoque-${nomeEstoque.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(nomeArquivo);
};

const getStatusEstoque = (item: EstoqueItem): string => {
  if (item.estoqueAtual === 0) return 'ZERADO';
  if (item.quantidadeMinima && item.estoqueAtual <= item.quantidadeMinima) return 'BAIXO';
  return 'OK';
};

// Função para converter imagem para base64 (caso o usuário queira adicionar logo)
export const converterImagemParaBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};