import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useEstoque } from '@/hooks/useEstoque';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { EstoqueItem } from '@/types/estoque';

interface ItemEntrada {
  item: EstoqueItem;
  quantidade: number;
}

interface RegistrarEntradaProps {
  onEntradaRealizada: () => void;
}

export const RegistrarEntrada = ({ onEntradaRealizada }: RegistrarEntradaProps) => {
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [itensEntrada, setItensEntrada] = useState<ItemEntrada[]>([]);
  const [observacoes, setObservacoes] = useState('');
  const [tipoOperacaoId, setTipoOperacaoId] = useState('');
  const [popoverAberto, setPopoverAberto] = useState(false);
  const [busca, setBusca] = useState('');

  const { obterEstoque, registrarEntrada } = useEstoque();
  const { tiposOperacao } = useConfiguracoes();
  
  const itensDisponiveis = obterEstoque();

  // Filtrar apenas operações de entrada, excluindo "Devolução"
  const tiposOperacaoEntrada = tiposOperacao.filter(
    op => op.ativo && op.tipo === 'entrada' && !op.nome.toLowerCase().includes('devolução')
  );

  const adicionarItem = (item: EstoqueItem, quantidade: number) => {
    const itemExistente = itensEntrada.find(i => i.item.id === item.id);
    
    if (itemExistente) {
      setItensEntrada(prev => 
        prev.map(i => 
          i.item.id === item.id 
            ? { ...i, quantidade: i.quantidade + quantidade }
            : i
        )
      );
    } else {
      setItensEntrada(prev => [
        ...prev,
        { item, quantidade }
      ]);
    }
    
    setBusca('');
    setPopoverAberto(false);
  };

  const removerItem = (itemId: string) => {
    setItensEntrada(prev => prev.filter(i => i.item.id !== itemId));
  };

  const atualizarQuantidade = (itemId: string, novaQuantidade: number) => {
    if (novaQuantidade <= 0) {
      removerItem(itemId);
      return;
    }

    setItensEntrada(prev =>
      prev.map(i =>
        i.item.id === itemId
          ? { ...i, quantidade: novaQuantidade }
          : i
      )
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (itensEntrada.length === 0) {
      toast.error('Adicione pelo menos um item');
      return;
    }

    if (!tipoOperacaoId) {
      toast.error('Selecione o tipo de operação');
      return;
    }

    // Processar cada item
    let sucesso = true;
    for (const itemEntrada of itensEntrada) {
      const resultado = registrarEntrada(
        itemEntrada.item.codigoBarras,
        itemEntrada.quantidade,
        '',
        observacoes,
        tipoOperacaoId
      );
      
      if (!resultado) {
        sucesso = false;
        break;
      }
    }

    if (sucesso) {
      resetarFormulario();
      setDialogoAberto(false);
      onEntradaRealizada();
      toast.success(`Entrada registrada com sucesso! ${itensEntrada.length} item(ns) processado(s).`);
    }
  };

  const resetarFormulario = () => {
    setItensEntrada([]);
    setObservacoes('');
    setTipoOperacaoId('');
    setBusca('');
  };

  return (
    <Dialog open={dialogoAberto} onOpenChange={(open) => {
      setDialogoAberto(open);
      if (!open) resetarFormulario();
    }}>
      <DialogTrigger asChild>
        <Card className="cursor-pointer hover:scale-105 transition-all duration-300 border-info/20 hover:border-info/40">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-info/10 rounded-full flex items-center justify-center mb-4">
              <ArrowUp className="h-8 w-8 text-info" />
            </div>
            <CardTitle className="text-info">Entrada</CardTitle>
            <p className="text-sm text-info/80 mt-2">
              Registrar entrada de materiais
            </p>
          </CardHeader>
        </Card>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📥 Registrar Entrada</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Campo Tipo de Operação */}
          <div className="space-y-2">
            <Label htmlFor="tipoOperacao">Tipo de Operação *</Label>
            <Select value={tipoOperacaoId} onValueChange={setTipoOperacaoId} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de operação" />
              </SelectTrigger>
              <SelectContent>
                {tiposOperacaoEntrada.map(op => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.nome}
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
                          item.codigoBarras.toString().includes(busca)
                        )
                        .map((item) => (
                          <CommandItem
                            key={item.id}
                            onSelect={() => {
                              const quantidade = window.prompt('Quantidade de entrada:', '1');
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
          {itensEntrada.length > 0 && (
            <div className="space-y-2">
              <Label>Itens para Entrada ({itensEntrada.length})</Label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {itensEntrada.map((itemEntrada) => (
                  <Card key={itemEntrada.item.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{itemEntrada.item.nome}</div>
                          <div className="text-sm text-muted-foreground">
                            {itemEntrada.item.codigoBarras} - {itemEntrada.item.marca || 'Sem marca'} - Estoque atual: {itemEntrada.item.estoqueAtual} {itemEntrada.item.unidade}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={itemEntrada.quantidade}
                            onChange={(e) => atualizarQuantidade(itemEntrada.item.id, parseFloat(e.target.value))}
                            className="w-24"
                          />
                          <span className="text-sm text-muted-foreground min-w-[40px]">
                            {itemEntrada.item.unidade}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removerItem(itemEntrada.item.id)}
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
              placeholder="Observações gerais sobre esta entrada (opcional)"
              rows={3}
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setDialogoAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={itensEntrada.length === 0}>
              Registrar Entrada
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
