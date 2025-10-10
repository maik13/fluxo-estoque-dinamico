import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, ArrowUpCircle, ArrowDownCircle, FileText } from 'lucide-react';
import { useSolicitacoes } from '@/hooks/useSolicitacoes';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const VisualizarMovimentacoes = () => {
  const { solicitacoes, loading } = useSolicitacoes();

  // Filtrar retiradas e devoluções aprovadas
  const retiradas = solicitacoes.filter(s => 
    s.status === 'aprovada' && 
    (!s.tipo_operacao || s.tipo_operacao === 'saida_producao' || s.tipo_operacao === 'saida_obra')
  );

  const devolucoes = solicitacoes.filter(s => 
    s.status === 'aprovada' && 
    (s.tipo_operacao === 'devolucao' || s.tipo_operacao === 'devolucao_estoque')
  );

  const gerarPDFRetiradas = () => {
    const doc = new jsPDF();
    
    // Título
    doc.setFontSize(18);
    doc.text('RELATÓRIO DE RETIRADAS DE MATERIAL', 14, 20);
    
    doc.setFontSize(11);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 14, 28);
    doc.text(`Total de retiradas: ${retiradas.length}`, 14, 34);

    // Preparar dados para a tabela
    const dadosTabela = retiradas.flatMap(retirada => 
      retirada.itens.map((item, index) => [
        index === 0 ? `#${retirada.numero || retirada.id.slice(-8)}` : '',
        index === 0 ? format(new Date(retirada.data_solicitacao), 'dd/MM/yyyy', { locale: ptBR }) : '',
        index === 0 ? retirada.solicitante_nome : '',
        item.item_snapshot.nome || '',
        item.item_snapshot.codigoBarras || '',
        item.quantidade_aprovada.toString(),
        item.item_snapshot.unidade || '',
        index === 0 ? (retirada.local_utilizacao || '-') : ''
      ])
    );

    // Criar tabela
    autoTable(doc, {
      startY: 40,
      head: [['Nº', 'Data', 'Solicitante', 'Item', 'Código', 'Qtd', 'Un.', 'Local']],
      body: dadosTabela,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 66, 66] },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 22 },
        2: { cellWidth: 30 },
        3: { cellWidth: 35 },
        4: { cellWidth: 22 },
        5: { cellWidth: 15 },
        6: { cellWidth: 12 },
        7: { cellWidth: 30 }
      },
    });

    // Salvar PDF
    doc.save(`retiradas_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`);
  };

  const gerarPDFDevolucoes = () => {
    const doc = new jsPDF();
    
    // Título
    doc.setFontSize(18);
    doc.text('RELATÓRIO DE DEVOLUÇÕES DE MATERIAL', 14, 20);
    
    doc.setFontSize(11);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 14, 28);
    doc.text(`Total de devoluções: ${devolucoes.length}`, 14, 34);

    // Preparar dados para a tabela
    const dadosTabela = devolucoes.flatMap(devolucao => 
      devolucao.itens.map((item, index) => [
        index === 0 ? `#${devolucao.numero || devolucao.id.slice(-8)}` : '',
        index === 0 ? format(new Date(devolucao.data_solicitacao), 'dd/MM/yyyy', { locale: ptBR }) : '',
        index === 0 ? devolucao.solicitante_nome : '',
        item.item_snapshot.nome || '',
        item.item_snapshot.codigoBarras || '',
        item.quantidade_aprovada.toString(),
        item.item_snapshot.unidade || '',
        index === 0 ? (devolucao.local_utilizacao || '-') : ''
      ])
    );

    // Criar tabela
    autoTable(doc, {
      startY: 40,
      head: [['Nº', 'Data', 'Solicitante', 'Item', 'Código', 'Qtd', 'Un.', 'Local']],
      body: dadosTabela,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 66, 66] },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 22 },
        2: { cellWidth: 30 },
        3: { cellWidth: 35 },
        4: { cellWidth: 22 },
        5: { cellWidth: 15 },
        6: { cellWidth: 12 },
        7: { cellWidth: 30 }
      },
    });

    // Salvar PDF
    doc.save(`devolucoes_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`);
  };

  if (loading) {
    return <div>Carregando movimentações...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Visualizar Movimentações
        </CardTitle>
        <CardDescription>
          Consulte todas as retiradas e devoluções de material
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="retiradas" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="retiradas">
              <ArrowDownCircle className="h-4 w-4 mr-2" />
              Retiradas ({retiradas.length})
            </TabsTrigger>
            <TabsTrigger value="devolucoes">
              <ArrowUpCircle className="h-4 w-4 mr-2" />
              Devoluções ({devolucoes.length})
            </TabsTrigger>
          </TabsList>

          {/* Aba de Retiradas */}
          <TabsContent value="retiradas" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Total: {retiradas.length} retirada(s)
              </p>
              <Button 
                onClick={gerarPDFRetiradas} 
                disabled={retiradas.length === 0}
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
            </div>

            {retiradas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma retirada registrada
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Solicitante</TableHead>
                      <TableHead>Itens</TableHead>
                      <TableHead>Local</TableHead>
                      <TableHead>Aprovado por</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {retiradas.map((retirada) => (
                      <TableRow key={retirada.id}>
                        <TableCell className="font-medium">
                          #{retirada.numero || retirada.id.slice(-8)}
                        </TableCell>
                        <TableCell>
                          {format(new Date(retirada.data_solicitacao), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell>{retirada.solicitante_nome}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {retirada.itens.map((item, idx) => (
                              <div key={idx} className="text-sm">
                                {item.item_snapshot.nome} - {item.quantidade_aprovada} {item.item_snapshot.unidade}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{retirada.local_utilizacao || '-'}</TableCell>
                        <TableCell>{retirada.aprovado_por_nome || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Aba de Devoluções */}
          <TabsContent value="devolucoes" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Total: {devolucoes.length} devolução(ões)
              </p>
              <Button 
                onClick={gerarPDFDevolucoes} 
                disabled={devolucoes.length === 0}
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
            </div>

            {devolucoes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma devolução registrada
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Solicitante</TableHead>
                      <TableHead>Itens</TableHead>
                      <TableHead>Local Origem</TableHead>
                      <TableHead>Aprovado por</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devolucoes.map((devolucao) => (
                      <TableRow key={devolucao.id}>
                        <TableCell className="font-medium">
                          #{devolucao.numero || devolucao.id.slice(-8)}
                        </TableCell>
                        <TableCell>
                          {format(new Date(devolucao.data_solicitacao), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell>{devolucao.solicitante_nome}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {devolucao.itens.map((item, idx) => (
                              <div key={idx} className="text-sm">
                                {item.item_snapshot.nome} - {item.quantidade_aprovada} {item.item_snapshot.unidade}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{devolucao.local_utilizacao || '-'}</TableCell>
                        <TableCell>{devolucao.aprovado_por_nome || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
