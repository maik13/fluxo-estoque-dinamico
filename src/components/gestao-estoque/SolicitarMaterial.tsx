import { useState, useEffect } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Item } from '@/types/estoque';
import { NovoItemSolicitacao, SolicitacaoCompleta } from '@/types/solicitacao';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { materialRequestSchema } from '@/schemas/validation';

export const SolicitarMaterial = () => {
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [localUtilizacao, setLocalUtilizacao] = useState('');
  const [tipoOperacao, setTipoOperacao] = useState('retirada');
  const [itensSolicitados, setItensSolicitados] = useState<NovoItemSolicitacao[]>([]);
  const [popoverAberto, setPopoverAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [visualizarSolicitacoes, setVisualizarSolicitacoes] = useState(false);
  const [solicitacaoSelecionada, setSolicitacaoSelecionada] = useState<SolicitacaoCompleta | null>(null);
  const [detalhesAberto, setDetalhesAberto] = useState(false);
  const [codigoAssinatura, setCodigoAssinatura] = useState('');
  const [erroAssinatura, setErroAssinatura] = useState('');
  const [mostrarCodigoUsuario, setMostrarCodigoUsuario] = useState(false);
  const [solicitanteSelecionado, setSolicitanteSelecionado] = useState<{id: string, nome: string, codigo_barras?: string} | null>(null);
  const [solicitantesCarregados, setSolicitantesCarregados] = useState<{id: string, nome: string, codigo_barras?: string, email?: string}[]>([]);
  const [popoverSolicitanteAberto, setPopoverSolicitanteAberto] = useState(false);
  const [popoverLocalAberto, setPopoverLocalAberto] = useState(false);

  const { obterEstoque } = useEstoque();
  const { criarSolicitacao, solicitacoes, loading, atualizarAceites } = useSolicitacoes();
  const { canManageStock, userProfile } = usePermissions();
  const { obterTiposOperacaoAtivos, obterSolicitantesAtivos, obterLocaisUtilizacaoAtivos } = useConfiguracoes();
  
  const itensDisponiveis = obterEstoque();
  const tiposOperacaoDisponiveis = obterTiposOperacaoAtivos();
  const solicitantesDisponiveis = obterSolicitantesAtivos();
  const locaisDisponiveis = obterLocaisUtilizacaoAtivos();

  // Carregar solicitantes disponíveis
  useEffect(() => {
    const carregarSolicitantes = async () => {
      const { data, error } = await supabase
        .from('solicitantes')
        .select('id, nome, codigo_barras')
        .eq('ativo', true)
        .order('nome');
      
      if (error) {
        console.error('Erro ao carregar solicitantes:', error);
        toast.error('Erro ao carregar lista de solicitantes');
        return;
      }
      
      if (data) {
        console.log('Solicitantes carregados:', data);
        setSolicitantesCarregados(data);
      }
    };
    carregarSolicitantes();
  }, []);

  // Verificar se há retirada rápida pendente
  useEffect(() => {
    const retiradaPendente = sessionStorage.getItem('retirada_rapida');
    if (retiradaPendente) {
      try {
        const dados = JSON.parse(retiradaPendente);
        // Adicionar item à lista
        setItensSolicitados(prev => [...prev, {
          item_id: dados.item_id,
          quantidade_solicitada: dados.quantidade,
          item_snapshot: dados.item_snapshot
        }]);
        // Limpar sessionStorage
        sessionStorage.removeItem('retirada_rapida');
        // Abrir diálogo
        setDialogoAberto(true);
        toast.success('Item adicionado à solicitação');
      } catch (error) {
        console.error('Erro ao processar retirada rápida:', error);
      }
    }
  }, []);

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
    // Validar com zod
    const dadosParaValidar = {
      localUtilizacao: localUtilizacao || '',
      responsavelEstoque: userProfile?.nome || '',
      observacoes: observacoes || undefined,
      solicitanteId: solicitanteSelecionado?.id || '',
      codigoAssinatura: codigoAssinatura || '',
      itensSolicitados: itensSolicitados
    };

    const resultado = materialRequestSchema.safeParse(dadosParaValidar);
    
    if (!resultado.success) {
      const primeiroErro = resultado.error.errors[0];
      toast.error(primeiroErro.message);
      
      // Setar erro específico para assinatura
      if (primeiroErro.path.includes('codigoAssinatura')) {
        setErroAssinatura(primeiroErro.message);
      }
      
      console.error('Erros de validação:', resultado.error.errors);
      return;
    }

    // Validar assinatura específica do solicitante
    if (codigoAssinatura !== solicitanteSelecionado!.codigo_barras) {
      setErroAssinatura('Código de assinatura inválido para este solicitante');
      toast.error('Código de assinatura inválido');
      return;
    }

    const sucesso = await criarSolicitacao({
      observacoes,
      local_utilizacao_id: localUtilizacao,
      responsavel_estoque: userProfile?.nome || '',
      tipo_operacao: tipoOperacao,
      tipo_operacao_id: '4008ee81-3d16-4c38-a65d-078a6347f462',
      solicitante_id: solicitanteSelecionado!.id,
      solicitante_nome: solicitanteSelecionado!.nome,
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
    setTipoOperacao('retirada');
    setItensSolicitados([]);
    setBusca('');
    setCodigoAssinatura('');
    setErroAssinatura('');
    setMostrarCodigoUsuario(false);
    setSolicitanteSelecionado(null);
  };


  const abrirDetalhes = (solicitacao: SolicitacaoCompleta) => {
    setSolicitacaoSelecionada(solicitacao);
    setDetalhesAberto(true);
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
          
          ${solicitacao.local_utilizacao ? `<div class="info"><strong>Local de Utilização:</strong> ${solicitacao.local_utilizacao}</div>` : ''}
          
          ${solicitacao.responsavel_estoque ? `<div class="info"><strong>Responsável pelo Estoque:</strong> ${solicitacao.responsavel_estoque}</div>` : ''}
          
          ${solicitacao.tipo_operacao ? `<div class="info"><strong>Tipo de Operação:</strong> ${solicitacao.tipo_operacao.replace(/_/g, ' ')}</div>` : ''}
          
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

  return (
    <>
      <Dialog open={dialogoAberto} onOpenChange={(open) => {
        setDialogoAberto(open);
        if (!open) resetarFormulario();
      }}>
        <DialogTrigger asChild>
          <Card className="cursor-pointer hover:scale-105 transition-all duration-300 border-green-500/30 hover:border-green-400 bg-gradient-to-br from-green-950/20 to-emerald-950/20">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
                <Package className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-green-400 text-lg">Retirada de Material</CardTitle>
              <p className="text-sm text-green-500/80 mt-2">
                Solicite materiais do estoque para aprovação
              </p>
            </CardHeader>
          </Card>
        </DialogTrigger>

        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Retirada de Material</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Campo Solicitante */}
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
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[300px] p-0" align="start" sideOffset={4}>
                  <Command>
                    <CommandInput placeholder="Buscar solicitante..." />
                    <CommandList>
                      <CommandEmpty>Nenhum solicitante encontrado</CommandEmpty>
                      <CommandGroup>
                        {solicitantesCarregados
                          .sort((a, b) => a.nome.localeCompare(b.nome))
                          .map(solicitante => (
                            <CommandItem
                              key={solicitante.id}
                              onSelect={() => {
                                setSolicitanteSelecionado({ 
                                  id: solicitante.id, 
                                  nome: solicitante.nome,
                                  codigo_barras: solicitante.codigo_barras || undefined
                                });
                                setCodigoAssinatura('');
                                setErroAssinatura('');
                                setPopoverSolicitanteAberto(false);
                              }}
                            >
                              {solicitante.nome}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Campo Local de Utilização */}
            <div className="space-y-2">
              <Label htmlFor="localUtilizacao">Local onde será utilizado *</Label>
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
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[300px] p-0" align="start" sideOffset={4}>
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
                <PopoverContent 
                  className="w-[var(--radix-popover-trigger-width)] min-w-[400px] p-0" 
                  align="start" 
                  side="bottom"
                  sideOffset={4}
                  avoidCollisions={false}
                >
                  <Command className="flex flex-col">
                    <CommandInput 
                      placeholder="Buscar por nome ou código..." 
                      value={busca}
                      onValueChange={setBusca}
                      className="sticky top-0 z-10"
                    />
                    <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                    <CommandList className="max-h-[250px] overflow-y-auto">
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
                                  {item.codigoBarras} - {item.marca || 'Sem marca'} - Estoque: {item.estoqueAtual}
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
                                {item.codigoBarras} - {item.marca || 'Sem marca'}
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

            <Separator />

            {/* Assinatura Eletrônica */}
            <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between">
                <Label htmlFor="codigoAssinatura" className="text-base font-semibold">
                  Assinatura Eletrônica do Solicitante *
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMostrarCodigoUsuario(!mostrarCodigoUsuario)}
                  disabled={!solicitanteSelecionado?.codigo_barras}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {mostrarCodigoUsuario ? 'Ocultar' : 'Ver'} código
                </Button>
              </div>
              
              {mostrarCodigoUsuario && solicitanteSelecionado?.codigo_barras && (
                <div className="p-3 bg-background rounded border">
                  <p className="text-sm text-muted-foreground mb-2">
                    Código de assinatura de {solicitanteSelecionado.nome}:
                  </p>
                  <code className="text-lg font-mono font-bold text-primary">
                    {solicitanteSelecionado.codigo_barras}
                  </code>
                </div>
              )}

              <div className="space-y-2">
                <Input
                  id="codigoAssinatura"
                  type="text"
                  placeholder="Digite o código de assinatura do solicitante"
                  value={codigoAssinatura}
                  onChange={(e) => {
                    setCodigoAssinatura(e.target.value);
                    setErroAssinatura('');
                  }}
                  className={erroAssinatura ? 'border-destructive' : ''}
                />
                {erroAssinatura && (
                  <p className="text-sm text-destructive">{erroAssinatura}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Para confirmar a retirada, insira o código de assinatura do solicitante
                </p>
              </div>
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
                  disabled={
                    itensSolicitados.length === 0 || 
                    !solicitanteSelecionado || 
                    !localUtilizacao.trim() ||
                    !codigoAssinatura.trim()
                  }
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