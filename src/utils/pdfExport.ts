import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EstoqueItem } from '@/types/estoque';
import { supabase } from '@/integrations/supabase/client';

interface Usuario {
  id: string;
  nome: string;
  email: string;
  tipo_usuario: string;
  ativo: boolean;
  created_at: string;
}

interface RelatorioOptions {
  titulo: string;
  nomeEstoque: string;
  itens: EstoqueItem[];
  usuarios?: Usuario[];
  incluirUsuarios?: boolean;
}

export const gerarRelatorioPDF = async ({
  titulo,
  nomeEstoque,
  itens,
  usuarios = [],
  incluirUsuarios = false
}: RelatorioOptions) => {
  const doc = new jsPDF();
  
  // Configurações
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  let yPosition = 20;

  // Carregar e adicionar logo
  try {
    const { data, error } = await supabase.storage
      .from('branding')
      .list('', { limit: 1 });

    if (!error && data && data.length > 0) {
      const { data: publicUrlData } = supabase.storage
        .from('branding')
        .getPublicUrl(data[0].name);
      
      if (publicUrlData.publicUrl) {
        // Buscar a imagem e converter para base64
        const response = await fetch(publicUrlData.publicUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        
        await new Promise((resolve) => {
          reader.onloadend = () => {
            const base64data = reader.result as string;
            // Adicionar logo no canto superior esquerdo
            doc.addImage(base64data, 'PNG', 15, 10, 30, 15);
            resolve(null);
          };
          reader.readAsDataURL(blob);
        });
      }
    }
  } catch (error) {
    console.error('Erro ao carregar logo para PDF:', error);
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
  doc.text('RESUMO DO ESTOQUE', 25, yPosition + 8);
  
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

  // Lista de usuários (se solicitado)
  if (incluirUsuarios && usuarios.length > 0) {
    // Nova página para usuários
    doc.addPage();
    yPosition = 20;

    // Título da seção de usuários
    doc.setFontSize(16);
    doc.setTextColor(41, 128, 185);
    doc.text('USUARIOS CADASTRADOS', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Estatísticas de usuários
    const totalUsuarios = usuarios.length;
    const usuariosAtivos = usuarios.filter(u => u.ativo).length;
    const usuariosInativos = usuarios.filter(u => !u.ativo).length;

    doc.setFillColor(240, 248, 255);
    doc.rect(20, yPosition, pageWidth - 40, 20, 'F');
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    const resumoUsuarios = [
      `Total: ${totalUsuarios}`,
      `Ativos: ${usuariosAtivos}`,
      `Inativos: ${usuariosInativos}`
    ];
    
    resumoUsuarios.forEach((texto, index) => {
      const x = 30 + (index * 50);
      doc.text(texto, x, yPosition + 12);
    });

    yPosition += 30;

    // Tabela de usuários
    const dadosUsuarios = usuarios.map(usuario => [
      usuario.nome,
      usuario.email,
      usuario.tipo_usuario,
      usuario.ativo ? 'Ativo' : 'Inativo',
      new Date(usuario.created_at).toLocaleDateString('pt-BR')
    ]);

    autoTable(doc, {
      head: [['Nome', 'Email', 'Tipo', 'Status', 'Cadastrado em']],
      body: dadosUsuarios,
      startY: yPosition,
      theme: 'striped',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'center'
      },
      alternateRowStyles: {
        fillColor: [248, 248, 248]
      },
      columnStyles: {
        0: { cellWidth: 45 }, // Nome
        1: { cellWidth: 55 }, // Email
        2: { cellWidth: 30 }, // Tipo
        3: { cellWidth: 25 }, // Status
        4: { cellWidth: 35 } // Data
      },
      margin: { top: 5, right: 10, bottom: 20, left: 10 },
    });

    // Nova página para tabela de estoque
    doc.addPage();
    yPosition = 20;

    // Título da seção de estoque
    doc.setFontSize(16);
    doc.setTextColor(41, 128, 185);
    doc.text('ITENS DO ESTOQUE', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 20;
  }

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
      0: { cellWidth: 18, halign: 'center' }, // Código
      1: { cellWidth: 38 }, // Nome
      2: { cellWidth: 20, halign: 'center' }, // Categoria
      3: { cellWidth: 22 }, // Localização
      4: { cellWidth: 18 }, // Caixa/Org
      5: { cellWidth: 13, halign: 'right' }, // Estoque
      6: { cellWidth: 8, halign: 'center' }, // Unidade
      7: { cellWidth: 10, halign: 'center' } // Status
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

// Função para gerar relatório com usuários
export const gerarRelatorioPDFComUsuarios = async (
  titulo: string,
  nomeEstoque: string,
  itens: EstoqueItem[],
  usuarios: Usuario[]
) => {
  return gerarRelatorioPDF({
    titulo,
    nomeEstoque,
    itens,
    usuarios,
    incluirUsuarios: true
  });
};