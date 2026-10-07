import { useState, useMemo, useEffect } from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Plus, Check, ChevronsUpDown, Eye, Trash2, CheckCircle, Ban, AlertTriangle, Pencil, Save } from 'lucide-react';
import { useEstoqueContext } from '@/contexts/EstoqueContext';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { EstoqueItem } from '@/types/estoque';

type TipoItemRc = 'existente' | 'avulso';
type StatusFinanceiroRc = 'em_cotacao' | 'aguardando_aprovacao' | 'aprovada' | 'rejeitada' | 'convertida_em_pc';

interface ItemPedido {
  id: string;
  item_id: string | null;
  nome_item: string;
  quantidade: number;
  unidade: string;
  observacoes?: string | null;
  isCustom: boolean;
  item_snapshot: Record<string, any>;
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
  editado?: boolean;
  editado_por?: string | null;
  editado_em?: string | null;
  solicitacao_material_id?: string | null;
  solicitacao_material_numero?: number | null;
  pn_origem_id?: string | null;
  integrar_financeiro?: boolean | null;
  projeto_centro_custo?: string | null;
  especificacao_tecnica?: string | null;
  data_necessaria?: string | null;
  conferencia_estoque?: string | null;
  fornecedores_consultados?: string | null;
  valor_estimado_cotado?: number | string | null;
  frete_custos_adicionais?: number | string | null;
  condicao_pagamento?: string | null;
  lead_time_dias?: number | null;
  data_limite_compra?: string | null;
  impacto_financeiro?: string | null;
  status_financeiro_rc?: StatusFinanceiroRc | string | null;
}

interface PedidoItemDB {
  id: string;
  pedido_id: string;
  item_id: string | null;
  nome_item?: string | null;
  quantidade: number;
  quantidade_recebida?: number | null;
  item_snapshot: Record<string, any>;
  status: string;
  created_at: string;
  updated_at: string;
}

const statusFinanceiroLabels: Record<string, string> = {
  em_cotacao: 'Em cotação',
  aguardando_aprovacao: 'Aguardando aprovação',
  aprovada: 'Aprovada',
  rejeitada: 'Rejeitada',
  convertida_em_pc: 'Convertida em PC',
};

const parseDecimal = (valor: string) => {
  if (!valor?.trim()) return null;
  const n = Number(valor.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const formatDecimalInput = (valor?: number | string | null) => {
  if (valor === null || valor === undefined || valor === '') return '';
  const n = typeof valor === 'string' ? Number(valor) : valor;
  return Number.isFinite(n) ? String(n).replace('.', ',') : '';
};

const moeda = (valor?: number | string | null) => {
  const n = typeof valor === 'string' ? Number(valor) : valor;
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n));
};

const dataPt = (valor?: string | null) => {
  if (!valor) return '—';
  const somenteData = valor.includes('T') ? valor.slice(0, 10) : valor;
  const [ano, mes, dia] = somenteData.split('-');
  if (!ano || !mes || !dia) return '—';
  return `${dia}/${mes}/${ano}`;
};

const onlyDate = (valor?: string | null) => {
  if (!valor) return '';
  return valor.includes('T') ? valor.slice(0, 10) : valor;
};

type PedidoCompraProps = {
  /** Mantém a fila operacional visível no Almoxarifado sem permitir criar ou alterar RCs por fora do fluxo PN → RC. */
  somenteConsulta?: boolean;
};

export const PedidoCompra = ({ somenteConsulta = false }: PedidoCompraProps) => {
  const { obterEstoque } = useEstoqueContext();
  const { user } = useAuth();
  const { userProfile, canManageStock } = usePermissions();
  const { obterEstoqueAtivoInfo } = useConfiguracoes();

  const [dialogoNovoPedido, setDialogoNovoPedido] = useState(false);
  const [dialogoConsulta, setDialogoConsulta] = useState(false);
  const [dialogoDetalhe, setDialogoDetalhe] = useState(false);

  const [observacoes, setObservacoes] = useState('');
  const [projetoCentroCusto, setProjetoCentroCusto] = useState('');
  const [especificacaoTecnica, setEspecificacaoTecnica] = useState('');
  const [dataNecessaria, setDataNecessaria] = useState('');
  const [conferenciaEstoque, setConferenciaEstoque] = useState('');
  const [fornecedoresConsultados, setFornecedoresConsultados] = useState('');
  const [valorEstimadoCotado, setValorEstimadoCotado] = useState('');
  const [freteCustosAdicionais, setFreteCustosAdicionais] = useState('');
  const [condicaoPagamento, setCondicaoPagamento] = useState('');
  const [leadTimeDias, setLeadTimeDias] = useState('');
  const [dataLimiteCompra, setDataLimiteCompra] = useState('');
  const [impactoFinanceiro, setImpactoFinanceiro] = useState('');
  const [statusFinanceiroRc, setStatusFinanceiroRc] = useState<StatusFinanceiroRc>('em_cotacao');
  const [integrarFinanceiro, setIntegrarFinanceiro] = useState(false);

  const [tipoItem, setTipoItem] = useState<TipoItemRc>('existente');
  const [buscaItem, setBuscaItem] = useState('');
  const [popoverAberto, setPopoverAberto] = useState(false);
  const [itemSelecionado, setItemSelecionado] = useState<EstoqueItem | null>(null);
  const [nomeItemAvulso, setNomeItemAvulso] = useState('');
  const [unidadeItemAvulso, setUnidadeItemAvulso] = useState('un');
  const [especificacaoItemAvulso, setEspecificacaoItemAvulso] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [obsItem, setObsItem] = useState('');
  const [itensPedido, setItensPedido] = useState<ItemPedido[]>([]);

  const [pedidos, setPedidos] = useState<PedidoCompraDB[]>([]);
  const [pedidoSelecionado, setPedidoSelecionado] = useState<PedidoCompraDB | null>(null);
  const [itensPedidoSelecionado, setItensPedidoSelecionado] = useState<PedidoItemDB[]>([]);
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [modoEdicaoOperacional, setModoEdicaoOperacional] = useState(false);
  const [salvandoOperacional, setSalvandoOperacional] = useState(false);
  const [editProjetoCentroCusto, setEditProjetoCentroCusto] = useState('');
  const [editEspecificacaoTecnica, setEditEspecificacaoTecnica] = useState('');
  const [editDataNecessaria, setEditDataNecessaria] = useState('');
  const [editConferenciaEstoque, setEditConferenciaEstoque] = useState('');
  const [editFornecedoresConsultados, setEditFornecedoresConsultados] = useState('');
  const [editValorEstimadoCotado, setEditValorEstimadoCotado] = useState('');
  const [editFreteCustosAdicionais, setEditFreteCustosAdicionais] = useState('');
  const [editCondicaoPagamento, setEditCondicaoPagamento] = useState('');
  const [editLeadTimeDias, setEditLeadTimeDias] = useState('');
  const [editDataLimiteCompra, setEditDataLimiteCompra] = useState('');
  const [editImpactoFinanceiro, setEditImpactoFinanceiro] = useState('');
  const [editObservacoes, setEditObservacoes] = useState('');
  const [editStatusFinanceiroRc, setEditStatusFinanceiroRc] = useState<StatusFinanceiroRc>('em_cotacao');
  const [editIntegrarFinanceiro, setEditIntegrarFinanceiro] = useState(false);

  const itensEstoque = obterEstoque();
  const podeMovimentar = canManageStock();

  const itensFiltrados = useMemo(() => {
    const base = itensEstoque.slice();
    if (!buscaItem) return base.slice(0, 80);
    const termo = buscaItem.toLowerCase();
    return base.filter(item => item.nome.toLowerCase().includes(termo) || String(item.codigoBarras).includes(termo) || item.marca?.toLowerCase().includes(termo)).slice(0, 120);
  }, [buscaItem, itensEstoque]);

  const totalItens = useMemo(() => itensPedido.length, [itensPedido]);
  const totalEstimado = useMemo(() => {
    const cotado = parseDecimal(valorEstimadoCotado);
    const frete = parseDecimal(freteCustosAdicionais) || 0;
    if (cotado !== null) return cotado + frete;
    return itensPedido.reduce((acc, item) => {
      const valorUnitario = Number(item.item_snapshot?.valor_unitario_estimado || 0);
      return acc + valorUnitario * item.quantidade;
    }, frete);
  }, [valorEstimadoCotado, freteCustosAdicionais, itensPedido]);

  const selecionarItem = (item: EstoqueItem) => {
    setItemSelecionado(item);
    setBuscaItem(item.nome);
    setPopoverAberto(false);
  };

  const limparItem = () => {
    setItemSelecionado(null);
    setBuscaItem('');
    setNomeItemAvulso('');
    setUnidadeItemAvulso('un');
    setEspecificacaoItemAvulso('');
    setQuantidade('');
    setObsItem('');
  };

  const limparFormulario = () => {
    setObservacoes('');
    setProjetoCentroCusto('');
    setEspecificacaoTecnica('');
    setDataNecessaria('');
    setConferenciaEstoque('');
    setFornecedoresConsultados('');
    setValorEstimadoCotado('');
    setFreteCustosAdicionais('');
    setCondicaoPagamento('');
    setLeadTimeDias('');
    setDataLimiteCompra('');
    setImpactoFinanceiro('');
    setStatusFinanceiroRc('em_cotacao');
    setIntegrarFinanceiro(false);
    setTipoItem('existente');
    setItensPedido([]);
    limparItem();
  };

  const preencherEdicaoOperacional = (pedido: PedidoCompraDB) => {
    setEditProjetoCentroCusto(pedido.projeto_centro_custo || '');
    setEditEspecificacaoTecnica(pedido.especificacao_tecnica || '');
    setEditDataNecessaria(onlyDate(pedido.data_necessaria));
    setEditConferenciaEstoque(pedido.conferencia_estoque || '');
    setEditFornecedoresConsultados(pedido.fornecedores_consultados || '');
    setEditValorEstimadoCotado(formatDecimalInput(pedido.valor_estimado_cotado));
    setEditFreteCustosAdicionais(formatDecimalInput(pedido.frete_custos_adicionais));
    setEditCondicaoPagamento(pedido.condicao_pagamento || '');
    setEditLeadTimeDias(pedido.lead_time_dias ? String(pedido.lead_time_dias) : '');
    setEditDataLimiteCompra(onlyDate(pedido.data_limite_compra));
    setEditImpactoFinanceiro(pedido.impacto_financeiro || '');
    setEditObservacoes(pedido.observacoes || '');
    setEditStatusFinanceiroRc((pedido.status_financeiro_rc as StatusFinanceiroRc) || 'em_cotacao');
    setEditIntegrarFinanceiro(Boolean(pedido.integrar_financeiro || pedido.solicitacao_material_id || pedido.pn_origem_id));
  };

  const adicionarItem = () => {
    const quantidadeNumerica = Number(quantidade.replace(',', '.'));
    if (!Number.isFinite(quantidadeNumerica) || quantidadeNumerica <= 0) {
      toast.error('Informe uma quantidade válida');
      return;
    }

    if (tipoItem === 'existente') {
      if (!itemSelecionado) {
        toast.error('Selecione um item do almoxarifado');
        return;
      }
      if (itensPedido.find(i => i.item_id === itemSelecionado.id)) {
        toast.error('Este item já foi adicionado');
        return;
      }
      const estoqueAtual = Number(itemSelecionado.estoqueAtual || 0);
      const faltaEstimada = Math.max(quantidadeNumerica - estoqueAtual, 0);
      setItensPedido(prev => [...prev, {
        id: itemSelecionado.id,
        item_id: itemSelecionado.id,
        nome_item: itemSelecionado.nome,
        quantidade: quantidadeNumerica,
        unidade: itemSelecionado.unidade,
        observacoes: obsItem || null,
        isCustom: false,
        item_snapshot: {
          id: itemSelecionado.id,
          nome: itemSelecionado.nome,
          codigoBarras: itemSelecionado.codigoBarras,
          unidade: itemSelecionado.unidade,
          marca: itemSelecionado.marca,
          especificacao: itemSelecionado.especificacao,
          estoque_atual_no_momento: estoqueAtual,
          falta_estimativa: faltaEstimada,
          valor_unitario_estimado: Number((itemSelecionado as any).valor || 0) || null,
          observacoes: obsItem || null,
        },
      }]);
      if (faltaEstimada <= 0) toast.info('Item adicionado. Há saldo atual; registre na conferência por que será comprado ou reposto.');
      else toast.success(`Item adicionado. Falta estimada: ${faltaEstimada} ${itemSelecionado.unidade}.`);
      limparItem();
      return;
    }

    if (!nomeItemAvulso.trim()) {
      toast.error('Informe o nome do item avulso');
      return;
    }

    const idAvulso = `avulso-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setItensPedido(prev => [...prev, {
      id: idAvulso,
      item_id: null,
      nome_item: nomeItemAvulso.trim(),
      quantidade: quantidadeNumerica,
      unidade: unidadeItemAvulso || 'un',
      observacoes: obsItem || null,
      isCustom: true,
      item_snapshot: { nome: nomeItemAvulso.trim(), unidade: unidadeItemAvulso || 'un', especificacao: especificacaoItemAvulso || null, item_avulso: true, observacoes: obsItem || null },
    }]);
    toast.success('Item avulso adicionado à RC');
    limparItem();
  };

  const removerItem = (id: string) => setItensPedido(prev => prev.filter(i => i.id !== id));

  const validarFormulario = () => {
    if (itensPedido.length === 0) return 'Adicione pelo menos um item';
    if (!projetoCentroCusto.trim()) return 'Informe projeto, obra ou centro de custo';
    if (!dataNecessaria) return 'Informe a data necessária';
    if (!conferenciaEstoque.trim()) return 'Informe a conferência de estoque';
    return null;
  };

  const criarPedido = async () => {
    const erro = validarFormulario();
    if (erro) { toast.error(erro); return; }
    if (!user || !userProfile) { toast.error('Usuário não autenticado'); return; }

    setSalvando(true);
    try {
      const estoqueInfo = obterEstoqueAtivoInfo();
      const valorCotado = parseDecimal(valorEstimadoCotado);
      const frete = parseDecimal(freteCustosAdicionais);
      const leadTime = leadTimeDias ? Number(leadTimeDias) : null;

      const { data: pedido, error: pedidoError } = await (supabase as any).from('pedidos_compra').insert({
        criado_por_id: user.id,
        criado_por_nome: userProfile.nome,
        observacoes: observacoes || null,
        estoque_id: estoqueInfo?.id ?? null,
        status: 'aberto',
        projeto_centro_custo: projetoCentroCusto.trim(),
        especificacao_tecnica: especificacaoTecnica || null,
        data_necessaria: dataNecessaria,
        conferencia_estoque: conferenciaEstoque,
        fornecedores_consultados: fornecedoresConsultados || null,
        valor_estimado_cotado: valorCotado,
        frete_custos_adicionais: frete,
        condicao_pagamento: condicaoPagamento || null,
        lead_time_dias: Number.isFinite(leadTime) ? leadTime : null,
        data_limite_compra: dataLimiteCompra || null,
        impacto_financeiro: impactoFinanceiro || null,
        status_financeiro_rc: statusFinanceiroRc,
        integrar_financeiro: integrarFinanceiro,
      }).select().single();

      if (pedidoError || !pedido) throw pedidoError ?? new Error('Não foi possível criar a RC');

      const itensInsert = itensPedido.map(ip => ({ pedido_id: pedido.id, item_id: ip.item_id, nome_item: ip.nome_item, quantidade: ip.quantidade, item_snapshot: ip.item_snapshot, status: 'pendente' }));
      const { error: itensError } = await (supabase as any).from('pedido_compra_itens').insert(itensInsert);
      if (itensError) throw itensError;

      toast.success(`RC #${pedido.numero} criada${integrarFinanceiro ? ' e enviada ao Financeiro' : ''}.`);
      setDialogoNovoPedido(false);
      limparFormulario();
      await carregarPedidos();
    } catch (error: any) {
      console.error('Erro ao criar RC:', error);
      toast.error(error?.message || 'Erro ao criar Requisição de Compra');
    } finally {
      setSalvando(false);
    }
  };

  const carregarPedidos = async () => {
    setLoadingPedidos(true);
    try {
      const estoqueInfo = obterEstoqueAtivoInfo();
      let query = (supabase as any).from('pedidos_compra').select('*').order('numero', { ascending: false });
      if (estoqueInfo?.id) query = query.eq('estoque_id', estoqueInfo.id);
      const { data, error } = await query;
      if (error) throw error;
      setPedidos((data as PedidoCompraDB[]) || []);
    } catch (error) {
      console.error('Erro ao carregar RCs:', error);
      toast.error('Erro ao carregar RCs');
    } finally {
      setLoadingPedidos(false);
    }
  };

  const abrirDetalhe = async (pedido: PedidoCompraDB) => {
    setPedidoSelecionado(pedido);
    preencherEdicaoOperacional(pedido);
    setModoEdicaoOperacional(false);
    try {
      const { data, error } = await (supabase as any).from('pedido_compra_itens').select('*').eq('pedido_id', pedido.id).order('created_at', { ascending: true });
      if (error) throw error;
      setItensPedidoSelecionado((data || []) as PedidoItemDB[]);
      setDialogoDetalhe(true);
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
      toast.error('Erro ao carregar itens da RC');
    }
  };

  const iniciarEdicaoOperacional = () => {
    if (!pedidoSelecionado) return;
    preencherEdicaoOperacional(pedidoSelecionado);
    setModoEdicaoOperacional(true);
  };

  const salvarDadosOperacionais = async () => {
    if (!pedidoSelecionado || !userProfile) return;
    if (editIntegrarFinanceiro && (!editProjetoCentroCusto.trim() || !editDataNecessaria || !editConferenciaEstoque.trim())) {
      toast.error('Para integrar ao Financeiro, informe projeto/centro, data necessária e conferência de estoque.');
      return;
    }

    setSalvandoOperacional(true);
    try {
      const valorCotado = parseDecimal(editValorEstimadoCotado);
      const frete = parseDecimal(editFreteCustosAdicionais);
      const leadTime = editLeadTimeDias ? Number(editLeadTimeDias) : null;
      const atualizacao = {
        projeto_centro_custo: editProjetoCentroCusto.trim() || null,
        especificacao_tecnica: editEspecificacaoTecnica.trim() || null,
        data_necessaria: editDataNecessaria || null,
        conferencia_estoque: editConferenciaEstoque.trim() || null,
        fornecedores_consultados: editFornecedoresConsultados.trim() || null,
        valor_estimado_cotado: valorCotado,
        frete_custos_adicionais: frete,
        condicao_pagamento: editCondicaoPagamento.trim() || null,
        lead_time_dias: Number.isFinite(leadTime) ? leadTime : null,
        data_limite_compra: editDataLimiteCompra || null,
        impacto_financeiro: editImpactoFinanceiro.trim() || null,
        observacoes: editObservacoes.trim() || null,
        status_financeiro_rc: editStatusFinanceiroRc,
        integrar_financeiro: editIntegrarFinanceiro,
        editado: true,
        editado_por: userProfile.nome,
        editado_em: new Date().toISOString(),
      };
      const { data, error } = await (supabase as any).from('pedidos_compra').update(atualizacao).eq('id', pedidoSelecionado.id).select('*').single();
      if (error) throw error;
      const atualizado = data as PedidoCompraDB;
      setPedidoSelecionado(atualizado);
      preencherEdicaoOperacional(atualizado);
      setModoEdicaoOperacional(false);
      await carregarPedidos();
      toast.success('Dados operacionais da RC atualizados.');
    } catch (error: any) {
      console.error('Erro ao salvar dados operacionais:', error);
      toast.error(error?.message || 'Não foi possível salvar os dados da RC');
    } finally {
      setSalvandoOperacional(false);
    }
  };

  const atualizarStatusItem = async (itemId: string, novoStatus: string) => {
    if (somenteConsulta) return;
    try {
      const { error } = await (supabase as any).from('pedido_compra_itens').update({ status: novoStatus }).eq('id', itemId);
      if (error) throw error;
      setItensPedidoSelecionado(prev => prev.map(i => i.id === itemId ? { ...i, status: novoStatus } : i));
      toast.success('Status do item atualizado');
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      toast.error(error?.message || 'Erro ao atualizar status');
    }
  };

  const concluirPedido = async () => {
    if (!pedidoSelecionado) return;
    try {
      const { error } = await (supabase as any).from('pedidos_compra').update({ status: 'concluido', data_conclusao: new Date().toISOString() }).eq('id', pedidoSelecionado.id);
      if (error) throw error;
      setPedidoSelecionado(prev => prev ? { ...prev, status: 'concluido', data_conclusao: new Date().toISOString() } : prev);
      await carregarPedidos();
      toast.success('RC concluída');
    } catch (error) {
      console.error('Erro ao concluir:', error);
      toast.error('Erro ao concluir RC');
    }
  };

  const cancelarPedido = async () => {
    if (!pedidoSelecionado) return;
    if (!confirm('Cancelar esta RC?')) return;
    try {
      const { error } = await (supabase as any).from('pedidos_compra').update({ status: 'cancelado' }).eq('id', pedidoSelecionado.id);
      if (error) throw error;
      setPedidoSelecionado(prev => prev ? { ...prev, status: 'cancelado' } : prev);
      await carregarPedidos();
      toast.success('RC cancelada');
    } catch (error) {
      console.error('Erro ao cancelar:', error);
      toast.error('Erro ao cancelar RC');
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const abrirPedidoAutomaticamente = async (pedidoId?: string) => {
      if (!pedidoId) return;
      try {
        const { data: pedido, error: pedidoError } = await (supabase as any).from('pedidos_compra').select('*').eq('id', pedidoId).maybeSingle();
        if (pedidoError) throw pedidoError;
        if (!pedido) return;
        await abrirDetalhe(pedido as PedidoCompraDB);
        setDialogoConsulta(false);
      } catch (error) {
        console.error('Erro ao abrir RC automática:', error);
        toast.error('Erro ao abrir a RC automaticamente');
      }
    };
    const processarRedirecionamento = async (payload?: { pedidoId?: string }) => {
      if (!payload?.pedidoId) return;
      sessionStorage.removeItem('pedido_compra_redirect');
      await abrirPedidoAutomaticamente(payload.pedidoId);
    };
    const pendente = sessionStorage.getItem('pedido_compra_redirect');
    if (pendente) {
      try { void processarRedirecionamento(JSON.parse(pendente) as { pedidoId?: string }); }
      catch { sessionStorage.removeItem('pedido_compra_redirect'); }
    }
    const handleAbrirPedido = (event: Event) => void processarRedirecionamento((event as CustomEvent<{ pedidoId?: string }>).detail);
    window.addEventListener('pedido-compra:abrir', handleAbrirPedido as EventListener);
    return () => window.removeEventListener('pedido-compra:abrir', handleAbrirPedido as EventListener);
  }, []);

  return (
    <>
      <Card className={cn('cursor-pointer hover:scale-105 transition-all duration-300', podeMovimentar ? 'border-blue-500/30 hover:border-blue-400 bg-gradient-to-br from-blue-950/20 to-indigo-950/20 shadow-sm' : 'border-muted/20 hover:border-muted/40 opacity-60')} onClick={() => { if (!podeMovimentar) return; setDialogoConsulta(true); void carregarPedidos(); }}>
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mb-4 shadow-lg"><ShoppingCart className="h-8 w-8 text-white" /></div>
          <CardTitle className="text-blue-400">Requisições de Compra (RC)</CardTitle>
          <CardDescription className="text-blue-500/70">Acompanhe as RCs formalizadas a partir das PNs do Almoxarifado</CardDescription>
        </CardHeader>
      </Card>

      <Dialog open={dialogoConsulta} onOpenChange={setDialogoConsulta}>
        <DialogContent className="w-[95vw] sm:w-full max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>🛒 Requisições de Compra (RC)</DialogTitle><DialogDescription>{somenteConsulta ? 'Fila de consulta do Almoxarifado. A RC é formalizada no Financeiro a partir de uma PN.' : 'RC operacional do Almoxarifado. Pedidos vindos da Solicitação de Material podem alimentar PN, Fluxo e Financeiro.'}</DialogDescription></DialogHeader>
          {!somenteConsulta && <div className="flex justify-end mb-4"><Button onClick={() => setDialogoNovoPedido(true)}><Plus className="h-4 w-4 mr-2" /> Nova RC</Button></div>}
          {loadingPedidos ? <p className="text-center text-muted-foreground py-8">Carregando...</p> : pedidos.length === 0 ? <p className="text-center text-muted-foreground py-8">Nenhuma RC encontrada</p> : (
            <div className="overflow-x-auto w-full"><Table><TableHeader><TableRow><TableHead>Nº</TableHead><TableHead>Data</TableHead><TableHead>Projeto / centro</TableHead><TableHead>Data necessária</TableHead><TableHead>Financeiro</TableHead><TableHead className="text-right">Valor estimado</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>
              {pedidos.map(pedido => { const valor = Number(pedido.valor_estimado_cotado || 0) + Number(pedido.frete_custos_adicionais || 0); const integrado = Boolean(pedido.integrar_financeiro || pedido.solicitacao_material_id || pedido.pn_origem_id); return (
                <TableRow key={pedido.id}><TableCell className="font-medium">#{pedido.numero}</TableCell><TableCell>{new Date(pedido.data_pedido).toLocaleString('pt-BR')}</TableCell><TableCell>{pedido.projeto_centro_custo || '—'}</TableCell><TableCell>{dataPt(pedido.data_necessaria)}</TableCell><TableCell><div className="flex flex-col gap-1"><Badge variant={integrado ? 'default' : 'outline'}>{integrado ? 'Integrado' : 'Operacional'}</Badge><span className="text-xs text-muted-foreground">{statusFinanceiroLabels[pedido.status_financeiro_rc || 'em_cotacao'] || pedido.status_financeiro_rc || '—'}</span></div></TableCell><TableCell className="text-right">{valor > 0 ? moeda(valor) : '—'}</TableCell><TableCell><Badge variant={pedido.status === 'concluido' ? 'default' : pedido.status === 'cancelado' ? 'destructive' : 'secondary'}>{pedido.status === 'concluido' ? 'Concluída' : pedido.status === 'cancelado' ? 'Cancelada' : 'Aberta'}</Badge></TableCell><TableCell><Button size="sm" variant="outline" onClick={() => void abrirDetalhe(pedido)}><Eye className="h-4 w-4 mr-1" /> Ver / preencher</Button></TableCell></TableRow>
              ); })}
            </TableBody></Table></div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogoNovoPedido} onOpenChange={(open) => { setDialogoNovoPedido(open); if (!open) limparFormulario(); }}>
        <DialogContent className="w-[95vw] sm:w-full max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>📋 Nova Requisição de Compra (RC)</DialogTitle><DialogDescription>Formalize a compra quando o estoque não atende, quando o item é avulso ou quando a reposição precisa ser enviada ao Financeiro.</DialogDescription></DialogHeader>
          <div className="space-y-5">
            <div className="rounded-md border border-blue-500/30 bg-blue-950/20 p-3 text-sm text-blue-100"><p className="font-medium">Esta tela é a parte operacional da RC.</p><p className="text-blue-200/80">O Almoxarifado informa necessidade, itens, conferência de estoque, fornecedor, valor e prazo. A Kátia complementa vencimentos, aprovação, compromisso e programação.</p></div>
            <div className="grid gap-3 md:grid-cols-2"><div><Label>Projeto / obra / centro de custo *</Label><Input value={projetoCentroCusto} onChange={e => setProjetoCentroCusto(e.target.value)} placeholder="Ex.: Natal / Casa Noel / Usina Marialva" /></div><div><Label>Data necessária *</Label><Input type="date" value={dataNecessaria} onChange={e => setDataNecessaria(e.target.value)} /></div><div className="md:col-span-2"><Label>Especificação técnica geral</Label><Input value={especificacaoTecnica} onChange={e => setEspecificacaoTecnica(e.target.value)} placeholder="Medida, marca, padrão, aplicação, OP ou referência técnica" /></div><div className="md:col-span-2"><Label>Conferência de estoque *</Label><Textarea value={conferenciaEstoque} onChange={e => setConferenciaEstoque(e.target.value)} placeholder="Saldo conferido, reserva, material em trânsito, reaproveitamento e motivo da compra" rows={2} /></div></div>
            <div className="rounded-md border p-4 space-y-3 bg-muted/20"><div className="flex items-center justify-between gap-3"><div><Label className="text-base font-semibold">Itens da RC</Label><p className="text-xs text-muted-foreground">Permite item cadastrado no almoxarifado e item avulso/não cadastrado.</p></div><Select value={tipoItem} onValueChange={(v) => { setTipoItem(v as TipoItemRc); limparItem(); }}><SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="existente">Item do almoxarifado</SelectItem><SelectItem value="avulso">Item avulso / não cadastrado</SelectItem></SelectContent></Select></div>
              {tipoItem === 'existente' ? <div className="grid gap-3 md:grid-cols-[1fr_160px]"><div><Label>Buscar item cadastrado *</Label><Popover open={popoverAberto} onOpenChange={setPopoverAberto}><PopoverTrigger asChild><Button variant="outline" role="combobox" className="w-full justify-between">{itemSelecionado ? itemSelecionado.nome : 'Selecione um item...'}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></PopoverTrigger><PopoverContent className="w-[520px] p-0"><Command shouldFilter={false}><CommandInput placeholder="Buscar por nome, código ou marca..." value={buscaItem} onValueChange={setBuscaItem} /><CommandList><CommandEmpty>Nenhum item encontrado.</CommandEmpty><CommandGroup>{itensFiltrados.map(item => <CommandItem key={item.id} onSelect={() => selecionarItem(item)} className="cursor-pointer"><Check className={cn('mr-2 h-4 w-4', itemSelecionado?.id === item.id ? 'opacity-100' : 'opacity-0')} /><div className="flex-1"><div className="font-medium">{item.nome}</div><div className="text-xs text-muted-foreground">{item.codigoBarras} • {item.marca || 'sem marca'} • Saldo: {item.estoqueAtual} {item.unidade}</div></div></CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent></Popover></div><div><Label>Quantidade *</Label><Input type="number" min="0.01" step="0.01" value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="Qtd" /></div>{itemSelecionado && <div className="md:col-span-2 rounded-md bg-background border p-3 text-sm"><div className="font-medium">{itemSelecionado.nome}</div><div className="text-muted-foreground">Código {itemSelecionado.codigoBarras} • Saldo atual {itemSelecionado.estoqueAtual} {itemSelecionado.unidade} • {itemSelecionado.marca || 'sem marca'}</div></div>}</div> : <div className="grid gap-3 md:grid-cols-[1fr_120px_160px]"><div><Label>Nome do item avulso *</Label><Input value={nomeItemAvulso} onChange={e => setNomeItemAvulso(e.target.value)} placeholder="Ex.: cinta plástica 13 mm" /></div><div><Label>Unidade</Label><Input value={unidadeItemAvulso} onChange={e => setUnidadeItemAvulso(e.target.value)} placeholder="un, kg, m" /></div><div><Label>Quantidade *</Label><Input type="number" min="0.01" step="0.01" value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="Qtd" /></div><div className="md:col-span-3"><Label>Especificação do item avulso</Label><Input value={especificacaoItemAvulso} onChange={e => setEspecificacaoItemAvulso(e.target.value)} placeholder="Medida, padrão, referência de compra ou aplicação" /></div></div>}
              <div className="grid gap-3 md:grid-cols-[1fr_150px]"><div><Label>Observação do item</Label><Input value={obsItem} onChange={e => setObsItem(e.target.value)} placeholder="Uso, urgência, substituição, fornecedor sugerido" /></div><div className="flex items-end"><Button type="button" onClick={adicionarItem} className="w-full"><Plus className="h-4 w-4 mr-2" /> Adicionar</Button></div></div>
              {itensPedido.length > 0 && <div className="overflow-x-auto rounded-md border bg-background"><Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Origem</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead>Saldo / falta</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>{itensPedido.map(ip => <TableRow key={ip.id}><TableCell><div className="font-medium">{ip.nome_item}</div>{ip.observacoes && <div className="text-xs text-muted-foreground">{ip.observacoes}</div>}</TableCell><TableCell>{ip.isCustom ? <Badge variant="outline">Avulso</Badge> : <Badge variant="secondary">Almoxarifado</Badge>}</TableCell><TableCell className="text-right">{ip.quantidade} {ip.unidade}</TableCell><TableCell className="text-xs text-muted-foreground">{ip.isCustom ? 'Sem cadastro no estoque' : `Saldo ${ip.item_snapshot.estoque_atual_no_momento ?? 0} · Falta ${ip.item_snapshot.falta_estimativa ?? 0}`}</TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => removerItem(ip.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>)}</TableBody></Table></div>}
            </div>
            <div className="grid gap-3 md:grid-cols-2"><div><Label>Fornecedor / fornecedores consultados</Label><Input value={fornecedoresConsultados} onChange={e => setFornecedoresConsultados(e.target.value)} placeholder="Fornecedor, WhatsApp, link ou contato" /></div><div><Label>Status financeiro da RC</Label><Select value={statusFinanceiroRc} onValueChange={(v) => setStatusFinanceiroRc(v as StatusFinanceiroRc)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="em_cotacao">Em cotação</SelectItem><SelectItem value="aguardando_aprovacao">Aguardando aprovação</SelectItem><SelectItem value="aprovada">Aprovada</SelectItem><SelectItem value="rejeitada">Rejeitada</SelectItem><SelectItem value="convertida_em_pc">Convertida em PC</SelectItem></SelectContent></Select></div><div><Label>Valor estimado / cotado</Label><Input value={valorEstimadoCotado} onChange={e => setValorEstimadoCotado(e.target.value)} placeholder="R$" /></div><div><Label>Frete / custos adicionais</Label><Input value={freteCustosAdicionais} onChange={e => setFreteCustosAdicionais(e.target.value)} placeholder="R$" /></div><div><Label>Condição de pagamento</Label><Input value={condicaoPagamento} onChange={e => setCondicaoPagamento(e.target.value)} placeholder="À vista, boleto, 2x, cartão, prazo" /></div><div><Label>Lead time / prazo do fornecedor em dias</Label><Input type="number" min="0" value={leadTimeDias} onChange={e => setLeadTimeDias(e.target.value)} placeholder="Ex.: 5" /></div><div><Label>Data-limite de compra</Label><Input type="date" value={dataLimiteCompra} onChange={e => setDataLimiteCompra(e.target.value)} /></div><div><Label>Total estimado</Label><div className="h-10 rounded-md border bg-muted/30 px-3 flex items-center font-medium">{totalEstimado > 0 ? moeda(totalEstimado) : 'A definir'}</div></div><div className="md:col-span-2"><Label>Impacto financeiro / observação para Kátia</Label><Textarea value={impactoFinanceiro} onChange={e => setImpactoFinanceiro(e.target.value)} placeholder="Urgência, risco se não comprar, efeito no prazo e qualquer ponto para o fluxo de caixa" rows={2} /></div><div className="md:col-span-2 flex items-center gap-2 rounded-md border p-3"><input type="checkbox" checked={integrarFinanceiro} onChange={e => setIntegrarFinanceiro(e.target.checked)} /><div><div className="text-sm font-medium">Enviar esta RC ao Financeiro</div><div className="text-xs text-muted-foreground">Use quando a RC manual deve virar PN/lançamento previsto. RCs vindas de Solicitação de Material já são integradas automaticamente.</div></div></div><div className="md:col-span-2"><Label>Observações gerais</Label><Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Observações adicionais da RC" rows={2} /></div></div>
            <div className="flex items-center justify-between gap-3 pt-4 border-t"><div className="text-sm text-muted-foreground">{totalItens} item(ns) · {totalEstimado > 0 ? moeda(totalEstimado) : 'valor a definir'}</div><div className="flex gap-2"><Button variant="outline" onClick={() => { setDialogoNovoPedido(false); limparFormulario(); }}>Cancelar</Button><Button onClick={criarPedido} disabled={salvando || itensPedido.length === 0}>{salvando ? 'Salvando...' : `Criar RC (${itensPedido.length})`}</Button></div></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogoDetalhe} onOpenChange={setDialogoDetalhe}>
        <DialogContent className="w-[95vw] sm:w-full max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2">📋 RC #{pedidoSelecionado?.numero}<Badge variant={pedidoSelecionado?.status === 'concluido' ? 'default' : pedidoSelecionado?.status === 'cancelado' ? 'destructive' : 'secondary'}>{pedidoSelecionado?.status === 'concluido' ? 'Concluída' : pedidoSelecionado?.status === 'cancelado' ? 'Cancelada' : 'Aberta'}</Badge><Badge variant={pedidoSelecionado?.integrar_financeiro || pedidoSelecionado?.solicitacao_material_id || pedidoSelecionado?.pn_origem_id ? 'default' : 'outline'}>{pedidoSelecionado?.integrar_financeiro || pedidoSelecionado?.solicitacao_material_id || pedidoSelecionado?.pn_origem_id ? 'Integrada ao Financeiro' : 'Operacional apenas'}</Badge></DialogTitle><DialogDescription>Criada por {pedidoSelecionado?.criado_por_nome} em {pedidoSelecionado ? new Date(pedidoSelecionado.data_pedido).toLocaleString('pt-BR') : ''}</DialogDescription></DialogHeader>
          {pedidoSelecionado && <div className="space-y-5">
            {!pedidoSelecionado.data_necessaria && <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"><AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500" /><div><p className="font-medium">RC sem data necessária</p><p className="text-muted-foreground">Preencha a data necessária para alimentar corretamente PN, fluxo e prazo de compra.</p></div></div>}
            <div className="flex justify-between items-center gap-3"><div><h3 className="font-semibold">Dados operacionais da RC</h3><p className="text-xs text-muted-foreground">Campos preenchidos pelo Almoxarifado durante cotação, conferência e negociação.</p></div>{!somenteConsulta && (!modoEdicaoOperacional ? <Button size="sm" variant="outline" onClick={iniciarEdicaoOperacional} disabled={pedidoSelecionado.status === 'cancelado'}><Pencil className="h-4 w-4 mr-2" /> Editar dados do Almoxarifado</Button> : <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { preencherEdicaoOperacional(pedidoSelecionado); setModoEdicaoOperacional(false); }}>Cancelar</Button><Button size="sm" onClick={() => void salvarDadosOperacionais()} disabled={salvandoOperacional}><Save className="h-4 w-4 mr-2" /> {salvandoOperacional ? 'Salvando...' : 'Salvar dados'}</Button></div>)}</div>
            {!modoEdicaoOperacional ? <><div className="grid gap-3 md:grid-cols-4"><div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Projeto / centro</div><div className="font-medium">{pedidoSelecionado.projeto_centro_custo || '—'}</div></div><div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Data necessária</div><div className="font-medium">{dataPt(pedidoSelecionado.data_necessaria)}</div></div><div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Status financeiro</div><div className="font-medium">{statusFinanceiroLabels[pedidoSelecionado.status_financeiro_rc || 'em_cotacao'] || pedidoSelecionado.status_financeiro_rc || '—'}</div></div><div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">PN vinculada</div><div className="font-medium">{pedidoSelecionado.pn_origem_id ? 'Sim' : 'Ainda não'}</div></div></div><div className="grid gap-3 md:grid-cols-2"><div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Conferência de estoque</div><div>{pedidoSelecionado.conferencia_estoque || '—'}</div></div><div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Especificação técnica</div><div>{pedidoSelecionado.especificacao_tecnica || '—'}</div></div><div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Fornecedor / fornecedores consultados</div><div>{pedidoSelecionado.fornecedores_consultados || '—'}</div></div><div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Condição / prazo</div><div>{pedidoSelecionado.condicao_pagamento || '—'} {pedidoSelecionado.lead_time_dias ? `· prazo fornecedor ${pedidoSelecionado.lead_time_dias} dias` : ''}</div></div><div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Valor cotado + frete</div><div>{moeda(Number(pedidoSelecionado.valor_estimado_cotado || 0) + Number(pedidoSelecionado.frete_custos_adicionais || 0))}</div></div><div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Data-limite de compra</div><div>{dataPt(pedidoSelecionado.data_limite_compra)}</div></div></div>{pedidoSelecionado.impacto_financeiro && <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Impacto financeiro / observação para Kátia</div><div>{pedidoSelecionado.impacto_financeiro}</div></div>}</> : <div className="rounded-md border p-4 space-y-3 bg-muted/20"><div className="grid gap-3 md:grid-cols-2"><div><Label>Projeto / obra / centro de custo</Label><Input value={editProjetoCentroCusto} onChange={e => setEditProjetoCentroCusto(e.target.value)} placeholder="Projeto, obra, OP ou centro de custo" /></div><div><Label>Data necessária</Label><Input type="date" value={editDataNecessaria} onChange={e => setEditDataNecessaria(e.target.value)} /></div><div className="md:col-span-2"><Label>Especificação técnica</Label><Input value={editEspecificacaoTecnica} onChange={e => setEditEspecificacaoTecnica(e.target.value)} placeholder="Medida, marca, padrão, aplicação, OP ou referência técnica" /></div><div className="md:col-span-2"><Label>Conferência de estoque</Label><Textarea value={editConferenciaEstoque} onChange={e => setEditConferenciaEstoque(e.target.value)} rows={2} placeholder="Saldo conferido, falta apurada, item avulso, substituição, material em trânsito" /></div><div><Label>Fornecedor / fornecedores consultados</Label><Input value={editFornecedoresConsultados} onChange={e => setEditFornecedoresConsultados(e.target.value)} placeholder="Nome do fornecedor, contato, link, WhatsApp" /></div><div><Label>Status financeiro da RC</Label><Select value={editStatusFinanceiroRc} onValueChange={(v) => setEditStatusFinanceiroRc(v as StatusFinanceiroRc)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="em_cotacao">Em cotação</SelectItem><SelectItem value="aguardando_aprovacao">Aguardando aprovação</SelectItem><SelectItem value="aprovada">Aprovada</SelectItem><SelectItem value="rejeitada">Rejeitada</SelectItem><SelectItem value="convertida_em_pc">Convertida em PC</SelectItem></SelectContent></Select></div><div><Label>Valor estimado / cotado</Label><Input value={editValorEstimadoCotado} onChange={e => setEditValorEstimadoCotado(e.target.value)} placeholder="R$" /></div><div><Label>Frete / custos adicionais</Label><Input value={editFreteCustosAdicionais} onChange={e => setEditFreteCustosAdicionais(e.target.value)} placeholder="R$" /></div><div><Label>Condição de pagamento</Label><Input value={editCondicaoPagamento} onChange={e => setEditCondicaoPagamento(e.target.value)} placeholder="À vista, boleto, 2x, cartão, prazo" /></div><div><Label>Lead time / prazo do fornecedor em dias</Label><Input type="number" min="0" value={editLeadTimeDias} onChange={e => setEditLeadTimeDias(e.target.value)} placeholder="Ex.: 5" /></div><div><Label>Data-limite de compra</Label><Input type="date" value={editDataLimiteCompra} onChange={e => setEditDataLimiteCompra(e.target.value)} /></div><div className="flex items-center gap-2 rounded-md border p-3 bg-background"><input type="checkbox" checked={editIntegrarFinanceiro} onChange={e => setEditIntegrarFinanceiro(e.target.checked)} /><div><div className="text-sm font-medium">Integrar esta RC ao Financeiro</div><div className="text-xs text-muted-foreground">Quando ativo, alterações nesta RC atualizam PN e lançamento previsto.</div></div></div><div className="md:col-span-2"><Label>Impacto financeiro / observação para Kátia</Label><Textarea value={editImpactoFinanceiro} onChange={e => setEditImpactoFinanceiro(e.target.value)} rows={2} placeholder="Urgência, risco operacional, impacto no prazo e ponto de atenção para caixa" /></div><div className="md:col-span-2"><Label>Observações gerais</Label><Textarea value={editObservacoes} onChange={e => setEditObservacoes(e.target.value)} rows={2} placeholder="Observações adicionais da RC" /></div></div></div>}
            <div className="overflow-x-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Origem</TableHead><TableHead className="text-right">Quantidade</TableHead><TableHead>Detalhe</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{itensPedidoSelecionado.map(item => { const snap = item.item_snapshot || {}; const nome = snap.nome || item.nome_item || 'Item'; return <TableRow key={item.id}><TableCell><div className="font-medium">{nome}</div><div className="text-xs text-muted-foreground">{snap.codigoBarras || snap.especificacao || '—'}</div></TableCell><TableCell>{item.item_id ? <Badge variant="secondary">Almoxarifado</Badge> : <Badge variant="outline">Avulso</Badge>}</TableCell><TableCell className="text-right">{item.quantidade} {snap.unidade || ''}</TableCell><TableCell className="text-xs text-muted-foreground">{item.item_id ? `Saldo na abertura: ${snap.estoque_atual_no_momento ?? '—'} · Falta: ${snap.falta_estimativa ?? '—'}` : 'Item não cadastrado no estoque'}</TableCell><TableCell><Select value={item.status || 'pendente'} onValueChange={(v) => void atualizarStatusItem(item.id, v)} disabled={pedidoSelecionado.status === 'cancelado'}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="parcial">Parcial</SelectItem><SelectItem value="comprado">Comprado</SelectItem></SelectContent></Select></TableCell></TableRow>; })}</TableBody></Table></div>
            <div className="flex justify-end gap-2 pt-4 border-t">{!somenteConsulta && pedidoSelecionado.status === 'aberto' && <><Button variant="outline" onClick={() => void cancelarPedido()} className="text-destructive hover:text-destructive"><Ban className="h-4 w-4 mr-2" />Cancelar RC</Button><Button onClick={() => void concluirPedido()}><CheckCircle className="h-4 w-4 mr-2" />Concluir RC</Button></>}</div>
          </div>}
        </DialogContent>
      </Dialog>
    </>
  );
};
