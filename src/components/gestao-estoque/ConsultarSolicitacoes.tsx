import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Printer, Eye, RotateCcw, AlertTriangle } from 'lucide-react';
import { useSolicitacoes } from '@/hooks/useSolicitacoes';
import { usePermissions } from '@/hooks/usePermissions';
import { SolicitacaoCompleta } from '@/types/solicitacao';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const ConsultarSolicitacoes = () => {
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [solicitacaoSelecionada, setSolicitacaoSelecionada] = useState<SolicitacaoCompleta | null>(null);
  const [filtroAtivo, setFiltroAtivo] = useState<'todas' | 'devolucoes' | 'inconformidade'>('todas');
  const [destinatario, setDestinatario] = useState('');
  
  const { solicitacoes, loading, atualizarAceites } = useSolicitacoes();
  const { canManageStock, userProfile } = usePermissions();

  // Filtrar solicitações baseado no filtro ativo
  const solicitacoesFiltradas = solicitacoes.filter((sol) => {
    if (filtroAtivo === 'devolucoes') {
      return sol.tipo_operacao === 'devolucao' || sol.solicitacao_origem_id !== null;
    }
    if (filtroAtivo === 'inconformidade') {
      // Inconformidade: quando quantidade aprovada é diferente da solicitada
      return sol.itens.some(item => 
        item.quantidade_aprovada > 0 && 
        item.quantidade_aprovada !== item.quantidade_solicitada
      );
    }
    return true; // todas
  });


  const abrirDetalhes = (solicitacao: SolicitacaoCompleta) => {
    setSolicitacaoSelecionada(solicitacao);
    setDestinatario(solicitacao.destinatario || '');
    setDialogoAberto(true);
  };

  const atualizarDestinatario = async () => {
    if (!solicitacaoSelecionada || !destinatario.trim()) {
      toast.error('Por favor, informe o destinatário');
      return;
    }

    try {
      // Atualizar solicitação
      const { error: solicitacaoError } = await supabase
        .from('solicitacoes')
        .update({ destinatario: destinatario.trim() })
        .eq('id', solicitacaoSelecionada.id);

      if (solicitacaoError) throw solicitacaoError;

      // Atualizar movimentações relacionadas
      const { error: movimentacoesError } = await supabase
        .from('movements')
        .update({ destinatario: destinatario.trim() })
        .eq('solicitacao_id', solicitacaoSelecionada.id);

      if (movimentacoesError) throw movimentacoesError;

      toast.success('Destinatário atualizado com sucesso');
      
      // Atualizar estado local
      setSolicitacaoSelecionada({
        ...solicitacaoSelecionada,
        destinatario: destinatario.trim()
      });
    } catch (error: any) {
      console.error('Erro ao atualizar destinatário:', error);
      toast.error('Erro ao atualizar destinatário');
    }
  };

  const imprimirSolicitacao = (solicitacao: SolicitacaoCompleta) => {
    const conteudo = `
      <html>
        <head>
          <title>Solicitação de Material - ${solicitacao.id}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .logo { font-size: 24px; font-weight: bold; color: #333; }
            .titulo { text-align: center; font-size: 20px; margin: 20px 0; }
            .info { margin: 10px 0; }
            .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .table th { background-color: #f2f2f2; }
            .assinaturas { display: flex; justify-content: space-between; margin-top: 50px; }
            .assinatura { width: 45%; text-align: center; border-top: 1px solid #333; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">LOGO EMPRESA</div>
            <div>
              <div><strong>Solicitação Nº:</strong> ${solicitacao.id.slice(-8)}</div>
              <div><strong>Data:</strong> ${format(new Date(solicitacao.data_solicitacao), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</div>
            </div>
          </div>
          
          <div class="titulo">SOLICITAÇÃO DE MATERIAL</div>
          
          <div class="info">
            <strong>Solicitante:</strong> ${solicitacao.solicitante_nome}
          </div>
          
          ${solicitacao.local_utilizacao ? `<div class="info"><strong>Local de Utilização:</strong> ${solicitacao.local_utilizacao}</div>` : ''}
          
          ${solicitacao.responsavel_estoque ? `<div class="info"><strong>Responsável pelo Estoque:</strong> ${solicitacao.responsavel_estoque}</div>` : ''}
          
          ${solicitacao.tipo_operacao ? `<div class="info"><strong>Tipo de Operação:</strong> ${solicitacao.tipo_operacao}</div>` : ''}
          
          ${solicitacao.observacoes ? `<div class="info"><strong>Observações:</strong> ${solicitacao.observacoes}</div>` : ''}
          
          <table class="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Código</th>
                <th>Qtd. Solicitada</th>
                <th>Qtd. Aprovada</th>
                <th>Unidade</th>
              </tr>
            </thead>
            <tbody>
              ${solicitacao.itens.map(item => `
                <tr>
                  <td>${item.item_snapshot.nome}</td>
                  <td>${item.item_snapshot.codigoBarras}</td>
                  <td>${item.quantidade_solicitada}</td>
                  <td>${item.quantidade_aprovada}</td>
                  <td>${item.item_snapshot.unidade}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="assinaturas">
            <div class="assinatura">
              <div>Responsável pela Separação</div>
              <div style="margin-top: 20px;">
                <input type="checkbox" ${solicitacao.aceite_separador ? 'checked' : ''}> Aceito
              </div>
            </div>
            <div class="assinatura">
              <div>Solicitante</div>
              <div style="margin-top: 20px;">
                <input type="checkbox" ${solicitacao.aceite_solicitante ? 'checked' : ''}> Aceito
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const novaJanela = window.open('', '_blank');
    if (novaJanela) {
      novaJanela.document.write(conteudo);
      novaJanela.document.close();
      novaJanela.print();
    }
  };

  if (loading) {
    return <div>Carregando solicitações...</div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Consultar Solicitações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={filtroAtivo} onValueChange={(value) => setFiltroAtivo(value as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="todas" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Todas
              </TabsTrigger>
              <TabsTrigger value="devolucoes" className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4" />
                Devoluções
              </TabsTrigger>
              <TabsTrigger value="inconformidade" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Inconformidades
              </TabsTrigger>
            </TabsList>

            <TabsContent value={filtroAtivo} className="space-y-4">
              {solicitacoesFiltradas.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhuma solicitação encontrada.
                </p>
              ) : (
                <div className="space-y-2">
                  {solicitacoesFiltradas.map((solicitacao) => (
                  <Card key={solicitacao.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium">
                              Solicitação #{solicitacao.id.slice(-8)}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <div>Solicitante: {solicitacao.solicitante_nome}</div>
                            <div>Data: {format(new Date(solicitacao.data_solicitacao), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</div>
                            <div>{solicitacao.itens.length} item(ns)</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => imprimirSolicitacao(solicitacao)}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => abrirDetalhes(solicitacao)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialog de detalhes */}
      <Dialog open={dialogoAberto} onOpenChange={setDialogoAberto}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Detalhes da Solicitação #{solicitacaoSelecionada?.id.slice(-8)}
            </DialogTitle>
            <DialogDescription className="sr-only">Detalhes da solicitação</DialogDescription>
          </DialogHeader>

          {solicitacaoSelecionada && (
            <div className="space-y-6">
              {/* Informações gerais */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Solicitante</Label>
                  <p className="font-medium">{solicitacaoSelecionada.solicitante_nome}</p>
                </div>
                <div>
                  <Label>Data da Solicitação</Label>
                  <p>{format(new Date(solicitacaoSelecionada.data_solicitacao), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
                </div>
                {solicitacaoSelecionada.local_utilizacao && (
                  <div>
                    <Label>Local de Utilização</Label>
                    <p>{solicitacaoSelecionada.local_utilizacao}</p>
                  </div>
                )}
                {solicitacaoSelecionada.responsavel_estoque && (
                  <div>
                    <Label>Responsável pelo Estoque</Label>
                    <p>{solicitacaoSelecionada.responsavel_estoque}</p>
                  </div>
                )}
                {solicitacaoSelecionada.tipo_operacao && (
                  <div>
                    <Label>Tipo de Operação</Label>
                    <p className="capitalize">{solicitacaoSelecionada.tipo_operacao.replace(/_/g, ' ')}</p>
                  </div>
                )}
              </div>

              {solicitacaoSelecionada.observacoes && (
                <div>
                  <Label>Observações</Label>
                  <p className="mt-1">{solicitacaoSelecionada.observacoes}</p>
                </div>
              )}

              {/* Itens */}
              <div>
                <Label>Itens Solicitados</Label>
                <Table className="mt-2">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Qtd. Solicitada</TableHead>
                      <TableHead>Qtd. Aprovada</TableHead>
                      <TableHead>Unidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {solicitacaoSelecionada.itens.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.item_snapshot.nome}</TableCell>
                        <TableCell>{item.item_snapshot.codigoBarras}</TableCell>
                        <TableCell>{item.quantidade_solicitada}</TableCell>
                        <TableCell>{item.quantidade_aprovada}</TableCell>
                        <TableCell>{item.item_snapshot.unidade}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Campo Destinatário (para gestores/estoquistas) */}
              {canManageStock() && (
                <div className="space-y-2">
                  <Label htmlFor="destinatario-saida">Destinatário (Nome da pessoa) *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="destinatario-saida"
                      value={destinatario}
                      onChange={(e) => setDestinatario(e.target.value)}
                      placeholder="Nome da pessoa que receberá o material"
                      disabled={solicitacaoSelecionada.aceite_separador}
                    />
                    <Button 
                      onClick={atualizarDestinatario}
                      disabled={solicitacaoSelecionada.aceite_separador || !destinatario.trim()}
                    >
                      Salvar
                    </Button>
                  </div>
                  {solicitacaoSelecionada.destinatario && (
                    <p className="text-sm text-muted-foreground">
                      Destinatário atual: {solicitacaoSelecionada.destinatario}
                    </p>
                  )}
                </div>
              )}

              {/* Aceites */}
              <div className="space-y-4">
                <Label>Aceites</Label>
                <div className="flex gap-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="aceite-separador"
                      checked={solicitacaoSelecionada.aceite_separador}
                      onCheckedChange={(checked) => 
                        atualizarAceites(solicitacaoSelecionada.id, !!checked, undefined)
                      }
                      disabled={!canManageStock() || !solicitacaoSelecionada.destinatario}
                    />
                    <Label htmlFor="aceite-separador">Aceite do Responsável pela Separação (SAÍDA)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="aceite-solicitante"
                      checked={solicitacaoSelecionada.aceite_solicitante}
                      onCheckedChange={(checked) => 
                        atualizarAceites(solicitacaoSelecionada.id, undefined, !!checked)
                      }
                      disabled={solicitacaoSelecionada.solicitante_id !== userProfile?.user_id}
                    />
                    <Label htmlFor="aceite-solicitante">Aceite do Solicitante</Label>
                  </div>
                </div>
                {!solicitacaoSelecionada.destinatario && canManageStock() && (
                  <p className="text-sm text-amber-600">
                    ⚠️ Informe o destinatário antes de processar a saída
                  </p>
                )}
              </div>

              {/* Botões de ação */}
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => imprimirSolicitacao(solicitacaoSelecionada)}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setDialogoAberto(false)}
                  >
                    Fechar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};