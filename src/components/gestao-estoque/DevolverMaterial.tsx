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
import { supabase } from '@/integrations/supabase/client';
import { NovoItemSolicitacao, SolicitacaoCompleta } from '@/types/solicitacao';
import { Item } from '@/types/estoque';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { materialReturnSchema } from '@/schemas/validation';

export const DevolverMaterial = () => {
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [itensDevolucao, setItensDevolucao] = useState<NovoItemSolicitacao[]>([]);
  const [localUtilizacao, setLocalUtilizacao] = useState('');
  const [responsavelEstoque, setResponsavelEstoque] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [popoverAberto, setPopoverAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [codigoAssinatura, setCodigoAssinatura] = useState('');
  const [erroAssinatura, setErroAssinatura] = useState('');
  const [mostrarCodigoUsuario, setMostrarCodigoUsuario] = useState(false);
  const [solicitanteSelecionado, setSolicitanteSelecionado] = useState<{id: string, nome: string, codigo_barras?: string} | null>(null);
  const [usuariosDisponiveis, setUsuariosDisponiveis] = useState<{id: string, nome: string, user_id: string, codigo_barras?: string}[]>([]);
  const [popoverSolicitanteAberto, setPopoverSolicitanteAberto] = useState(false);
  const [popoverLocalAberto, setPopoverLocalAberto] = useState(false);

  const { criarSolicitacao } = useSolicitacoes();
  const { userProfile } = usePermissions();
  const { obterEstoque } = useEstoque();
  const { obterLocaisUtilizacaoAtivos } = useConfiguracoes();

  const itensEstoque = obterEstoque();
  const locaisDisponiveis = obterLocaisUtilizacaoAtivos();

  // Carregar todos os solicitantes disponíveis da tabela solicitantes
  useEffect(() => {
    const carregarSolicitantes = async () => {
      // Buscar todos os solicitantes ativos
      const { data: solicitantesData } = await supabase
        .from('solicitantes')
        .select('id, nome, codigo_barras')
        .eq('ativo', true)
        .order('nome');
      
      if (solicitantesData) {
        // Mapear para o formato esperado
        const solicitantesFormatados = solicitantesData.map(s => ({
          id: s.id,
          nome: s.nome,
          user_id: s.id,
          codigo_barras: s.codigo_barras
        }));
        
        setUsuariosDisponiveis(solicitantesFormatados);
        
        // Define o usuário atual como padrão se ele estiver na lista
        if (userProfile) {
          const usuarioNaLista = solicitantesFormatados.find(s => s.id === userProfile.id);
          if (usuarioNaLista) {
            setSolicitanteSelecionado({ 
              id: userProfile.id, 
              nome: userProfile.nome,
              codigo_barras: usuarioNaLista.codigo_barras
            });
          }
        }
      }
    };
    carregarSolicitantes();
  }, [userProfile]);

  const resetarFormulario = () => {
    setItensDevolucao([]);
    setLocalUtilizacao('');
    setResponsavelEstoque('');
    setObservacoes('');
    setBusca('');
    setCodigoAssinatura('');
    setErroAssinatura('');
    setMostrarCodigoUsuario(false);
    // Redefine para o usuário atual
    if (userProfile && usuariosDisponiveis.length > 0) {
      const usuarioNaLista = usuariosDisponiveis.find(u => u.id === userProfile.id);
      if (usuarioNaLista) {
        setSolicitanteSelecionado({ 
          id: userProfile.id, 
          nome: userProfile.nome,
          codigo_barras: usuarioNaLista.codigo_barras
        });
      }
    }
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
    // Validar com zod
    const resultado = materialReturnSchema.safeParse({
      localUtilizacao: localUtilizacao || '',
      responsavelEstoque: userProfile?.nome || '',
      observacoes: observacoes || undefined,
      solicitanteId: solicitanteSelecionado?.id || '',
      codigoAssinatura: codigoAssinatura || '',
      itensDevolucao: itensDevolucao
    });
    
    if (!resultado.success) {
      toast.error(resultado.error.errors[0].message);
      if (resultado.error.errors[0].path.includes('codigoAssinatura')) {
        setErroAssinatura(resultado.error.errors[0].message);
      }
      return;
    }

    if (codigoAssinatura !== solicitanteSelecionado!.codigo_barras) {
      setErroAssinatura('Código de assinatura inválido');
      toast.error('Código de assinatura inválido');
      return;
    }

    if (!localUtilizacao) {
      toast.error('Informe o local de origem da devolução');
      return;
    }

    if (!solicitanteSelecionado) {
      toast.error('Por favor, selecione o solicitante');
      return;
    }

    // Validar assinatura eletrônica
    if (!codigoAssinatura) {
      setErroAssinatura('Código de assinatura é obrigatório');
      toast.error('Informe o código de assinatura');
      return;
    }

    if (!solicitanteSelecionado?.codigo_barras) {
      setErroAssinatura('Solicitante não possui código de barras cadastrado');
      toast.error('Solicitante não possui código de barras cadastrado');
      return;
    }

    if (codigoAssinatura !== solicitanteSelecionado.codigo_barras) {
      setErroAssinatura('Código de assinatura inválido');
      toast.error('Código de assinatura inválido');
      return;
    }

    setErroAssinatura('');

    const sucesso = await criarSolicitacao({
      observacoes,
      local_utilizacao_id: localUtilizacao,
      responsavel_estoque: userProfile?.nome || '',
      tipo_operacao: 'devolucao',
      tipo_operacao_id: '8462f967-121e-4a0a-8d43-5e7131fc1981',
      solicitante_id: solicitanteSelecionado.id,
      solicitante_nome: solicitanteSelecionado.nome,
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
      item.codigoBarras.toString().includes(termo) ||
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
            Informe os dados da devolução e os itens que está devolvendo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações da Devolução */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">1. Informações da devolução</Label>
                
                <div className="space-y-2">
                  <Label htmlFor="solicitante">Solicitante *</Label>
                  <Popover open={popoverSolicitanteAberto} onOpenChange={setPopoverSolicitanteAberto}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                      >
                        {solicitanteSelecionado ? solicitanteSelecionado.nome : "Selecione o solicitante"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar solicitante..." />
                        <CommandList>
                          <CommandEmpty>Nenhum solicitante encontrado</CommandEmpty>
                          <CommandGroup>
                            {usuariosDisponiveis
                              .sort((a, b) => a.nome.localeCompare(b.nome))
                              .map(usuario => (
                                <CommandItem
                                  key={usuario.id}
                                  onSelect={() => {
                                    setSolicitanteSelecionado({ 
                                      id: usuario.id, 
                                      nome: usuario.nome,
                                      codigo_barras: usuario.codigo_barras
                                    });
                                    setPopoverSolicitanteAberto(false);
                                  }}
                                >
                                  {usuario.nome}
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="localUtilizacao">Local de origem *</Label>
                  <Popover open={popoverLocalAberto} onOpenChange={setPopoverLocalAberto}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                      >
                        {localUtilizacao 
                          ? locaisDisponiveis.find(l => l.id === localUtilizacao)?.nome 
                          : "Selecione o local"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar local..." />
                        <CommandList>
                          <CommandEmpty>Nenhum local encontrado</CommandEmpty>
                          <CommandGroup>
                            {locaisDisponiveis.map(local => (
                              <CommandItem
                                key={local.id}
                                onSelect={() => {
                                  setLocalUtilizacao(local.id);
                                  setPopoverLocalAberto(false);
                                }}
                              >
                                {local.nome}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
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
                        placeholder="Digite seu código de assinatura"
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
                  {mostrarCodigoUsuario && solicitanteSelecionado?.codigo_barras && (
                    <div className="p-3 bg-muted rounded-md">
                      <p className="text-sm font-medium">Código do solicitante: {solicitanteSelecionado.codigo_barras}</p>
                    </div>
                  )}
                  {mostrarCodigoUsuario && !solicitanteSelecionado?.codigo_barras && (
                    <div className="p-3 bg-muted rounded-md">
                      <p className="text-sm text-muted-foreground">Solicitante não possui código de barras cadastrado</p>
                    </div>
                  )}
                </div>
              </div>

          {/* Itens da Devolução */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-base font-semibold">2. Itens para devolução</Label>
                  
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
                            {itensFiltrarados.map(item => (
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
                                    {item.codigoBarras} - {item.marca || 'Sem marca'}
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
                  Nenhum item adicionado. Clique em "Adicionar item" para começar.
                </p>
              </Card>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Código</TableHead>
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
              disabled={itensDevolucao.length === 0 || !localUtilizacao || !codigoAssinatura}
            >
              Registrar Devolução
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
