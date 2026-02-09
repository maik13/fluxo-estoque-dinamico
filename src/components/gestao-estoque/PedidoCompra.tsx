import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Plus, Check, ChevronsUpDown, X, Printer, FileText, CheckCircle, Eye, Search } from 'lucide-react';
import { useEstoqueContext } from '@/contexts/EstoqueContext';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { EstoqueItem } from '@/types/estoque';

interface ItemPedido {
  item: EstoqueItem;
  quantidade: number;
}

interface PedidoCompraDB {
  id: string;
  numero: number;
  status: string;
  observacoes: string | null;
  criado_por_id: string | null;
  criado_por_nome: string;
  estoque_id: string | null;
  data_pedido: string;
  data_conclusao: string | null;
  created_at: string;
  updated_at: string;
}

interface PedidoItemDB {
  id: string;
  pedido_id: string;
  item_id: string;
  quantidade: number;
  item_snapshot: any;
  status: string;
  created_at: string;
  updated_at: string;
}

export const PedidoCompra = () => {
  const { obterEstoque } = useEstoqueContext();
  const { user } = useAuth();
  const { userProfile, canManageStock } = usePermissions();
  const { obterEstoqueAtivoInfo } = useConfiguracoes();

  // Dialog states
  const [dialogoNovoPedido, setDialogoNovoPedido] = useState(false);
  const [dialogoConsulta, setDialogoConsulta] = useState(false);
  const [dialogoDetalhe, setDialogoDetalhe] = useState(false);

  // Form states
  const [observacoes, setObservacoes] = useState('');
  const [buscaItem, setBuscaItem] = useState('');
  const [popoverAberto, setPopoverAberto] = useState(false);
  const [itemSelecionado, setItemSelecionado] = useState<EstoqueItem | null>(null);
  const [quantidade, setQuantidade] = useState<number>(0);
  const [itensPedido, setItensPedido] = useState<ItemPedido[]>([]);

  // Consulta states
  const [pedidos, setPedidos] = useState<PedidoCompraDB[]>([]);
  const [pedidoSelecionado, setPedidoSelecionado] = useState<PedidoCompraDB | null>(null);
  const [itensPedidoSelecionado, setItensPedidoSelecionado] = useState<PedidoItemDB[]>([]);
  const [loadingPedidos, setLoadingPedidos] = useState(false);

  const itensEstoque = obterEstoque();

  const itensFiltrados = useMemo(() => {
    if (!buscaItem) return itensEstoque;
    const termo = buscaItem.toLowerCase();
    return itensEstoque.filter(item =>
      item.nome.toLowerCase().includes(termo) ||
      item.codigoBarras.toString().includes(termo)
    );
  }, [buscaItem, itensEstoque]);

  const selecionarItem = (item: EstoqueItem) => {
    setItemSelecionado(item);
    setBuscaItem(item.nome);
    setPopoverAberto(false);
  };

  const limparItem = () => {
    setItemSelecionado(null);
    setBuscaItem('');
  };

  const adicionarItem = () => {
    if (!itemSelecionado) { toast.error('Selecione um item'); return; }
    if (!quantidade || quantidade <= 0) { toast.error('Informe uma quantidade válida'); return; }
    if (itensPedido.find(i => i.item.id === itemSelecionado.id)) { toast.error('Item já adicionado'); return; }

    setItensPedido(prev => [...prev, { item: itemSelecionado, quantidade }]);
    limparItem();
    setQuantidade(0);
    toast.success('Item adicionado');
  };

  const removerItem = (itemId: string) => {
    setItensPedido(prev => prev.filter(i => i.item.id !== itemId));
  };

  const criarPedido = async () => {
    if (itensPedido.length === 0) { toast.error('Adicione pelo menos um item'); return; }
    if (!user || !userProfile) { toast.error('Usuário não autenticado'); return; }

    try {
      const estoqueInfo = obterEstoqueAtivoInfo();

      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos_compra')
        .insert({
          criado_por_id: user.id,
          criado_por_nome: userProfile.nome,
          observacoes: observacoes || null,
          estoque_id: estoqueInfo?.id ?? null,
        })
        .select()
        .single();

      if (pedidoError) throw pedidoError;

      const itensInsert = itensPedido.map(ip => ({
        pedido_id: pedido.id,
        item_id: ip.item.id,
        quantidade: ip.quantidade,
        item_snapshot: {
          nome: ip.item.nome,
          codigoBarras: ip.item.codigoBarras,
          unidade: ip.item.unidade,
          marca: ip.item.marca,
          especificacao: ip.item.especificacao,
        },
      }));

      const { error: itensError } = await supabase
        .from('pedido_compra_itens')
        .insert(itensInsert);

      if (itensError) throw itensError;

      toast.success(`Pedido de Compra #${pedido.numero} criado com sucesso!`);
      setDialogoNovoPedido(false);
      setItensPedido([]);
      setObservacoes('');
      limparItem();
    } catch (error: any) {
      console.error('Erro ao criar pedido:', error);
      toast.error('Erro ao criar pedido de compra');
    }
  };

  const carregarPedidos = async () => {
    setLoadingPedidos(true);
    try {
      const estoqueInfo = obterEstoqueAtivoInfo();
      let query = supabase
        .from('pedidos_compra')
        .select('*')
        .order('numero', { ascending: false });

      if (estoqueInfo?.id) query = query.eq('estoque_id', estoqueInfo.id);

      const { data, error } = await query;
      if (error) throw error;
      setPedidos(data || []);
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
      toast.error('Erro ao carregar pedidos');
    } finally {
      setLoadingPedidos(false);
    }
  };

  const abrirDetalhe = async (pedido: PedidoCompraDB) => {
    setPedidoSelecionado(pedido);
    try {
      const { data, error } = await supabase
        .from('pedido_compra_itens')
        .select('*')
        .eq('pedido_id', pedido.id);

      if (error) throw error;
      setItensPedidoSelecionado(data || []);
      setDialogoDetalhe(true);
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
      toast.error('Erro ao carregar itens do pedido');
    }
  };

  const atualizarStatusItem = async (itemId: string, novoStatus: string) => {
    try {
      const { error } = await supabase
        .from('pedido_compra_itens')
        .update({ status: novoStatus })
        .eq('id', itemId);

      if (error) throw error;
      setItensPedidoSelecionado(prev =>
        prev.map(i => i.id === itemId ? { ...i, status: novoStatus } : i)
      );
      toast.success('Status atualizado');
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const concluirPedido = async () => {
    if (!pedidoSelecionado) return;
    try {
      const { error } = await supabase
        .from('pedidos_compra')
        .update({ status: 'concluido', data_conclusao: new Date().toISOString() })
        .eq('id', pedidoSelecionado.id);

      if (error) throw error;
      setPedidoSelecionado(prev => prev ? { ...prev, status: 'concluido' } : null);
      toast.success('Pedido concluído!');
      carregarPedidos();
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao concluir pedido');
    }
  };

  const imprimirPedido = async () => {
    if (!pedidoSelecionado) return;

    let logoHtml = '';
    try {
      const { data, error } = await supabase.storage.from('branding').list('', { limit: 1 });
      if (!error && data && data.length > 0) {
        const { data: urlData } = supabase.storage.from('branding').getPublicUrl(data[0].name);
        if (urlData.publicUrl) {
          logoHtml = `<img src="${urlData.publicUrl}" alt="Logo" style="height:50px;object-fit:contain;" />`;
        }
      }
    } catch (e) { /* ignore */ }

    const printWindow = window.open('', '_blank');
    if (!printWindow) { toast.error('Habilite pop-ups para imprimir'); return; }

    const rows = itensPedidoSelecionado.map((item, idx) => {
      const snap = item.item_snapshot as any;
      const statusLabel = item.status === 'comprado' ? 'COMPRADO' : 'PENDENTE';
      const statusColor = item.status === 'comprado' ? '#27ae60' : '#e67e22';
      return `<tr>
        <td>${idx + 1}</td>
        <td>${snap?.nome || '-'}</td>
        <td>${snap?.codigoBarras || '-'}</td>
        <td>${item.quantidade} ${snap?.unidade || ''}</td>
        <td>${snap?.marca || '-'}</td>
        <td style="color:${statusColor};font-weight:bold;">${statusLabel}</td>
      </tr>`;
    }).join('');

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Pedido de Compra #${pedidoSelecionado.numero}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; }
        .header { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; border-bottom: 2px solid #2980b3; padding-bottom: 8px; }
        .header h1 { font-size: 16px; margin: 0; }
        .info { color: #666; margin-bottom: 12px; font-size: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
        th { background: #2980b3; color: white; font-size: 10px; }
        tr:nth-child(even) { background: #f8f8f8; }
        .obs { margin-top: 12px; padding: 8px; background: #f5f5f5; border-radius: 4px; }
        @media print { body { margin: 10px; } }
      </style></head><body>
      <div class="header">${logoHtml}<h1>Pedido de Compra #${pedidoSelecionado.numero}</h1></div>
      <div class="info">
        Criado por: ${pedidoSelecionado.criado_por_nome} | 
        Data: ${new Date(pedidoSelecionado.data_pedido).toLocaleString('pt-BR')} | 
        Status: ${pedidoSelecionado.status === 'concluido' ? 'CONCLUÍDO' : 'ABERTO'} |
        Total de itens: ${itensPedidoSelecionado.length}
      </div>
      <table><thead><tr>
        <th>#</th><th>Item</th><th>Código</th><th>Qtd</th><th>Marca</th><th>Status</th>
      </tr></thead><tbody>${rows}</tbody></table>
      ${pedidoSelecionado.observacoes ? `<div class="obs"><strong>Observações:</strong> ${pedidoSelecionado.observacoes}</div>` : ''}
    </body></html>`);

    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const salvarPDF = () => {
    imprimirPedido(); // O usuário pode salvar como PDF pelo diálogo de impressão
  };

  const podeMovimentar = canManageStock;

  return (
    <>
      {/* Botão no Menu */}
      <Card
        className={cn(
          "cursor-pointer hover:scale-105 transition-all duration-300",
          podeMovimentar
            ? "border-blue-500/20 hover:border-blue-500/40"
            : "border-muted/20 hover:border-muted/40 opacity-60"
        )}
        onClick={() => {
          if (!podeMovimentar) return;
          setDialogoConsulta(true);
          carregarPedidos();
        }}
      >
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
            <ShoppingCart className="h-8 w-8 text-blue-500" />
          </div>
          <CardTitle className="text-blue-500">Pedido de Compra</CardTitle>
          <CardDescription>Criar e consultar pedidos de compra</CardDescription>
        </CardHeader>
      </Card>

      {/* Dialog de Consulta de Pedidos */}
      <Dialog open={dialogoConsulta} onOpenChange={setDialogoConsulta}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>🛒 Pedidos de Compra</DialogTitle>
            <DialogDescription>Consulte e crie novos pedidos de compra</DialogDescription>
          </DialogHeader>

          <div className="flex justify-end mb-4">
            <Button onClick={() => setDialogoNovoPedido(true)}>
              <Plus className="h-4 w-4 mr-2" /> Novo Pedido
            </Button>
          </div>

          {loadingPedidos ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : pedidos.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum pedido encontrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Criado por</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidos.map(pedido => (
                  <TableRow key={pedido.id}>
                    <TableCell className="font-medium">#{pedido.numero}</TableCell>
                    <TableCell>{new Date(pedido.data_pedido).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>{pedido.criado_por_nome}</TableCell>
                    <TableCell>
                      <Badge variant={pedido.status === 'concluido' ? 'default' : 'secondary'}>
                        {pedido.status === 'concluido' ? 'Concluído' : 'Aberto'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => abrirDetalhe(pedido)}>
                        <Eye className="h-4 w-4 mr-1" /> Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Novo Pedido */}
      <Dialog open={dialogoNovoPedido} onOpenChange={setDialogoNovoPedido}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📋 Novo Pedido de Compra</DialogTitle>
            <DialogDescription>Selecione os itens e quantidades para o pedido</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Buscar Item *</Label>
              <div className="flex space-x-2">
                <Popover open={popoverAberto} onOpenChange={setPopoverAberto}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="flex-1 justify-between">
                      {itemSelecionado ? itemSelecionado.nome : "Selecione um item..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Buscar por nome ou código..." value={buscaItem} onValueChange={setBuscaItem} />
                      <CommandList>
                        <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                        <CommandGroup>
                          {itensFiltrados.map(item => (
                            <CommandItem key={item.id} onSelect={() => selecionarItem(item)} className="cursor-pointer">
                              <Check className={cn("mr-2 h-4 w-4", itemSelecionado?.id === item.id ? "opacity-100" : "opacity-0")} />
                              <div className="flex-1">
                                <div className="font-medium">{item.nome}</div>
                                <div className="text-sm text-muted-foreground">
                                  {item.codigoBarras} • {item.marca} • Estoque: {item.estoqueAtual} {item.unidade}
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {itemSelecionado && (
                  <Button type="button" variant="outline" size="icon" onClick={limparItem} className="text-destructive hover:text-destructive">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {itemSelecionado && (
                <div className="mt-2 p-3 bg-muted rounded-md text-sm">
                  <p><strong>Nome:</strong> {itemSelecionado.nome}</p>
                  <p><strong>Código:</strong> {itemSelecionado.codigoBarras}</p>
                  <p><strong>Estoque Atual:</strong> {itemSelecionado.estoqueAtual} {itemSelecionado.unidade}</p>
                  <p><strong>Marca:</strong> {itemSelecionado.marca}</p>
                </div>
              )}
            </div>

            <div>
              <Label>Quantidade *</Label>
              <div className="flex space-x-2">
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={quantidade || ''}
                  onChange={e => setQuantidade(Number(e.target.value))}
                  placeholder="Quantidade"
                  className="flex-1"
                />
                <Button type="button" onClick={adicionarItem}>
                  <Plus className="h-4 w-4 mr-2" /> Adicionar
                </Button>
              </div>
            </div>

            {itensPedido.length > 0 && (
              <div className="border rounded-md p-4 space-y-2 bg-muted/30">
                <Label className="text-base font-semibold">Itens do Pedido ({itensPedido.length})</Label>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {itensPedido.map(ip => (
                    <div key={ip.item.id} className="flex items-start justify-between p-3 bg-background rounded border">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{ip.item.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          Código: {ip.item.codigoBarras} • Quantidade: <strong>{ip.quantidade} {ip.item.unidade}</strong>
                        </p>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removerItem(ip.item.id)} className="text-destructive hover:text-destructive ml-2">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label>Observações</Label>
              <Textarea
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
                placeholder="Observações adicionais (opcional)"
                rows={2}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button variant="outline" onClick={() => { setDialogoNovoPedido(false); setItensPedido([]); setObservacoes(''); limparItem(); }}>
                Cancelar
              </Button>
              <Button onClick={criarPedido} disabled={itensPedido.length === 0}>
                Criar Pedido ({itensPedido.length} {itensPedido.length === 1 ? 'item' : 'itens'})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Detalhe do Pedido */}
      <Dialog open={dialogoDetalhe} onOpenChange={setDialogoDetalhe}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📋 Pedido de Compra #{pedidoSelecionado?.numero}</DialogTitle>
            <DialogDescription>
              Criado por {pedidoSelecionado?.criado_por_nome} em {pedidoSelecionado ? new Date(pedidoSelecionado.data_pedido).toLocaleDateString('pt-BR') : ''}
              {' • '}
              <Badge variant={pedidoSelecionado?.status === 'concluido' ? 'default' : 'secondary'}>
                {pedidoSelecionado?.status === 'concluido' ? 'Concluído' : 'Aberto'}
              </Badge>
            </DialogDescription>
          </DialogHeader>

          {pedidoSelecionado?.observacoes && (
            <div className="p-3 bg-muted rounded-md text-sm">
              <strong>Observações:</strong> {pedidoSelecionado.observacoes}
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Qtd</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itensPedidoSelecionado.map((item, idx) => {
                const snap = item.item_snapshot as any;
                return (
                  <TableRow key={item.id}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell className="font-medium">{snap?.nome || '-'}</TableCell>
                    <TableCell>{snap?.codigoBarras || '-'}</TableCell>
                    <TableCell>{item.quantidade} {snap?.unidade || ''}</TableCell>
                    <TableCell>{snap?.marca || '-'}</TableCell>
                    <TableCell>
                      <Select
                        value={item.status}
                        onValueChange={(val) => atualizarStatusItem(item.id, val)}
                        disabled={pedidoSelecionado?.status === 'concluido'}
                      >
                        <SelectTrigger className="w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendente">
                            <span className="flex items-center gap-1 text-orange-500 font-medium">Pendente</span>
                          </SelectItem>
                          <SelectItem value="comprado">
                            <span className="flex items-center gap-1 text-green-500 font-medium">Comprado</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="flex justify-between pt-4 border-t">
            <div className="flex gap-2">
              <Button variant="outline" onClick={imprimirPedido}>
                <Printer className="h-4 w-4 mr-2" /> Imprimir
              </Button>
              <Button variant="outline" onClick={salvarPDF}>
                <FileText className="h-4 w-4 mr-2" /> Salvar PDF
              </Button>
            </div>
            {pedidoSelecionado?.status !== 'concluido' && (
              <Button onClick={concluirPedido} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="h-4 w-4 mr-2" /> Concluir Pedido
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
