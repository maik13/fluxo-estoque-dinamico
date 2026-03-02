import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ClipboardList, Plus, Trash2, Eye, Printer, FileText, Check, X, ChevronsUpDown, Send } from 'lucide-react';
import { useEstoqueContext } from '@/contexts/EstoqueContext';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EstoqueItem } from '@/types/estoque';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ItemSolicitacaoMaterial {
  item_id?: string;
  nome_item: string;
  quantidade: number;
  unidade: string;
  item_snapshot?: any;
  observacoes?: string;
  isCustom: boolean; // true = item digitado manualmente
}

interface SolicitacaoMaterialCompleta {
  id: string;
  numero: number;
  solicitante_id: string;
  solicitante_nome: string;
  observacoes?: string;
  status: string;
  estoque_id?: string;
  aprovado_por_nome?: string;
  data_aprovacao?: string;
  created_at: string;
  updated_at: string;
  itens: {
    id: string;
    item_id?: string;
    nome_item: string;
    quantidade: number;
    unidade: string;
    item_snapshot?: any;
    observacoes?: string;
  }[];
}

export const SolicitacaoMaterial = () => {
  const [dialogoCriar, setDialogoCriar] = useState(false);
  const [dialogoListar, setDialogoListar] = useState(false);
  const [dialogoDetalhes, setDialogoDetalhes] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [itensLista, setItensLista] = useState<ItemSolicitacaoMaterial[]>([]);
  const [popoverAberto, setPopoverAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [quantidadeItem, setQuantidadeItem] = useState<number>(1);
  const [nomeItemCustom, setNomeItemCustom] = useState('');
  const [unidadeCustom, setUnidadeCustom] = useState('un');
  const [obsItem, setObsItem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoMaterialCompleta[]>([]);
  const [loadingSolicitacoes, setLoadingSolicitacoes] = useState(false);
  const [solicitacaoSelecionada, setSolicitacaoSelecionada] = useState<SolicitacaoMaterialCompleta | null>(null);
  const [pendentesCount, setPendentesCount] = useState(0);

  const { obterEstoque } = useEstoqueContext();
  const { user } = useAuth();
  const { userProfile, canManageStock } = usePermissions();
  const { obterEstoqueAtivoInfo } = useConfiguracoes();

  const itensEstoque = obterEstoque();

  // Carregar contagem de pendentes para badge
  useEffect(() => {
    if (!user) return;
    carregarPendentes();
    
    const channel = supabase
      .channel('solicitacoes-material-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes_material' }, () => {
        carregarPendentes();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const carregarPendentes = async () => {
    const estoqueInfo = obterEstoqueAtivoInfo();
    let query = supabase
      .from('solicitacoes_material')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pendente');
    if (estoqueInfo?.id) query = query.eq('estoque_id', estoqueInfo.id);
    const { count } = await query;
    setPendentesCount(count || 0);
  };

  const carregarSolicitacoes = async () => {
    setLoadingSolicitacoes(true);
    try {
      const estoqueInfo = obterEstoqueAtivoInfo();
      let query = supabase
        .from('solicitacoes_material')
        .select('*')
        .order('created_at', { ascending: false });
      if (estoqueInfo?.id) query = query.eq('estoque_id', estoqueInfo.id);
      
      const { data, error } = await query;
      if (error) throw error;

      const ids = (data || []).map(s => s.id);
      let itensData: any[] = [];
      if (ids.length > 0) {
        const { data: itens, error: itensError } = await supabase
          .from('solicitacao_material_itens')
          .select('*')
          .in('solicitacao_material_id', ids);
        if (itensError) throw itensError;
        itensData = itens || [];
      }

      const completas: SolicitacaoMaterialCompleta[] = (data || []).map(s => ({
        ...s,
        itens: itensData.filter(i => i.solicitacao_material_id === s.id)
      }));

      setSolicitacoes(completas);
    } catch (error) {
      console.error('Erro ao carregar solicitações de material:', error);
      toast.error('Erro ao carregar solicitações');
    } finally {
      setLoadingSolicitacoes(false);
    }
  };

  const itensFiltrados = useMemo(() => {
    if (!busca) return itensEstoque.slice(0, 50);
    const termo = busca.toLowerCase();
    return itensEstoque.filter(item =>
      item.nome.toLowerCase().includes(termo) ||
      item.codigoBarras.toString().includes(termo) ||
      item.marca?.toLowerCase().includes(termo)
    ).slice(0, 50);
  }, [busca, itensEstoque]);

  const adicionarItemEstoque = (item: EstoqueItem) => {
    if (itensLista.find(i => i.item_id === item.id)) {
      toast.error('Este item já foi adicionado');
      return;
    }
    setItensLista(prev => [...prev, {
      item_id: item.id,
      nome_item: item.nome,
      quantidade: quantidadeItem,
      unidade: item.unidade,
      item_snapshot: {
        id: item.id,
        nome: item.nome,
        codigoBarras: item.codigoBarras,
        marca: item.marca,
        unidade: item.unidade,
        especificacao: item.especificacao
      },
      observacoes: obsItem || undefined,
      isCustom: false
    }]);
    setPopoverAberto(false);
    setBusca('');
    setQuantidadeItem(1);
    setObsItem('');
    toast.success('Item adicionado');
  };

  const adicionarItemCustom = () => {
    if (!nomeItemCustom.trim()) {
      toast.error('Digite o nome do item');
      return;
    }
    setItensLista(prev => [...prev, {
      nome_item: nomeItemCustom.trim(),
      quantidade: quantidadeItem,
      unidade: unidadeCustom,
      observacoes: obsItem || undefined,
      isCustom: true
    }]);
    setNomeItemCustom('');
    setQuantidadeItem(1);
    setUnidadeCustom('un');
    setObsItem('');
    toast.success('Item personalizado adicionado');
  };

  const removerItem = (index: number) => {
    setItensLista(prev => prev.filter((_, i) => i !== index));
  };

  const criarSolicitacao = async () => {
    if (!user || !userProfile) {
      toast.error('Usuário não autenticado');
      return;
    }
    if (itensLista.length === 0) {
      toast.error('Adicione pelo menos um item');
      return;
    }

    setEnviando(true);
    try {
      const estoqueInfo = obterEstoqueAtivoInfo();
      const { data: solData, error: solError } = await supabase
        .from('solicitacoes_material')
        .insert({
          solicitante_id: user.id,
          solicitante_nome: userProfile.nome,
          observacoes: observacoes || null,
          estoque_id: estoqueInfo?.id || null,
          status: 'pendente'
        })
        .select()
        .single();

      if (solError) throw solError;

      const itensInsert = itensLista.map(item => ({
        solicitacao_material_id: solData.id,
        item_id: item.item_id || null,
        nome_item: item.nome_item,
        quantidade: item.quantidade,
        unidade: item.unidade,
        item_snapshot: item.item_snapshot || null,
        observacoes: item.observacoes || null
      }));

      const { error: itensError } = await supabase
        .from('solicitacao_material_itens')
        .insert(itensInsert);

      if (itensError) throw itensError;

      toast.success(`Solicitação #${solData.numero} criada com sucesso!`);
      setDialogoCriar(false);
      setItensLista([]);
      setObservacoes('');
    } catch (error) {
      console.error('Erro ao criar solicitação:', error);
      toast.error('Erro ao criar solicitação de material');
    } finally {
      setEnviando(false);
    }
  };

  const aprovarSolicitacao = async (id: string) => {
    if (!userProfile) return;
    try {
      const { error } = await supabase
        .from('solicitacoes_material')
        .update({
          status: 'aprovada',
          aprovado_por_id: user?.id,
          aprovado_por_nome: userProfile.nome,
          data_aprovacao: new Date().toISOString()
        })
        .eq('id', id);
      if (error) throw error;
      toast.success('Solicitação aprovada!');
      carregarSolicitacoes();
      if (solicitacaoSelecionada?.id === id) {
        setSolicitacaoSelecionada(prev => prev ? { ...prev, status: 'aprovada', aprovado_por_nome: userProfile.nome } : null);
      }
    } catch (error) {
      toast.error('Erro ao aprovar solicitação');
    }
  };

  const rejeitarSolicitacao = async (id: string) => {
    try {
      const { error } = await supabase
        .from('solicitacoes_material')
        .update({ status: 'rejeitada' })
        .eq('id', id);
      if (error) throw error;
      toast.success('Solicitação rejeitada');
      carregarSolicitacoes();
      if (solicitacaoSelecionada?.id === id) {
        setSolicitacaoSelecionada(prev => prev ? { ...prev, status: 'rejeitada' } : null);
      }
    } catch (error) {
      toast.error('Erro ao rejeitar solicitação');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente': return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pendente</Badge>;
      case 'aprovada': return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Aprovada</Badge>;
      case 'rejeitada': return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Rejeitada</Badge>;
      case 'convertida': return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Convertida em Retirada</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const imprimirSolicitacao = (sol: SolicitacaoMaterialCompleta) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const estoqueInfo = obterEstoqueAtivoInfo();
    const html = `
      <!DOCTYPE html>
      <html><head>
        <title>Solicitação de Material #${sol.numero}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          h1 { color: #1a5276; border-bottom: 2px solid #1a5276; padding-bottom: 10px; }
          .info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 20px 0; }
          .info-item { padding: 8px; background: #f8f9fa; border-radius: 4px; }
          .info-label { font-weight: bold; color: #555; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background: #1a5276; color: white; }
          tr:nth-child(even) { background: #f8f9fa; }
          .status { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
          .status-pendente { background: #fff3cd; color: #856404; }
          .status-aprovada { background: #d4edda; color: #155724; }
          .status-rejeitada { background: #f8d7da; color: #721c24; }
          .footer { margin-top: 40px; text-align: center; color: #999; font-size: 12px; }
          @media print { body { padding: 0; } }
        </style>
      </head><body>
        <h1>📋 Solicitação de Material #${sol.numero}</h1>
        <div class="info">
          <div class="info-item"><div class="info-label">Solicitante</div>${sol.solicitante_nome}</div>
          <div class="info-item"><div class="info-label">Data</div>${format(new Date(sol.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</div>
          <div class="info-item"><div class="info-label">Status</div><span class="status status-${sol.status}">${sol.status.toUpperCase()}</span></div>
          <div class="info-item"><div class="info-label">Estoque</div>${estoqueInfo?.nome || '-'}</div>
          ${sol.observacoes ? `<div class="info-item" style="grid-column: span 2"><div class="info-label">Observações</div>${sol.observacoes}</div>` : ''}
          ${sol.aprovado_por_nome ? `<div class="info-item"><div class="info-label">Aprovado por</div>${sol.aprovado_por_nome}</div>` : ''}
          ${sol.data_aprovacao ? `<div class="info-item"><div class="info-label">Data Aprovação</div>${format(new Date(sol.data_aprovacao), "dd/MM/yyyy HH:mm", { locale: ptBR })}</div>` : ''}
        </div>
        <table>
          <thead><tr><th>#</th><th>Item</th><th>Qtd</th><th>Unidade</th><th>Tipo</th><th>Obs</th></tr></thead>
          <tbody>
            ${sol.itens.map((item, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${item.nome_item}</td>
                <td>${item.quantidade}</td>
                <td>${item.unidade}</td>
                <td>${item.item_id ? 'Estoque' : 'Avulso'}</td>
                <td>${item.observacoes || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div style="margin-top: 60px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
          <div style="text-align: center; border-top: 1px solid #333; padding-top: 8px;">Solicitante</div>
          <div style="text-align: center; border-top: 1px solid #333; padding-top: 8px;">Almoxarifado</div>
        </div>
        <div class="footer">Impresso em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</div>
      </body></html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const gerarPDF = (sol: SolicitacaoMaterialCompleta) => {
    // Usar jsPDF para gerar PDF
    import('jspdf').then(({ default: jsPDF }) => {
      import('jspdf-autotable').then((autoTableModule) => {
        const doc = new jsPDF();
        const estoqueInfo = obterEstoqueAtivoInfo();
        
        doc.setFontSize(16);
        doc.text(`Solicitação de Material #${sol.numero}`, 14, 20);
        
        doc.setFontSize(10);
        doc.text(`Solicitante: ${sol.solicitante_nome}`, 14, 32);
        doc.text(`Data: ${format(new Date(sol.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, 38);
        doc.text(`Status: ${sol.status.toUpperCase()}`, 14, 44);
        doc.text(`Estoque: ${estoqueInfo?.nome || '-'}`, 14, 50);
        if (sol.observacoes) doc.text(`Obs: ${sol.observacoes}`, 14, 56);

        const startY = sol.observacoes ? 64 : 58;
        const tableData = sol.itens.map((item, i) => [
          i + 1,
          item.nome_item,
          item.quantidade,
          item.unidade,
          item.item_id ? 'Estoque' : 'Avulso',
          item.observacoes || '-'
        ]);

        (doc as any).autoTable({
          startY,
          head: [['#', 'Item', 'Qtd', 'Unidade', 'Tipo', 'Obs']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [26, 82, 118] }
        });

        doc.save(`solicitacao-material-${sol.numero}.pdf`);
        toast.success('PDF gerado com sucesso!');
      });
    });
  };

  return (
    <>
      {/* Botão no Menu Principal */}
      <Card
        className="cursor-pointer hover:scale-105 transition-all duration-300 border-amber-500/20 hover:border-amber-500/40 relative"
        onClick={() => {
          setDialogoListar(true);
          carregarSolicitacoes();
        }}
      >
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-amber-500/10">
            <ClipboardList className="h-8 w-8 text-amber-400" />
          </div>
          <CardTitle className="text-amber-400">Solicitação de Material</CardTitle>
          <CardDescription>Solicite materiais para aprovação do almoxarife</CardDescription>
          {pendentesCount > 0 && canManageStock && (
            <Badge className="absolute top-2 right-2 bg-red-500 text-white border-none animate-pulse">
              {pendentesCount}
            </Badge>
          )}
        </CardHeader>
      </Card>

      {/* Dialog Listar Solicitações */}
      <Dialog open={dialogoListar} onOpenChange={setDialogoListar}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-amber-400" />
              Solicitações de Material
            </DialogTitle>
          </DialogHeader>

          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-muted-foreground">
              {solicitacoes.length} solicitação(ões) encontrada(s)
            </p>
            <Button onClick={() => setDialogoCriar(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Nova Solicitação
            </Button>
          </div>

          {loadingSolicitacoes ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : solicitacoes.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma solicitação encontrada</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {solicitacoes.map(sol => (
                  <TableRow key={sol.id}>
                    <TableCell className="font-mono">#{sol.numero}</TableCell>
                    <TableCell>{sol.solicitante_nome}</TableCell>
                    <TableCell>{sol.itens.length} item(ns)</TableCell>
                    <TableCell>{format(new Date(sol.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                    <TableCell>{getStatusBadge(sol.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setSolicitacaoSelecionada(sol); setDialogoDetalhes(true); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => imprimirSolicitacao(sol)}>
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => gerarPDF(sol)}>
                          <FileText className="h-4 w-4" />
                        </Button>
                        {canManageStock && sol.status === 'pendente' && (
                          <>
                            <Button variant="ghost" size="icon" className="text-green-400 hover:text-green-300" onClick={() => aprovarSolicitacao(sol.id)}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300" onClick={() => rejeitarSolicitacao(sol.id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Detalhes da Solicitação */}
      <Dialog open={dialogoDetalhes} onOpenChange={setDialogoDetalhes}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {solicitacaoSelecionada && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  📋 Solicitação #{solicitacaoSelecionada.numero}
                  {getStatusBadge(solicitacaoSelecionada.status)}
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Solicitante:</span> {solicitacaoSelecionada.solicitante_nome}</div>
                <div><span className="text-muted-foreground">Data:</span> {format(new Date(solicitacaoSelecionada.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</div>
                {solicitacaoSelecionada.observacoes && (
                  <div className="col-span-2"><span className="text-muted-foreground">Observações:</span> {solicitacaoSelecionada.observacoes}</div>
                )}
                {solicitacaoSelecionada.aprovado_por_nome && (
                  <div><span className="text-muted-foreground">Aprovado por:</span> {solicitacaoSelecionada.aprovado_por_nome}</div>
                )}
              </div>

              <Separator />

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Obs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {solicitacaoSelecionada.itens.map((item, i) => (
                    <TableRow key={item.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-medium">{item.nome_item}</TableCell>
                      <TableCell>{item.quantidade}</TableCell>
                      <TableCell>{item.unidade}</TableCell>
                      <TableCell>
                        <Badge variant={item.item_id ? "default" : "secondary"}>
                          {item.item_id ? 'Estoque' : 'Avulso'}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.observacoes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-between pt-4">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => imprimirSolicitacao(solicitacaoSelecionada)} className="gap-2">
                    <Printer className="h-4 w-4" /> Imprimir
                  </Button>
                  <Button variant="outline" onClick={() => gerarPDF(solicitacaoSelecionada)} className="gap-2">
                    <FileText className="h-4 w-4" /> Baixar PDF
                  </Button>
                </div>
                {canManageStock && solicitacaoSelecionada.status === 'pendente' && (
                  <div className="flex gap-2">
                    <Button variant="outline" className="text-red-400 border-red-400/30" onClick={() => rejeitarSolicitacao(solicitacaoSelecionada.id)}>
                      <X className="h-4 w-4 mr-1" /> Rejeitar
                    </Button>
                    <Button className="bg-green-600 hover:bg-green-700" onClick={() => aprovarSolicitacao(solicitacaoSelecionada.id)}>
                      <Check className="h-4 w-4 mr-1" /> Aprovar
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Criar Nova Solicitação */}
      <Dialog open={dialogoCriar} onOpenChange={(open) => { setDialogoCriar(open); if (!open) { setItensLista([]); setObservacoes(''); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" /> Nova Solicitação de Material
            </DialogTitle>
          </DialogHeader>

          {/* Adicionar item do estoque */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Adicionar item do estoque</h3>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label>Item</Label>
                <Popover open={popoverAberto} onOpenChange={setPopoverAberto}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      Buscar item no estoque...
                      <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar por nome, código..." value={busca} onValueChange={setBusca} />
                      <CommandList>
                        <CommandEmpty>Nenhum item encontrado</CommandEmpty>
                        <CommandGroup>
                          {itensFiltrados.map(item => (
                            <CommandItem key={item.id} value={`${item.nome} ${item.codigoBarras}`} onSelect={() => adicionarItemEstoque(item)}>
                              <div className="flex justify-between w-full">
                                <span>{item.nome}</span>
                                <span className="text-xs text-muted-foreground">
                                  Cód: {item.codigoBarras} | Estoque: {item.estoqueAtual} {item.unidade}
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
              <div className="w-24">
                <Label>Qtd</Label>
                <Input type="number" min={1} value={quantidadeItem} onChange={(e) => setQuantidadeItem(Number(e.target.value))} />
              </div>
            </div>

            <Separator />

            {/* Adicionar item personalizado (não existe no estoque) */}
            <h3 className="text-sm font-medium">Ou adicionar item que não está no estoque</h3>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label>Nome do item</Label>
                <Input value={nomeItemCustom} onChange={(e) => setNomeItemCustom(e.target.value)} placeholder="Digite o nome do material necessário" />
              </div>
              <div className="w-24">
                <Label>Qtd</Label>
                <Input type="number" min={1} value={quantidadeItem} onChange={(e) => setQuantidadeItem(Number(e.target.value))} />
              </div>
              <div className="w-24">
                <Label>Unidade</Label>
                <Input value={unidadeCustom} onChange={(e) => setUnidadeCustom(e.target.value)} placeholder="un" />
              </div>
              <Button type="button" onClick={adicionarItemCustom} variant="secondary">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div>
              <Label>Observação do item (opcional)</Label>
              <Input value={obsItem} onChange={(e) => setObsItem(e.target.value)} placeholder="Ex: urgente, especificação..." />
            </div>

            <Separator />

            {/* Lista de itens adicionados */}
            {itensLista.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">Itens da solicitação ({itensLista.length})</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Qtd</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Obs</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itensLista.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{item.nome_item}</TableCell>
                        <TableCell>{item.quantidade}</TableCell>
                        <TableCell>{item.unidade}</TableCell>
                        <TableCell>
                          <Badge variant={item.isCustom ? "secondary" : "default"} className="text-xs">
                            {item.isCustom ? 'Avulso' : 'Estoque'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.observacoes || '-'}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removerItem(i)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div>
              <Label>Observações gerais</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Observações sobre a solicitação (opcional)" rows={2} />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setDialogoCriar(false)}>Cancelar</Button>
              <Button onClick={criarSolicitacao} disabled={enviando || itensLista.length === 0} className="gap-2">
                <Send className="h-4 w-4" />
                {enviando ? 'Enviando...' : 'Criar Solicitação'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
