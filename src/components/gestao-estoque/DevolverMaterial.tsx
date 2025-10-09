import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, PackageCheck, Plus } from 'lucide-react';
import { useEstoque } from '@/hooks/useEstoque';
import { useSolicitacoes } from '@/hooks/useSolicitacoes';
import { usePermissions } from '@/hooks/usePermissions';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { Item } from '@/types/estoque';
import { NovoItemSolicitacao } from '@/types/solicitacao';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const DevolverMaterial = () => {
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [localUtilizacao, setLocalUtilizacao] = useState('');
  const [responsavelEstoque, setResponsavelEstoque] = useState('');
  const [tipoOperacao, setTipoOperacao] = useState('devolucao');
  const [itensSolicitados, setItensSolicitados] = useState<NovoItemSolicitacao[]>([]);
  const [popoverAberto, setPopoverAberto] = useState(false);
  const [busca, setBusca] = useState('');

  const { obterEstoque } = useEstoque();
  const { criarSolicitacao } = useSolicitacoes();
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
    setTipoOperacao('devolucao');
    setItensSolicitados([]);
    setBusca('');
  };

  return (
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

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setDialogoAberto(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={itensSolicitados.length === 0 || !localUtilizacao}
              className="bg-teal-600 hover:bg-teal-700"
            >
              Registrar Devolução
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
