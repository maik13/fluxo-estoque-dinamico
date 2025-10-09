import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, PackageCheck, Plus, FileText, Printer, Eye } from 'lucide-react';
import { useEstoque } from '@/hooks/useEstoque';
import { useSolicitacoes } from '@/hooks/useSolicitacoes';
import { usePermissions } from '@/hooks/usePermissions';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { Item } from '@/types/estoque';
import { NovoItemSolicitacao, SolicitacaoCompleta } from '@/types/solicitacao';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export const DevolverMaterial = () => {
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [localUtilizacao, setLocalUtilizacao] = useState('');
  const [responsavelEstoque, setResponsavelEstoque] = useState('');
  const [tipoOperacao, setTipoOperacao] = useState('devolucao');
  const [itensSolicitados, setItensSolicitados] = useState<NovoItemSolicitacao[]>([]);
  const [popoverAberto, setPopoverAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [visualizarSolicitacoes, setVisualizarSolicitacoes] = useState(false);
  const [solicitacaoSelecionada, setSolicitacaoSelecionada] = useState<SolicitacaoCompleta | null>(null);
  const [detalhesAberto, setDetalhesAberto] = useState(false);
  const [retiradaOriginalId, setRetiradaOriginalId] = useState<string>('');
  const [mostrarSelecaoRetirada, setMostrarSelecaoRetirada] = useState(true);

  const { obterEstoque } = useEstoque();
  const { criarSolicitacao, solicitacoes, loading, validarItensDevolucao } = useSolicitacoes();
  const { userProfile } = usePermissions();
  const { obterTiposOperacaoAtivos, obterLocaisUtilizacaoAtivos } = useConfiguracoes();
  
  const itensDisponiveis = obterEstoque();
  const tiposOperacaoDisponiveis = obterTiposOperacaoAtivos();
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
      toast.error('Adicione pelo menos um item para devolução');
      return;
    }

    if (!retiradaOriginalId) {
      toast.error('Selecione a retirada original');
      return;
    }

    // Validar itens contra a retirada original
    const retiradaOriginal = solicitacoes.find(s => s.id === retiradaOriginalId);
    if (retiradaOriginal) {
      const validacao = validarItensDevolucao(retiradaOriginal.itens, itensSolicitados);
      
      if (!validacao.valido) {
        toast.error('Divergência encontrada!', {
          description: validacao.divergencias.join(', ')
        });
        
        const confirmar = window.confirm(
          `ATENÇÃO: Os seguintes itens não foram retirados na solicitação original:\n\n${validacao.divergencias.join('\n')}\n\nDeseja continuar mesmo assim?`
        );
        
        if (!confirmar) return;
      }
    }

    const sucesso = await criarSolicitacao({
      observacoes,
      local_utilizacao: localUtilizacao,
      responsavel_estoque: responsavelEstoque,
      tipo_operacao: tipoOperacao,
      solicitacao_origem_id: retiradaOriginalId,
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
    setTipoOperacao('devolucao');
    setItensSolicitados([]);
    setBusca('');
    setRetiradaOriginalId('');
    setMostrarSelecaoRetirada(true);
  };

  const selecionarRetirada = (solicitacao: SolicitacaoCompleta) => {
    setRetiradaOriginalId(solicitacao.id);
    setLocalUtilizacao(solicitacao.local_utilizacao || '');
    setMostrarSelecaoRetirada(false);
    toast.success(`Retirada #${solicitacao.numero || solicitacao.id.slice(-8)} selecionada`);
  };

  // Filtrar apenas retiradas aprovadas que não são devoluções
  const retiradasDisponiveis = solicitacoes.filter(s => {
    // Deve ser aprovada e não ser uma devolução
    const isRetirada = s.status === 'aprovada' && 
                       s.tipo_operacao !== 'devolucao' &&
                       s.tipo_operacao !== null;
    
    // Não deve ter uma devolução aprovada vinculada
    const temDevolucao = solicitacoes.some(dev => 
      dev.solicitacao_origem_id === s.id && 
      dev.status === 'aprovada'
    );
    
    return isRetirada && !temDevolucao;
  });

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
    setDetalhesAberto(true);
  };

  const imprimirSolicitacao = (solicitacao: SolicitacaoCompleta) => {
    const conteudo = `
      <html>
        <head>
          <title>Devolução de Material - ${solicitacao.id}</title>
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
              <div><strong>Devolução Nº:</strong> ${typeof (solicitacao as any).numero !== 'undefined' ? (solicitacao as any).numero : solicitacao.id.slice(-8)}</div>
              <div><strong>Data:</strong> ${format(new Date(solicitacao.data_solicitacao), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</div>
            </div>
          </div>
          
          <div class="titulo">DEVOLUÇÃO DE MATERIAL</div>
          
          <div class="info">
            <strong>Solicitante:</strong> ${solicitacao.solicitante_nome}
          </div>
          
          <div class="info">
            <strong>Status:</strong> ${solicitacao.status.toUpperCase()}
          </div>
          
          ${solicitacao.local_utilizacao ? `<div class="info"><strong>Local de Origem:</strong> ${solicitacao.local_utilizacao}</div>` : ''}
          
          ${solicitacao.responsavel_estoque ? `<div class="info"><strong>Responsável pela Recepção:</strong> ${solicitacao.responsavel_estoque}</div>` : ''}
          
          ${solicitacao.tipo_operacao ? `<div class="info"><strong>Tipo de Operação:</strong> ${solicitacao.tipo_operacao.replace(/_/g, ' ')}</div>` : ''}
          
          ${solicitacao.observacoes ? `<div class="info"><strong>Observações:</strong> ${solicitacao.observacoes}</div>` : ''}
          
          <table class="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Código</th>
                <th>Categoria</th>
                <th>Qtd. Devolvida</th>
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
              <div>Responsável pela Recepção</div>
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
        <Card className="cursor-pointer hover:shadow-md transition-shadow border-teal-200 hover:border-teal-400">
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <div className="flex items-center space-x-2">
              <PackageCheck className="h-5 w-5 text-teal-600" />
              <CardTitle className="text-lg text-teal-600">Devolução de Material</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Registre devoluções de materiais ao estoque
            </p>
          </CardContent>
        </Card>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Devolução de Material</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Seleção da Retirada Original */}
          {mostrarSelecaoRetirada && (
            <div className="space-y-2 p-4 border rounded-lg bg-muted/50">
              <Label className="text-base font-semibold">1. Selecione a retirada que está devolvendo *</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Escolha qual solicitação de retirada você está devolvendo
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {retiradasDisponiveis.length === 0 ? (
                  <Card className="p-4">
                    <p className="text-sm text-muted-foreground text-center">
                      Nenhuma retirada aprovada disponível para devolução
                    </p>
                  </Card>
                ) : (
                  retiradasDisponiveis.map(retirada => (
                    <Card 
                      key={retirada.id}
                      className={`cursor-pointer hover:border-primary transition-colors ${
                        retiradaOriginalId === retirada.id ? 'border-primary bg-primary/5' : ''
                      }`}
                      onClick={() => selecionarRetirada(retirada)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">
                              Retirada #{retirada.numero || retirada.id.slice(-8)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(retirada.data_solicitacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </div>
                            <div className="text-sm mt-1">
                              {retirada.itens.length} {retirada.itens.length === 1 ? 'item' : 'itens'}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant={retiradaOriginalId === retirada.id ? 'default' : 'outline'}
                            size="sm"
                          >
                            {retiradaOriginalId === retirada.id ? 'Selecionada' : 'Selecionar'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
              {retiradaOriginalId && (
                <Button
                  type="button"
                  className="w-full mt-2"
                  onClick={() => setMostrarSelecaoRetirada(false)}
                >
                  Continuar com a Devolução
                </Button>
              )}
            </div>
          )}

          {!mostrarSelecaoRetirada && retiradaOriginalId && (
            <div className="p-3 bg-primary/10 rounded-lg flex items-center justify-between">
              <div className="text-sm">
                <strong>Devolvendo:</strong> Retirada #{solicitacoes.find(s => s.id === retiradaOriginalId)?.numero || retiradaOriginalId.slice(-8)}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMostrarSelecaoRetirada(true);
                  setRetiradaOriginalId('');
                }}
              >
                Alterar
              </Button>
            </div>
          )}

          {!mostrarSelecaoRetirada && (
            <>
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
            <Label htmlFor="localUtilizacao">Local de onde está devolvendo *</Label>
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
              placeholder="Nome do responsável pela recepção"
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
                              const quantidade = window.prompt('Quantidade a devolver:', '1');
                              const qtd = parseInt(quantidade || '1');
                              if (qtd > 0) {
                                adicionarItem(item, qtd);
                              }
                            }}
                          >
                            <div className="flex flex-col w-full">
                              <div className="font-medium">{item.nome}</div>
                              <div className="text-sm text-muted-foreground">
                                {item.codigoBarras} - {item.categoria}
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
              <Label>Itens para Devolução</Label>
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
                              className="w-20"
                              value={itemSolicitado.quantidade_solicitada}
                              onChange={(e) => atualizarQuantidade(itemSolicitado.item_id, parseInt(e.target.value))}
                            />
                            <span className="text-sm text-muted-foreground">{item.unidade}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removerItem(itemSolicitado.item_id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
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

          {/* Campo Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              placeholder="Observações adicionais sobre a devolução..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Botões */}
          <div className="flex justify-between">
            <Button 
              variant="outline" 
              onClick={() => setVisualizarSolicitacoes(true)}
            >
              <FileText className="h-4 w-4 mr-2" />
              Consultar Devoluções
            </Button>
            
            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => setDialogoAberto(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={itensSolicitados.length === 0 || !localUtilizacao || !retiradaOriginalId}
                className="bg-teal-600 hover:bg-teal-700"
              >
                Registrar Devolução
              </Button>
            </div>
          </div>
          </>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Dialog para visualizar devoluções */}
    <Dialog open={visualizarSolicitacoes} onOpenChange={setVisualizarSolicitacoes}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Minhas Devoluções</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <p>Carregando devoluções...</p>
          ) : solicitacoes.filter(s => s.tipo_operacao === 'devolucao').length === 0 ? (
            <p className="text-muted-foreground">Nenhuma devolução encontrada.</p>
          ) : (
            <div className="grid gap-4">
              {solicitacoes
                .filter(s => s.tipo_operacao === 'devolucao')
                .map((solicitacao) => (
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

    {/* Dialog para detalhes da devolução */}
    <Dialog open={detalhesAberto} onOpenChange={setDetalhesAberto}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes da Devolução</DialogTitle>
        </DialogHeader>

        {solicitacaoSelecionada && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="font-medium">ID da Devolução</Label>
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
                <Label className="font-medium">Data da Devolução</Label>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(solicitacaoSelecionada.data_solicitacao), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                </p>
              </div>
            </div>

            <Separator />

            {solicitacaoSelecionada.local_utilizacao && (
              <div>
                <Label className="font-medium">Local de Origem</Label>
                <p className="text-sm text-muted-foreground">{solicitacaoSelecionada.local_utilizacao}</p>
              </div>
            )}

            {solicitacaoSelecionada.responsavel_estoque && (
              <div>
                <Label className="font-medium">Responsável pela Recepção</Label>
                <p className="text-sm text-muted-foreground">{solicitacaoSelecionada.responsavel_estoque}</p>
              </div>
            )}

            {solicitacaoSelecionada.observacoes && (
              <div>
                <Label className="font-medium">Observações</Label>
                <p className="text-sm text-muted-foreground">{solicitacaoSelecionada.observacoes}</p>
              </div>
            )}

            <div>
              <Label className="font-medium">Itens Devolvidos</Label>
              <Table className="mt-2">
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Qtd. Devolvida</TableHead>
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
