import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeftRight, Plus, Trash2 } from 'lucide-react';
import { useEstoque } from '@/hooks/useEstoque';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { useAuth } from '@/hooks/useAuth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { EstoqueItem } from '@/types/estoque';
import { supabase } from '@/integrations/supabase/client';

interface ItemTransferencia {
  item: EstoqueItem;
  quantidade: number;
}

interface TransferenciaProps {
  onTransferenciaRealizada: () => void;
}

export const Transferencia = ({ onTransferenciaRealizada }: TransferenciaProps) => {
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [estoqueOrigemId, setEstoqueOrigemId] = useState('');
  const [estoqueDestinoId, setEstoqueDestinoId] = useState('');
  const [itensTransferencia, setItensTransferencia] = useState<ItemTransferencia[]>([]);
  const [observacoes, setObservacoes] = useState('');
  const [popoverAberto, setPopoverAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [processando, setProcessando] = useState(false);

  const { obterEstoque } = useEstoque();
  const { estoques } = useConfiguracoes();
  const { user } = useAuth();
  
  const itensDisponiveis = obterEstoque();

  const adicionarItem = (item: EstoqueItem, quantidade: number) => {
    const itemExistente = itensTransferencia.find(i => i.item.id === item.id);
    
    if (itemExistente) {
      setItensTransferencia(prev => 
        prev.map(i => 
          i.item.id === item.id 
            ? { ...i, quantidade: i.quantidade + quantidade }
            : i
        )
      );
    } else {
      setItensTransferencia(prev => [
        ...prev,
        { item, quantidade }
      ]);
    }
    
    setBusca('');
    setPopoverAberto(false);
  };

  const removerItem = (itemId: string) => {
    setItensTransferencia(prev => prev.filter(i => i.item.id !== itemId));
  };

  const atualizarQuantidade = (itemId: string, novaQuantidade: number) => {
    if (novaQuantidade <= 0) {
      removerItem(itemId);
      return;
    }

    setItensTransferencia(prev =>
      prev.map(i =>
        i.item.id === itemId
          ? { ...i, quantidade: novaQuantidade }
          : i
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!estoqueOrigemId) {
      toast.error('Selecione o estoque de origem');
      return;
    }

    if (!estoqueDestinoId) {
      toast.error('Selecione o estoque de destino');
      return;
    }

    if (estoqueOrigemId === estoqueDestinoId) {
      toast.error('Os estoques de origem e destino devem ser diferentes');
      return;
    }

    if (itensTransferencia.length === 0) {
      toast.error('Adicione pelo menos um item');
      return;
    }

    if (!user) {
      toast.error('Usuário não autenticado');
      return;
    }

    setProcessando(true);

    try {
      // Criar registro de transferência
      const { data: transferenciaData, error: transferenciaError } = await supabase
        .from('transferencias')
        .insert({
          estoque_origem_id: estoqueOrigemId,
          estoque_destino_id: estoqueDestinoId,
          user_id: user.id,
          observacoes: observacoes || null,
        })
        .select()
        .single();

      if (transferenciaError) throw transferenciaError;

      // Criar itens da transferência e movimentações
      for (const itemTransf of itensTransferencia) {
        const item = itemTransf.item;
        
        // Criar item da transferência
        const { error: itemError } = await supabase
          .from('transferencia_itens')
          .insert({
            transferencia_id: transferenciaData.id,
            item_id: item.id,
            quantidade: itemTransf.quantidade,
            item_snapshot: {
              nome: item.nome,
              codigoBarras: item.codigoBarras,
              marca: item.marca,
              unidade: item.unidade,
            },
          });

        if (itemError) throw itemError;

        // Criar movimentação de SAÍDA no estoque de origem
        const { error: saidaError } = await supabase
          .from('movements')
          .insert({
            item_id: item.id,
            tipo: 'SAIDA',
            quantidade: itemTransf.quantidade,
            quantidade_anterior: item.estoqueAtual,
            quantidade_atual: item.estoqueAtual - itemTransf.quantidade,
            user_id: user.id,
            estoque_id: estoqueOrigemId,
            observacoes: `Transferência para outro estoque - ${observacoes || 'Sem observações'}`,
            item_snapshot: {
              nome: item.nome,
              codigoBarras: item.codigoBarras,
              marca: item.marca,
              unidade: item.unidade,
              especificacao: item.especificacao,
              origem: item.origem,
              localizacao: item.localizacao,
            },
          });

        if (saidaError) throw saidaError;

        // Criar movimentação de ENTRADA no estoque de destino
        const { error: entradaError } = await supabase
          .from('movements')
          .insert({
            item_id: item.id,
            tipo: 'ENTRADA',
            quantidade: itemTransf.quantidade,
            quantidade_anterior: item.estoqueAtual - itemTransf.quantidade,
            quantidade_atual: item.estoqueAtual,
            user_id: user.id,
            estoque_id: estoqueDestinoId,
            observacoes: `Transferência de outro estoque - ${observacoes || 'Sem observações'}`,
            item_snapshot: {
              nome: item.nome,
              codigoBarras: item.codigoBarras,
              marca: item.marca,
              unidade: item.unidade,
              especificacao: item.especificacao,
              origem: item.origem,
              localizacao: item.localizacao,
            },
          });

        if (entradaError) throw entradaError;
      }

      toast.success(`Transferência realizada com sucesso! ${itensTransferencia.length} item(ns) transferido(s).`);
      resetarFormulario();
      setDialogoAberto(false);
      onTransferenciaRealizada();
    } catch (error: any) {
      console.error('Erro ao realizar transferência:', error);
      toast.error(`Erro ao realizar transferência: ${error.message}`);
    } finally {
      setProcessando(false);
    }
  };

  const resetarFormulario = () => {
    setEstoqueOrigemId('');
    setEstoqueDestinoId('');
    setItensTransferencia([]);
    setObservacoes('');
    setBusca('');
  };

  const estoquesAtivos = estoques.filter(e => e.ativo);

  return (
    <Dialog open={dialogoAberto} onOpenChange={(open) => {
      setDialogoAberto(open);
      if (!open) resetarFormulario();
    }}>
      <DialogTrigger asChild>
        <Card className="cursor-pointer hover:scale-105 transition-all duration-300 border-primary/20 hover:border-primary/40">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <ArrowLeftRight className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-primary">Transferência</CardTitle>
            <p className="text-sm text-primary/80 mt-2">
              Transferir itens entre estoques
            </p>
          </CardHeader>
        </Card>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🔄 Transferência entre Estoques</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Estoque de Origem */}
          <div className="space-y-2">
            <Label htmlFor="estoqueOrigem">Estoque de Origem *</Label>
            <Select value={estoqueOrigemId} onValueChange={setEstoqueOrigemId} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o estoque de origem" />
              </SelectTrigger>
              <SelectContent>
                {estoquesAtivos.map(estoque => (
                  <SelectItem key={estoque.id} value={estoque.id}>
                    {estoque.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Estoque de Destino */}
          <div className="space-y-2">
            <Label htmlFor="estoqueDestino">Estoque de Destino *</Label>
            <Select value={estoqueDestinoId} onValueChange={setEstoqueDestinoId} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o estoque de destino" />
              </SelectTrigger>
              <SelectContent>
                {estoquesAtivos
                  .filter(e => e.id !== estoqueOrigemId)
                  .map(estoque => (
                    <SelectItem key={estoque.id} value={estoque.id}>
                      {estoque.nome}
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
                <Button variant="outline" className="w-full justify-start" type="button">
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
                          item.codigoBarras.toString().includes(busca)
                        )
                        .map((item) => (
                          <CommandItem
                            key={item.id}
                            onSelect={() => {
                              const quantidade = window.prompt('Quantidade a transferir:', '1');
                              const qtd = parseFloat(quantidade || '1');
                              if (qtd > 0) {
                                adicionarItem(item, qtd);
                              }
                            }}
                          >
                            <div className="flex flex-col w-full">
                              <div className="font-medium">{item.nome}</div>
                              <div className="text-sm text-muted-foreground">
                                {item.codigoBarras} - {item.marca || 'Sem marca'} - Estoque: {item.estoqueAtual} {item.unidade}
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

          {/* Lista de itens adicionados */}
          {itensTransferencia.length > 0 && (
            <div className="space-y-2">
              <Label>Itens para Transferência ({itensTransferencia.length})</Label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {itensTransferencia.map((itemTransf) => (
                  <Card key={itemTransf.item.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{itemTransf.item.nome}</div>
                          <div className="text-sm text-muted-foreground">
                            {itemTransf.item.codigoBarras} - {itemTransf.item.marca || 'Sem marca'} - Estoque atual: {itemTransf.item.estoqueAtual} {itemTransf.item.unidade}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={itemTransf.quantidade}
                            onChange={(e) => atualizarQuantidade(itemTransf.item.id, parseFloat(e.target.value))}
                            className="w-24"
                          />
                          <span className="text-sm text-muted-foreground min-w-[40px]">
                            {itemTransf.item.unidade}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removerItem(itemTransf.item.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Campo Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações sobre esta transferência (opcional)"
              rows={3}
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setDialogoAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={processando || itensTransferencia.length === 0}>
              {processando ? 'Processando...' : 'Realizar Transferência'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};