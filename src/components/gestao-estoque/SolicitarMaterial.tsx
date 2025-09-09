import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Package, Plus } from 'lucide-react';
import { useEstoque } from '@/hooks/useEstoque';
import { useSolicitacoes } from '@/hooks/useSolicitacoes';
import { Item } from '@/types/estoque';
import { NovoItemSolicitacao } from '@/types/solicitacao';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export const SolicitarMaterial = () => {
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [itensSolicitados, setItensSolicitados] = useState<NovoItemSolicitacao[]>([]);
  const [popoverAberto, setPopoverAberto] = useState(false);
  const [busca, setBusca] = useState('');

  const { obterEstoque } = useEstoque();
  const { criarSolicitacao } = useSolicitacoes();
  
  const itensDisponiveis = obterEstoque();

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
      itens: itensSolicitados
    });

    if (sucesso) {
      setObservacoes('');
      setItensSolicitados([]);
      setDialogoAberto(false);
    }
  };

  const resetarFormulario = () => {
    setObservacoes('');
    setItensSolicitados([]);
    setBusca('');
  };

  return (
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
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => setDialogoAberto(false)}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={itensSolicitados.length === 0}
            >
              Enviar Solicitação
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};