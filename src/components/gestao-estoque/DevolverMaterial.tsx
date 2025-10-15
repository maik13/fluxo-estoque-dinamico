import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PackageCheck, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSolicitacoes } from '@/hooks/useSolicitacoes';
import { usePermissions } from '@/hooks/usePermissions';
import { useEstoque } from '@/hooks/useEstoque';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { NovoItemSolicitacao, SolicitacaoCompleta } from '@/types/solicitacao';
import { Item } from '@/types/estoque';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

export const DevolverMaterial = () => {
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [retiradaSelecionada, setRetiradaSelecionada] = useState<SolicitacaoCompleta | null>(null);
  const [itensDevolucao, setItensDevolucao] = useState<NovoItemSolicitacao[]>([]);
  const [localUtilizacao, setLocalUtilizacao] = useState('');
  const [responsavelEstoque, setResponsavelEstoque] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [popoverAberto, setPopoverAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [codigoAssinatura, setCodigoAssinatura] = useState('');
  const [erroAssinatura, setErroAssinatura] = useState('');
  const [mostrarCodigoUsuario, setMostrarCodigoUsuario] = useState(false);

  const { solicitacoes, criarSolicitacao } = useSolicitacoes();
  const { userProfile } = usePermissions();
  const { obterEstoque } = useEstoque();
  const { obterLocaisUtilizacaoAtivos } = useConfiguracoes();

  const itensEstoque = obterEstoque();
  const locaisDisponiveis = obterLocaisUtilizacaoAtivos();

  // Filtrar retiradas aprovadas que podem ser devolvidas
  const retiradasDisponiveis = solicitacoes.filter(s => {
    // Deve estar aprovada
    if (s.status !== 'aprovada') return false;
    
    // Não deve ser uma devolução
    if (s.tipo_operacao === 'devolucao' || s.tipo_operacao === 'devolucao_estoque') return false;
    
    // Não deve ter devolução já criada
    const jaPossuiDevolucao = solicitacoes.some(dev => 
      dev.solicitacao_origem_id === s.id && 
      (dev.tipo_operacao === 'devolucao' || dev.tipo_operacao === 'devolucao_estoque')
    );
    
    return !jaPossuiDevolucao;
  });

  const resetarFormulario = () => {
    setRetiradaSelecionada(null);
    setItensDevolucao([]);
    setLocalUtilizacao('');
    setResponsavelEstoque('');
    setObservacoes('');
    setBusca('');
    setCodigoAssinatura('');
    setErroAssinatura('');
    setMostrarCodigoUsuario(false);
  };

  const selecionarRetirada = (retirada: SolicitacaoCompleta) => {
    setRetiradaSelecionada(retirada);
    setLocalUtilizacao(retirada.local_utilizacao || '');
    
    // Pré-carregar itens da retirada como sugestão
    const itensSugeridos: NovoItemSolicitacao[] = retirada.itens.map(item => ({
      item_id: item.item_id,
      quantidade_solicitada: item.quantidade_aprovada,
      item_snapshot: item.item_snapshot
    }));
    setItensDevolucao(itensSugeridos);
    
    toast.success(`Retirada selecionada. Itens carregados para devolução.`);
  };

  const adicionarItem = (item: Item, quantidade: number) => {
    const itemExistente = itensDevolucao.find(i => i.item_id === item.id);
    
    if (itemExistente) {
      setItensDevolucao(prev =>
        prev.map(i =>
          i.item_id === item.id
            ? { ...i, quantidade_solicitada: i.quantidade_solicitada + quantidade }
            : i
        )
      );
    } else {
      setItensDevolucao(prev => [
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
            marca: item.marca
          }
        }
      ]);
    }
    
    setBusca('');
    setPopoverAberto(false);
  };

  const removerItem = (itemId: string) => {
    setItensDevolucao(prev => prev.filter(i => i.item_id !== itemId));
  };

  const atualizarQuantidade = (itemId: string, novaQuantidade: number) => {
    if (novaQuantidade <= 0) {
      removerItem(itemId);
      return;
    }
    
    setItensDevolucao(prev =>
      prev.map(i =>
        i.item_id === itemId
          ? { ...i, quantidade_solicitada: novaQuantidade }
          : i
      )
    );
  };

  const handleSubmit = async () => {
    if (!retiradaSelecionada) {
      toast.error('Selecione a retirada original');
      return;
    }

    if (itensDevolucao.length === 0) {
      toast.error('Adicione pelo menos um item para devolução');
      return;
    }

    if (!localUtilizacao) {
      toast.error('Informe o local de origem da devolução');
      return;
    }

    // Validar assinatura eletrônica
    if (!codigoAssinatura) {
      setErroAssinatura('Código de assinatura é obrigatório');
      toast.error('Informe o código de assinatura');
      return;
    }

    if (codigoAssinatura !== userProfile?.codigo_assinatura) {
      setErroAssinatura('Código de assinatura inválido');
      toast.error('Código de assinatura inválido');
      return;
    }

    setErroAssinatura('');

    const sucesso = await criarSolicitacao({
      observacoes,
      local_utilizacao: localUtilizacao,
      responsavel_estoque: responsavelEstoque,
      tipo_operacao: 'devolucao',
      solicitacao_origem_id: retiradaSelecionada.id,
      itens: itensDevolucao
    });

    if (sucesso) {
      toast.success('Devolução registrada com sucesso!');
      resetarFormulario();
      setDialogoAberto(false);
    }
  };

  const itensFiltrarados = itensEstoque.filter(item => {
    if (!busca) return true;
    const termo = busca.toLowerCase();
    return (
      item.nome.toLowerCase().includes(termo) ||
      item.codigoBarras.toLowerCase().includes(termo) ||
      (item.marca && item.marca.toLowerCase().includes(termo))
    );
  });

  return (
    <Dialog open={dialogoAberto} onOpenChange={(open) => {
      setDialogoAberto(open);
      if (!open) resetarFormulario();
    }}>
      <DialogTrigger asChild>
        <Card className="cursor-pointer hover:scale-105 transition-all duration-300 border-teal-500/30 hover:border-teal-400 bg-gradient-to-br from-teal-950/20 to-cyan-950/20">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
              <PackageCheck className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-teal-400 text-lg">Devolução de Material</CardTitle>
            <p className="text-sm text-teal-500/80 mt-2">
              Registre devoluções de materiais ao estoque
            </p>
          </CardHeader>
        </Card>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Devolução de Material</DialogTitle>
          <DialogDescription>
            Selecione a retirada original e os itens que está devolvendo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Etapa 1: Seleção da Retirada */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">1. Selecione a retirada original</Label>
            
            {retiradasDisponiveis.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-muted-foreground">
                  Nenhuma retirada aprovada disponível para devolução
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  As retiradas devem estar aprovadas e ainda não terem sido devolvidas
                </p>
              </Card>
            ) : retiradaSelecionada ? (
              <Card className="p-4 border-primary bg-primary/5">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">
                      Retirada #{retiradaSelecionada.numero || retiradaSelecionada.id.slice(-8)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(retiradaSelecionada.data_solicitacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                    <div className="text-sm mt-1">
                      {retiradaSelecionada.itens.length} {retiradaSelecionada.itens.length === 1 ? 'item' : 'itens'} retirados
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRetiradaSelecionada(null)}
                  >
                    Alterar
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {retiradasDisponiveis.map(retirada => (
                  <Card
                    key={retirada.id}
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => selecionarRetirada(retirada)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center">
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
                        <Button type="button" variant="outline" size="sm">
                          Selecionar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {retiradaSelecionada && (
            <>
              {/* Etapa 2: Informações da Devolução */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">2. Informações da devolução</Label>
                
                <div className="space-y-2">
                  <Label htmlFor="solicitante">Solicitante</Label>
                  <Input
                    id="solicitante"
                    value={userProfile?.nome || 'Carregando...'}
                    disabled
                    readOnly
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="localUtilizacao">Local de origem *</Label>
                  <Select value={localUtilizacao} onValueChange={setLocalUtilizacao}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o local" />
                    </SelectTrigger>
                    <SelectContent>
                      {locaisDisponiveis.map(local => (
                        <SelectItem key={local.id} value={local.nome}>
                          {local.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="responsavelEstoque">Responsável pelo recebimento</Label>
                  <Input
                    id="responsavelEstoque"
                    value={responsavelEstoque}
                    onChange={(e) => setResponsavelEstoque(e.target.value)}
                    placeholder="Nome do responsável"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Informações adicionais sobre a devolução"
                    rows={3}
                  />
                </div>

                {/* Assinatura Eletrônica */}
                <div className="space-y-2">
                  <Label htmlFor="codigoAssinatura">Assinatura Eletrônica *</Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        id="codigoAssinatura"
                        type="text"
                        value={codigoAssinatura}
                        onChange={(e) => {
                          setCodigoAssinatura(e.target.value);
                          setErroAssinatura('');
                        }}
                        placeholder="Digite seu código de 8 dígitos"
                        maxLength={8}
                        className={erroAssinatura ? 'border-destructive' : ''}
                      />
                      {erroAssinatura && (
                        <p className="text-sm text-destructive mt-1">{erroAssinatura}</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setMostrarCodigoUsuario(!mostrarCodigoUsuario)}
                      className="shrink-0"
                    >
                      {mostrarCodigoUsuario ? 'Ocultar' : 'Ver meu código'}
                    </Button>
                  </div>
                  {mostrarCodigoUsuario && userProfile?.codigo_assinatura && (
                    <div className="p-3 bg-muted rounded-md">
                      <p className="text-sm font-medium">Seu código: {userProfile.codigo_assinatura}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Etapa 3: Itens da Devolução */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-base font-semibold">3. Itens para devolução</Label>
                  
                  <Popover open={popoverAberto} onOpenChange={setPopoverAberto}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar item
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="end">
                      <Command>
                        <CommandInput
                          placeholder="Buscar item..."
                          value={busca}
                          onValueChange={setBusca}
                        />
                        <CommandList>
                          <CommandEmpty>Nenhum item encontrado</CommandEmpty>
                          <CommandGroup>
                            {itensFiltrarados.slice(0, 10).map(item => (
                              <CommandItem
                                key={item.id}
                                onSelect={() => {
                                  const qtd = prompt(`Quantidade de ${item.nome} (${item.unidade}):`, '1');
                                  if (qtd && !isNaN(Number(qtd))) {
                                    adicionarItem(item, Number(qtd));
                                  }
                                }}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{item.nome}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {item.codigoBarras} - {item.categoria}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {itensDevolucao.length === 0 ? (
                  <Card className="p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      Nenhum item adicionado. Os itens da retirada foram pré-carregados.
                    </p>
                  </Card>
                ) : (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Código</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead className="w-32">Quantidade</TableHead>
                          <TableHead className="w-20">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itensDevolucao.map(item => (
                          <TableRow key={item.item_id}>
                            <TableCell className="font-medium">
                              {item.item_snapshot.nome}
                            </TableCell>
                            <TableCell>{item.item_snapshot.codigoBarras}</TableCell>
                            <TableCell>{item.item_snapshot.categoria}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantidade_solicitada}
                                onChange={(e) => atualizarQuantidade(item.item_id, Number(e.target.value))}
                                className="w-24"
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removerItem(item.item_id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Botão de Envio */}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogoAberto(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!retiradaSelecionada || itensDevolucao.length === 0 || !localUtilizacao || !codigoAssinatura}
                >
                  Registrar Devolução
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
