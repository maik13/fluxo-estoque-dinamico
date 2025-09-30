import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Package, Plus, FileText, Printer, Eye, Check, X } from 'lucide-react';
import { useEstoque } from '@/hooks/useEstoque';
import { useSolicitacoes } from '@/hooks/useSolicitacoes';
import { usePermissions } from '@/hooks/usePermissions';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { Item } from '@/types/estoque';
import { NovoItemSolicitacao, SolicitacaoCompleta } from '@/types/solicitacao';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const SolicitarMaterial = () => {
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [localUtilizacao, setLocalUtilizacao] = useState('');
  const [responsavelEstoque, setResponsavelEstoque] = useState('');
  const [tipoOperacao, setTipoOperacao] = useState('saida_producao');
  const [itensSolicitados, setItensSolicitados] = useState<NovoItemSolicitacao[]>([]);
  const [popoverAberto, setPopoverAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [visualizarSolicitacoes, setVisualizarSolicitacoes] = useState(false);
  const [solicitacaoSelecionada, setSolicitacaoSelecionada] = useState<SolicitacaoCompleta | null>(null);
  const [detalhesAberto, setDetalhesAberto] = useState(false);
  const [quantidadesAprovadas, setQuantidadesAprovadas] = useState<Record<string, number>>({});

  const { obterEstoque } = useEstoque();
  const { criarSolicitacao, solicitacoes, loading, aprovarSolicitacao, rejeitarSolicitacao, atualizarAceites } = useSolicitacoes();
  const { canManageStock, userProfile } = usePermissions();
  const { obterTiposOperacaoAtivos, obterSolicitantesAtivos, obterLocaisUtilizacaoAtivos } = useConfiguracoes();
  
  const itensDisponiveis = obterEstoque();
  const tiposOperacaoDisponiveis = obterTiposOperacaoAtivos();
  const solicitantesDisponiveis = obterSolicitantesAtivos();
  const locaisDisponiveis = obterLocaisUtilizacaoAtivos();

  const adicionarItem = (item: Item, quantidade: number) => {
    const itemExistente = itensSolicitados.find(i => i.item_id === item.id);
    
    if (itemExistente) {
      setItensSolicitados(prev => 
        prev.map(i => 
          i.item_id === item.id 
            ? { ...i, quantidade_solicitada: i.quantidade_solicitada + quantidade }
            : i
        )
      );
    } else {
      setItensSolicitados(prev => [
        ...prev,
        {
          item_id: item.id,
          quantidade_solicitada: quantidade,
          item_snapshot: {
            id: item.id,
            nome: item.nome,
            codigoBarras: item.codigoBarras,
            categoria: item.categoria,
            subcategoria: item.subcategoria,
            unidade: item.unidade,
            marca: item.marca,
            especificacao: item.especificacao
          }
        }
      ]);
    }
    
    setBusca('');
    setPopoverAberto(false);
  };

  const removerItem = (itemId: string) => {
    setItensSolicitados(prev => prev.filter(item => item.item_id !== itemId));
  };

  const atualizarQuantidade = (itemId: string, novaQuantidade: number) => {
    if (novaQuantidade <= 0) {
      removerItem(itemId);
      return;
    }

    setItensSolicitados(prev =>
      prev.map(item =>
        item.item_id === itemId
          ? { ...item, quantidade_solicitada: novaQuantidade }
          : item
      )
    );
  };

  const handleSubmit = async () => {
    if (itensSolicitados.length === 0) {
      return;
    }

    const sucesso = await criarSolicitacao({
      observacoes,
      local_utilizacao: localUtilizacao,
      responsavel_estoque: responsavelEstoque,
      tipo_operacao: tipoOperacao,
      itens: itensSolicitados
    });

    if (sucesso) {
      resetarFormulario();
      setDialogoAberto(false);
    }
  };

  const resetarFormulario = () => {
    setObservacoes('');
    setLocalUtilizacao('');
    setResponsavelEstoque('');
    setTipoOperacao('saida_producao');
    setItensSolicitados([]);
    setBusca('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente':
        return <Badge variant="outline">Pendente</Badge>;
      case 'aprovada':
        return <Badge className="bg-green-100 text-green-800">Aprovada</Badge>;
      case 'rejeitada':
        return <Badge variant="destructive">Rejeitada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const abrirDetalhes = (solicitacao: SolicitacaoCompleta) => {
    setSolicitacaoSelecionada(solicitacao);
    
    // Inicializar quantidades aprovadas
    const qtdInicial: Record<string, number> = {};
    solicitacao.itens.forEach(item => {
      qtdInicial[item.id] = item.quantidade_aprovada || item.quantidade_solicitada;
    });
    setQuantidadesAprovadas(qtdInicial);
    
    setDetalhesAberto(true);
  };

  const handleAprovar = async () => {
    if (!solicitacaoSelecionada) return;

    const itensAprovados = solicitacaoSelecionada.itens.map(item => ({
      id: item.id,
      quantidade: quantidadesAprovadas[item.id] || 0
    }));

    const sucesso = await aprovarSolicitacao(solicitacaoSelecionada.id, itensAprovados);
    if (sucesso) {
      setDetalhesAberto(false);
    }
  };

  const handleRejeitar = async () => {
    if (!solicitacaoSelecionada) return;

    const sucesso = await rejeitarSolicitacao(solicitacaoSelecionada.id);
    if (sucesso) {
      setDetalhesAberto(false);
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
              <div><strong>Solicitação Nº:</strong> ${typeof (solicitacao as any).numero !== 'undefined' ? (solicitacao as any).numero : solicitacao.id.slice(-8)}</div>
              <div><strong>Data:</strong> ${format(new Date(solicitacao.data_solicitacao), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</div>
            </div>
          </div>
          
          <div class="titulo">SOLICITAÇÃO DE MATERIAL</div>
          
          <div class="info">
            <strong>Solicitante:</strong> ${solicitacao.solicitante_nome}
          </div>
          
          <div class="info">
            <strong>Status:</strong> ${solicitacao.status.toUpperCase()}
          </div>
          
          ${solicitacao.local_utilizacao ? `<div class="info"><strong>Local de Utilização:</strong> ${solicitacao.local_utilizacao}</div>` : ''}
          
          ${solicitacao.responsavel_estoque ? `<div class="info"><strong>Responsável pelo Estoque:</strong> ${solicitacao.responsavel_estoque}</div>` : ''}
          
          ${solicitacao.tipo_operacao ? `<div class="info"><strong>Tipo de Operação:</strong> ${solicitacao.tipo_operacao.replace(/_/g, ' ')}</div>` : ''}
          
          ${solicitacao.observacoes ? `<div class="info"><strong>Observações:</strong> ${solicitacao.observacoes}</div>` : ''}
          
          <table class="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Código</th>
                <th>Categoria</th>
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
                  <td>${item.item_snapshot.categoria}</td>
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

  return (
    <>
      <Dialog open={dialogoAberto} onOpenChange={(open) => {
        setDialogoAberto(open);
        if (!open) resetarFormulario();
      }}>
        <DialogTrigger asChild>
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
              <div className="flex items-center space-x-2">
                <Package className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Solicitar Material</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Solicite materiais do estoque para aprovação
              </p>
            </CardContent>
          </Card>
        </DialogTrigger>

        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Solicitar Material</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Campo Solicitante */}
            <div className="space-y-2">
              <Label htmlFor="solicitante">Solicitante *</Label>
              <Select value={userProfile?.nome || ''} disabled>
                <SelectTrigger>
                  <SelectValue placeholder="Solicitante" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={userProfile?.nome || ''}>{userProfile?.nome || 'Usuário'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Campo Local de Utilização */}
            <div className="space-y-2">
              <Label htmlFor="localUtilizacao">Local onde será utilizado *</Label>
              <Select value={localUtilizacao} onValueChange={setLocalUtilizacao}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o local" />
                </SelectTrigger>
                <SelectContent>
                  {locaisDisponiveis.map(local => (
                    <SelectItem key={local.id} value={local.nome}>
                      {local.codigo ? `${local.codigo} - ${local.nome}` : local.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Campo Responsável pelo Estoque */}
            <div className="space-y-2">
              <Label htmlFor="responsavelEstoque">Responsável pelo Estoque</Label>
              <Input
                id="responsavelEstoque"
                placeholder="Nome do responsável pela separação"
                value={responsavelEstoque}
                onChange={(e) => setResponsavelEstoque(e.target.value)}
              />
            </div>

            {/* Campo Tipo de Operação */}
            <div className="space-y-2">
              <Label htmlFor="tipoOperacao">Tipo de Operação *</Label>
              <Select value={tipoOperacao} onValueChange={setTipoOperacao}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {tiposOperacaoDisponiveis.map(tipo => (
                    <SelectItem key={tipo.id} value={tipo.nome.toLowerCase().replace(/\s+/g, '_')}>
                      {tipo.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Buscar e adicionar itens */}
            <div className="space-y-2">
              <Label>Adicionar Item</Label>
              <Popover open={popoverAberto} onOpenChange={setPopoverAberto}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <Plus className="h-4 w-4 mr-2" />
                    Buscar item para adicionar...
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput 
                      placeholder="Buscar por nome ou código..." 
                      value={busca}
                      onValueChange={setBusca}
                    />
                    <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        {itensDisponiveis
                          .filter(item => 
                            item.nome.toLowerCase().includes(busca.toLowerCase()) ||
                            item.codigoBarras.includes(busca)
                          )
                          .slice(0, 10)
                          .map((item) => (
                            <CommandItem
                              key={item.id}
                              onSelect={() => {
                                const quantidade = window.prompt('Quantidade solicitada:', '1');
                                const qtd = parseInt(quantidade || '1');
                                if (qtd > 0) {
                                  adicionarItem(item, qtd);
                                }
                              }}
                            >
                              <div className="flex flex-col w-full">
                                <div className="font-medium">{item.nome}</div>
                                <div className="text-sm text-muted-foreground">
                                  {item.codigoBarras} - {item.categoria} - Estoque: {item.estoqueAtual}
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Lista de itens solicitados */}
            {itensSolicitados.length > 0 && (
              <div className="space-y-2">
                <Label>Itens Solicitados</Label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {itensSolicitados.map((itemSolicitado) => {
                    const item = itemSolicitado.item_snapshot;
                    return (
                      <Card key={itemSolicitado.item_id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-medium">{item.nome}</div>
                              <div className="text-sm text-muted-foreground">
                                {item.codigoBarras} - {item.categoria}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Input
                                type="number"
                                min="1"
                                value={itemSolicitado.quantidade_solicitada}
                                onChange={(e) => atualizarQuantidade(
                                  itemSolicitado.item_id,
                                  parseInt(e.target.value) || 0
                                )}
                                className="w-20"
                              />
                              <Badge variant="secondary">{item.unidade}</Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removerItem(itemSolicitado.item_id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Observações */}
            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                placeholder="Observações sobre a solicitação..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </div>

            {/* Botões */}
            <div className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={() => setVisualizarSolicitacoes(true)}
              >
                <FileText className="h-4 w-4 mr-2" />
                Consultar Solicitações
              </Button>
              
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setDialogoAberto(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={itensSolicitados.length === 0 || !localUtilizacao.trim()}
                >
                  Enviar Solicitação
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para visualizar solicitações */}
      <Dialog open={visualizarSolicitacoes} onOpenChange={setVisualizarSolicitacoes}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Minhas Solicitações</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {loading ? (
              <p>Carregando solicitações...</p>
            ) : solicitacoes.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma solicitação encontrada.</p>
            ) : (
              <div className="grid gap-4">
                {solicitacoes.map((solicitacao) => (
                  <Card key={solicitacao.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">#{solicitacao.id.slice(-8)}</span>
                            {getStatusBadge(solicitacao.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {solicitacao.solicitante_nome} • {format(new Date(solicitacao.data_solicitacao), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </p>
                          {solicitacao.local_utilizacao && (
                            <p className="text-sm">
                              <strong>Local:</strong> {solicitacao.local_utilizacao}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground">
                            {solicitacao.itens.length} item(ns)
                          </p>
                        </div>
                        
                        <div className="flex items-center space-x-2">
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
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para detalhes da solicitação */}
      <Dialog open={detalhesAberto} onOpenChange={setDetalhesAberto}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Solicitação</DialogTitle>
          </DialogHeader>

          {solicitacaoSelecionada && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-medium">ID da Solicitação</Label>
                  <p className="text-sm text-muted-foreground">#{solicitacaoSelecionada.id.slice(0, 8)}</p>
                </div>
                <div>
                  <Label className="font-medium">Status</Label>
                  <div className="mt-1">{getStatusBadge(solicitacaoSelecionada.status)}</div>
                </div>
                <div>
                  <Label className="font-medium">Solicitante</Label>
                  <p className="text-sm text-muted-foreground">{solicitacaoSelecionada.solicitante_nome}</p>
                </div>
                <div>
                  <Label className="font-medium">Data da Solicitação</Label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(solicitacaoSelecionada.data_solicitacao).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <Separator />

              {solicitacaoSelecionada.local_utilizacao && (
                <div>
                  <Label className="font-medium">Local de Utilização</Label>
                  <p className="text-sm text-muted-foreground">{solicitacaoSelecionada.local_utilizacao}</p>
                </div>
              )}

              {solicitacaoSelecionada.observacoes && (
                <div>
                  <Label className="font-medium">Observações</Label>
                  <p className="text-sm text-muted-foreground">{solicitacaoSelecionada.observacoes}</p>
                </div>
              )}

              <div>
                <Label className="font-medium">Itens Solicitados</Label>
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

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => imprimirSolicitacao(solicitacaoSelecionada)}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir
                </Button>
                <Button onClick={() => setDetalhesAberto(false)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};