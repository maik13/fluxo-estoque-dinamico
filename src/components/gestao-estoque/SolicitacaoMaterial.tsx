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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ClipboardList, Plus, Trash2, Eye, Printer, FileText, Check, X, ChevronsUpDown, Send, ArrowRight } from 'lucide-react';
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
import { ItemFotoMiniatura } from './ItemFotoMiniatura';

interface ItemSolicitacaoMaterial {
  item_id?: string;
  nome_item: string;
  quantidade: number;
  unidade: string;
  item_snapshot?: any;
  observacoes?: string;
  isCustom: boolean;
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
  const { userProfile, canManageStock, isAdmin } = usePermissions();
  const { obterEstoqueAtivoInfo } = useConfiguracoes();

  const itensEstoque = obterEstoque();
  const mapaEstoque = useMemo(
    () => new Map(itensEstoque.map((item) => [item.id, item])),
    [itensEstoque]
  );

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

  const itemVaiParaCompra = (item: { item_id?: string; quantidade: number; isCustom?: boolean }) => {
    if (!item.item_id || item.isCustom) return true;

    const itemEstoque = mapaEstoque.get(item.item_id);
    if (!itemEstoque) return true;

    return itemEstoque.estoqueAtual < item.quantidade;
  };

  const obterItensParaPedidoCompra = (itens: Array<{ item_id?: string; quantidade: number; isCustom?: boolean }>) => {
    return itens.filter(itemVaiParaCompra);
  };

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
        especificacao: item.especificacao,
        fotoUrl: item.fotoUrl,
      },
      observacoes: obsItem || undefined,
      isCustom: false
    }]);

    setPopoverAberto(false);
    setBusca('');
    setQuantidadeItem(1);
    setObsItem('');
    toast.success(item.estoqueAtual < quantidadeItem ? 'Item sem saldo suficiente: será enviado para compra.' : 'Item adicionado');
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
    toast.success('Item avulso adicionado ao Pedido de Compra');
  };

  const removerItem = (index: number) => {
    setItensLista(prev => prev.filter((_, i) => i !== index));
  };

  const limparFormularioCriacao = () => {
    setItensLista([]);
    setObservacoes('');
    setBusca('');
    setQuantidadeItem(1);
    setNomeItemCustom('');
    setUnidadeCustom('un');
    setObsItem('');
    setPopoverAberto(false);
  };

  const abrirPedidoCompra = (pedidoId: string, pedidoNumero: number) => {
    if (typeof window === 'undefined') return;

    const payload = { pedidoId, pedidoNumero, timestamp: Date.now() };
    sessionStorage.setItem('pedido_compra_redirect', JSON.stringify(payload));
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('pedido-compra:abrir', { detail: payload }));
    }, 500);
  };

  const criarPedidoCompraAutomatico = async (
    solicitacao: SolicitacaoMaterialCompleta,
    itensParaCompra: SolicitacaoMaterialCompleta['itens'],
    contextoErro: 'criacao' | 'aprovacao'
  ): Promise<{ id: string; numero: number; jaExistia: boolean } | null> => {
    if (!user || !userProfile || itensParaCompra.length === 0) return null;

    try {
      const { data: pedidoExistente, error: pedidoExistenteError } = await supabase
        .from('pedidos_compra')
        .select('id, numero')
        .eq('solicitacao_material_id', solicitacao.id)
        .maybeSingle();

      if (pedidoExistenteError) throw pedidoExistenteError;

      if (pedidoExistente) {
        return {
          id: pedidoExistente.id,
          numero: pedidoExistente.numero,
          jaExistia: true,
        };
      }

      const estoqueInfo = obterEstoqueAtivoInfo();
      const { data: pedidoData, error: pedidoError } = await supabase
        .from('pedidos_compra')
        .insert({
          criado_por_id: user.id,
          criado_por_nome: userProfile.nome,
          observacoes: `Gerado automaticamente a partir da Solicitação de Material #${solicitacao.numero}`,
          estoque_id: estoqueInfo?.id || null,
          status: 'aberto',
          solicitacao_material_id: solicitacao.id,
          solicitacao_material_numero: solicitacao.numero
        })
        .select()
        .single();

      if (pedidoError) throw pedidoError;

      const itensInsert = itensParaCompra.map(item => ({
        pedido_id: pedidoData.id,
        item_id: item.item_id || null,
        nome_item: item.nome_item,
        quantidade: item.quantidade,
        item_snapshot: item.item_snapshot || { nome: item.nome_item, unidade: item.unidade },
        status: 'pendente'
      }));

      const { error: itensError } = await supabase
        .from('pedido_compra_itens')
        .insert(itensInsert);

      if (itensError) throw itensError;

      return {
        id: pedidoData.id,
        numero: pedidoData.numero,
        jaExistia: false,
      };
    } catch (error) {
      console.error('Erro ao criar pedido de compra automático:', error);
      toast.error(
        contextoErro === 'criacao'
          ? 'Solicitação criada, mas houve erro ao encaminhar o item para o Pedido de Compra'
          : 'Solicitação aprovada, mas houve erro ao gerar o Pedido de Compra automático'
      );
      return null;
    }
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

      const solicitacaoCriada: SolicitacaoMaterialCompleta = {
        ...solData,
        observacoes: solData.observacoes || undefined,
        estoque_id: solData.estoque_id || undefined,
        aprovado_por_nome: solData.aprovado_por_nome || undefined,
        data_aprovacao: solData.data_aprovacao || undefined,
        itens: itensInsert.map((item, index) => ({
          id: `${index}`,
          item_id: item.item_id || undefined,
          nome_item: item.nome_item,
          quantidade: item.quantidade,
          unidade: item.unidade,
          item_snapshot: item.item_snapshot || undefined,
          observacoes: item.observacoes || undefined,
        })),
      };

      const itensParaCompra = obterItensParaPedidoCompra(
        solicitacaoCriada.itens.map((item) => ({ ...item, isCustom: !item.item_id }))
      );
      const podeGerarPedidoAutomatico = canManageStock() && itensParaCompra.length > 0;

      let pedidoCriado: { id: string; numero: number; jaExistia: boolean } | null = null;
      if (podeGerarPedidoAutomatico) {
        pedidoCriado = await criarPedidoCompraAutomatico(solicitacaoCriada, itensParaCompra, 'criacao');
      }

      if (pedidoCriado) {
        toast.success(
          pedidoCriado.jaExistia
            ? `Solicitação #${solData.numero} vinculada ao Pedido de Compra #${pedidoCriado.numero}.`
            : `Solicitação #${solData.numero} criada e enviada ao Pedido de Compra #${pedidoCriado.numero}.`,
          { duration: 6000 }
        );
        setDialogoListar(false);
        abrirPedidoCompra(pedidoCriado.id, pedidoCriado.numero);
      } else {
        toast.success(`Solicitação #${solData.numero} criada com sucesso!`);
        if (itensParaCompra.length > 0 && !canManageStock()) {
          toast.info('Itens avulsos ou sem saldo serão enviados ao Pedido de Compra na aprovação.');
        }
      }

      setDialogoCriar(false);
      limparFormularioCriacao();
    } catch (error) {
      console.error('Erro ao criar solicitação:', error);
      toast.error('Erro ao criar solicitação de material');
    } finally {
      setEnviando(false);
    }
  };

  const aprovarSolicitacao = async (id: string) => {
    if (!userProfile || !user) return;
    try {
      const solicitacao = solicitacoes.find(s => s.id === id);

      const { error } = await supabase
        .from('solicitacoes_material')
        .update({
          status: 'aprovada',
          aprovado_por_id: user.id,
          aprovado_por_nome: userProfile.nome,
          data_aprovacao: new Date().toISOString()
        })
        .eq('id', id);
      if (error) throw error;

      let pedidoCriado: { id: string; numero: number; jaExistia: boolean } | null = null;
      if (solicitacao) {
        const itensParaCompra = obterItensParaPedidoCompra(
          solicitacao.itens.map((item) => ({ ...item, isCustom: !item.item_id }))
        );
        if (itensParaCompra.length > 0) {
          pedidoCriado = await criarPedidoCompraAutomatico(solicitacao, itensParaCompra, 'aprovacao');
        }
      }

      toast.success(
        pedidoCriado
          ? pedidoCriado.jaExistia
            ? `Solicitação aprovada! Pedido de Compra #${pedidoCriado.numero} já estava vinculado.`
            : `Solicitação aprovada! Pedido de Compra #${pedidoCriado.numero} gerado automaticamente.`
          : 'Solicitação aprovada!'
      );

      carregarSolicitacoes();
      if (solicitacaoSelecionada?.id === id) {
        setSolicitacaoSelecionada(prev => prev ? { ...prev, status: 'aprovada', aprovado_por_nome: userProfile.nome } : null);
      }
    } catch (error) {
      console.error('Erro ao aprovar solicitação:', error);
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

  const excluirSolicitacao = async (id: string) => {
    try {
      const { error } = await supabase
        .from('solicitacoes_material')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Solicitação excluída');
      carregarSolicitacoes();
      if (solicitacaoSelecionada?.id === id) {
        setSolicitacaoSelecionada(null);
        setDialogoDetalhes(false);
      }
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast.error('Erro ao excluir solicitação');
    }
  };

  const converterEmRetirada = async (sol: SolicitacaoMaterialCompleta) => {
    if (!user || !userProfile) {
      toast.error('Usuário não autenticado');
      return;
    }

    try {
      const estoqueInfo = obterEstoqueAtivoInfo();

      // Filtrar apenas itens que existem no estoque (com item_id)
      const itensEstoqueOnly = sol.itens.filter(i => i.item_id);

      if (itensEstoqueOnly.length === 0) {
        toast.error('Nenhum item desta solicitação existe no estoque para retirada');
        return;
      }

      // Criar solicitação de retirada
      const { data: solicitacaoData, error: solicitacaoError } = await supabase
        .from('solicitacoes')
        .insert({
          solicitante_id: sol.solicitante_id,
          solicitante_nome: sol.solicitante_nome,
          observacoes: `Convertida da Solicitação de Material #${sol.numero}${sol.observacoes ? ' - ' + sol.observacoes : ''}`,
          tipo_operacao: 'retirada',
          criado_por_id: user.id,
          estoque_id: estoqueInfo?.id ?? null
        })
        .select()
        .single();

      if (solicitacaoError) throw solicitacaoError;

      // Criar itens da solicitação
      const itensParaInserir = itensEstoqueOnly.map(item => ({
        solicitacao_id: solicitacaoData.id,
        item_id: item.item_id!,
        quantidade_solicitada: item.quantidade,
        quantidade_aprovada: item.quantidade,
        item_snapshot: item.item_snapshot || {}
      }));

      const { error: itensError } = await supabase
        .from('solicitacao_itens')
        .insert(itensParaInserir);

      if (itensError) throw itensError;

      // Criar movimentações de saída
      for (const item of itensEstoqueOnly) {
        const movimentacaoData = {
          item_id: item.item_id!,
          tipo: 'SAIDA' as const,
          quantidade: item.quantidade,
          quantidade_anterior: 0,
          quantidade_atual: 0,
          user_id: user.id,
          observacoes: `Retirada - Solicitação Material #${sol.numero} → Retirada #${solicitacaoData.numero || solicitacaoData.id.slice(-8)}`,
          item_snapshot: item.item_snapshot || {},
          solicitacao_id: solicitacaoData.id,
          estoque_id: estoqueInfo?.id ?? null
        };

        const { error: movError } = await supabase
          .from('movements')
          .insert(movimentacaoData);

        if (movError) throw movError;
      }

      // Atualizar status da solicitação de material
      await supabase
        .from('solicitacoes_material')
        .update({
          status: 'convertida',
          solicitacao_retirada_id: solicitacaoData.id
        })
        .eq('id', sol.id);

      toast.success(`Retirada criada com sucesso! ${itensEstoqueOnly.length} item(ns) processado(s).`);
      
      if (sol.itens.length > itensEstoqueOnly.length) {
        toast.info(`${sol.itens.length - itensEstoqueOnly.length} item(ns) avulso(s) não foram incluídos na retirada (não existem no estoque).`);
      }

      carregarSolicitacoes();
      if (solicitacaoSelecionada?.id === sol.id) {
        setSolicitacaoSelecionada(prev => prev ? { ...prev, status: 'convertida' } : null);
      }
    } catch (error) {
      console.error('Erro ao converter em retirada:', error);
      toast.error('Erro ao converter em retirada');
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
                <td>${item.nome_item}${item.item_id && item.item_snapshot?.codigoBarras ? '<br><small style="color:#888">Cód: ' + item.item_snapshot.codigoBarras + '</small>' : ''}</td>
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
          item.item_id && item.item_snapshot?.codigoBarras ? `${item.nome_item}\nCód: ${item.item_snapshot.codigoBarras}` : item.nome_item,
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
          {pendentesCount > 0 && canManageStock() && (
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
                        {canManageStock() && sol.status === 'pendente' && (
                          <>
                            <Button variant="ghost" size="icon" className="text-green-400 hover:text-green-300" onClick={() => aprovarSolicitacao(sol.id)}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300" onClick={() => rejeitarSolicitacao(sol.id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {canManageStock() && sol.status === 'aprovada' && (
                          <Button variant="ghost" size="icon" className="text-primary hover:text-primary/80" title="Converter em Retirada" onClick={() => converterEmRetirada(sol)}>
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        )}
                        {isAdmin() && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir solicitação #{sol.numero}?</AlertDialogTitle>
                                <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => excluirSolicitacao(sol.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
                    <TableHead>Foto</TableHead>
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
                      <TableCell>
                        {item.item_snapshot?.fotoUrl ? (
                          <img src={item.item_snapshot.fotoUrl} alt={item.nome_item} className="w-10 h-10 rounded object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                            <span className="text-xs text-muted-foreground">—</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.nome_item}
                        {item.item_id && item.item_snapshot?.codigoBarras && (
                          <span className="block text-xs text-muted-foreground">Cód: {item.item_snapshot.codigoBarras}</span>
                        )}
                      </TableCell>
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
                <div className="flex gap-2">
                  {canManageStock() && solicitacaoSelecionada.status === 'pendente' && (
                    <>
                      <Button variant="outline" className="text-red-400 border-red-400/30" onClick={() => rejeitarSolicitacao(solicitacaoSelecionada.id)}>
                        <X className="h-4 w-4 mr-1" /> Rejeitar
                      </Button>
                      <Button className="bg-green-600 hover:bg-green-700" onClick={() => aprovarSolicitacao(solicitacaoSelecionada.id)}>
                        <Check className="h-4 w-4 mr-1" /> Aprovar
                      </Button>
                    </>
                  )}
                  {canManageStock() && solicitacaoSelecionada.status === 'aprovada' && (
                    <Button className="gap-1 bg-primary hover:bg-primary/90" onClick={() => converterEmRetirada(solicitacaoSelecionada)}>
                      <ArrowRight className="h-4 w-4" /> Converter em Retirada
                    </Button>
                  )}
                  {isAdmin() && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="gap-1">
                          <Trash2 className="h-4 w-4" /> Excluir
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir solicitação #{solicitacaoSelecionada.numero}?</AlertDialogTitle>
                          <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => excluirSolicitacao(solicitacaoSelecionada.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Criar Nova Solicitação */}
      <Dialog open={dialogoCriar} onOpenChange={(open) => { setDialogoCriar(open); if (!open) { setItensLista([]); setObservacoes(''); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
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
                  <PopoverContent className="w-[400px] p-0" align="start" side="bottom" avoidCollisions={false} sideOffset={4}>
                    <Command>
                      <CommandInput placeholder="Buscar por nome, código..." value={busca} onValueChange={setBusca} />
                      <CommandList className="max-h-[250px]">
                        <CommandEmpty>Nenhum item encontrado</CommandEmpty>
                        <CommandGroup>
                          {itensFiltrados.map(item => (
                            <CommandItem
                              key={item.id}
                              value={`${item.nome} ${item.codigoBarras}`}
                              onSelect={() => adicionarItemEstoque(item)}
                              onPointerDown={(e) => {
                                e.preventDefault();
                                adicionarItemEstoque(item);
                              }}
                              className="cursor-pointer"
                            >
                              <div className="flex items-center gap-2 w-full">
                                {item.fotoUrl ? (
                                  <img src={item.fotoUrl} alt={item.nome} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                                ) : (
                                  <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                    <span className="text-xs text-muted-foreground">—</span>
                                  </div>
                                )}
                                <div className="flex justify-between w-full">
                                  <span>{item.nome}</span>
                                  <span className="text-xs text-muted-foreground">
                                    Cód: {item.codigoBarras} | Estoque: {item.estoqueAtual} {item.unidade}
                                  </span>
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
              <Button type="button" onClick={adicionarItemCustom} variant="secondary" className="gap-1 whitespace-nowrap">
                <Plus className="h-4 w-4" /> Adicionar
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
                      <TableHead>Foto</TableHead>
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
                        <TableCell>
                          {!item.isCustom && item.item_snapshot?.fotoUrl ? (
                            <img src={item.item_snapshot.fotoUrl} alt={item.nome_item} className="w-10 h-10 rounded object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                              <span className="text-xs text-muted-foreground">—</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.nome_item}
                          {!item.isCustom && item.item_snapshot?.codigoBarras && (
                            <span className="block text-xs text-muted-foreground">Cód: {item.item_snapshot.codigoBarras}</span>
                          )}
                        </TableCell>
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
