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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { ClipboardList, Plus, Trash2, Eye, Printer, FileText, Check, X, ChevronsUpDown, Send, ArrowRight, Pencil, Save } from 'lucide-react';
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
import { itemEhFerramentaUnitaria } from '@/utils/itemClassification';
import { formatarErroSupabase } from '@/utils/supabaseError';

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
  solicitante_email?: string;
  observacoes?: string;
  status: string;
  estoque_id?: string;
  aprovado_por_nome?: string;
  data_aprovacao?: string;
  local_origem?: string;
  local_origem_id?: string;
  data_necessidade?: string;
  created_at: string;
  updated_at: string;
  itens: {
    id: string;
    item_id?: string;
    nome_item: string;
    quantidade: number;
    unidade: string;
    especificacao?: string;
    item_snapshot?: any;
    observacoes?: string;
    destino_atendimento?: 'estoque' | 'pn';
  }[];
}

export const SolicitacaoMaterial = () => {
  const [dialogoCriar, setDialogoCriar] = useState(false);
  const [dialogoListar, setDialogoListar] = useState(false);
  const [dialogoDetalhes, setDialogoDetalhes] = useState(false);
  const [solicitacaoParaAdicionar, setSolicitacaoParaAdicionar] = useState<SolicitacaoMaterialCompleta | null>(null);
  const [observacoes, setObservacoes] = useState('');
  const [dataNecessidade, setDataNecessidade] = useState('');
  const [itensLista, setItensLista] = useState<ItemSolicitacaoMaterial[]>([]);
  const [popoverAberto, setPopoverAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [quantidadeItem, setQuantidadeItem] = useState('');
  const [nomeItemCustom, setNomeItemCustom] = useState('');
  const [unidadeCustom, setUnidadeCustom] = useState('un');
  const [especificacaoItem, setEspecificacaoItem] = useState('');
  const [obsItem, setObsItem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoMaterialCompleta[]>([]);
  const [loadingSolicitacoes, setLoadingSolicitacoes] = useState(false);
  const [solicitacaoSelecionada, setSolicitacaoSelecionada] = useState<SolicitacaoMaterialCompleta | null>(null);
  const [pendentesCount, setPendentesCount] = useState(0);
  const [localOrigemId, setLocalOrigemId] = useState<string>('');
  const [localOrigemNome, setLocalOrigemNome] = useState<string>('');
  const [localOrigemEdicaoId, setLocalOrigemEdicaoId] = useState<string>('');
  const [salvandoLocalOrigem, setSalvandoLocalOrigem] = useState(false);
  const [modoEdicaoSolicitacao, setModoEdicaoSolicitacao] = useState(false);
  const [salvandoEdicaoSolicitacao, setSalvandoEdicaoSolicitacao] = useState(false);
  const [edicaoSolicitacao, setEdicaoSolicitacao] = useState<{
    observacoes: string;
    data_necessidade: string;
    itens: Array<{ id: string; nome_item: string; especificacao: string; quantidade: string; unidade: string; observacoes: string }>;
  } | null>(null);

  const { obterEstoque } = useEstoqueContext();
  const { user, loading: authLoading } = useAuth();
  const { userProfile, canManageStock, isAdmin, loading: permissionsLoading } = usePermissions();
  const { obterEstoqueAtivoInfo, obterLocaisUtilizacaoAtivos, categorias, loading: configLoading } = useConfiguracoes();

  const isInicializandoSolicitacao = authLoading || permissionsLoading || configLoading;

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
      if (!canManageStock() && user?.id) query = query.eq('solicitante_id', user.id);
      
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

      const solicitanteIds = [...new Set((data || []).map((s) => s.solicitante_id).filter(Boolean))];
      const emailsPorUsuario = new Map<string, string>();
      if (solicitanteIds.length > 0) {
        const { data: perfis } = await supabase
          .from('profiles')
          .select('user_id, email')
          .in('user_id', solicitanteIds);
        (perfis || []).forEach((perfil) => emailsPorUsuario.set(perfil.user_id, perfil.email));
      }

      const completas: SolicitacaoMaterialCompleta[] = (data || []).map(s => ({
        ...s,
        solicitante_email: emailsPorUsuario.get(s.solicitante_id)
          || (s.solicitante_id === user?.id ? userProfile?.email : undefined),
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
    // Mostrar todos os itens (inclusive sem saldo) — solicitação é usada para gerar compra
    if (!busca) return itensEstoque.slice(0, 50);
    const termo = busca.toLowerCase();
    return itensEstoque.filter(item =>
      item.nome.toLowerCase().includes(termo) ||
      item.codigoBarras.toString().includes(termo) ||
      item.marca?.toLowerCase().includes(termo)
    ).slice(0, 50);
  }, [busca, itensEstoque]);

  const obterQuantidadeDigitada = () => Number(quantidadeItem.replace(',', '.'));

  const itemVaiParaCompra = (item: { item_id?: string; quantidade: number; isCustom?: boolean }) => {
    if (!item.item_id || item.isCustom) return true;

    const itemEstoque = mapaEstoque.get(item.item_id);
    if (!itemEstoque) return true;

    return itemEstoque.estoqueAtual < item.quantidade;
  };

  const obterItensParaPedidoCompra = (itens: SolicitacaoMaterialCompleta['itens']) => {
    return itens.filter(item => itemVaiParaCompra({ item_id: item.item_id, quantidade: item.quantidade, isCustom: !item.item_id }));
  };

  const adicionarItemEstoque = (item: EstoqueItem) => {
    if (itensLista.find(i => i.item_id === item.id) || solicitacaoParaAdicionar?.itens.some(i => i.item_id === item.id)) {
      toast.error('Este item já foi adicionado');
      return;
    }

    const quantidade = obterQuantidadeDigitada();
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      toast.error('Informe uma quantidade válida maior que zero');
      return;
    }

    // Regra para Ferramentas: Somente 1 unidade
    let qtdEfetiva = quantidade;
    if (itemEhFerramentaUnitaria(item, categorias)) {
      qtdEfetiva = 1;
      if (quantidade > 1) {
        toast.info('Ferramentas são limitadas a 1 unidade por item. Adicione outro item se precisar de mais.');
      }
    }

    setItensLista(prev => [...prev, {
      item_id: item.id,
      nome_item: item.nome,
      quantidade: qtdEfetiva,
      unidade: item.unidade,
      item_snapshot: {
        id: item.id,
        nome: item.nome,
        codigoBarras: item.codigoBarras,
        marca: item.marca,
        unidade: item.unidade,
        especificacao: item.especificacao,
        fotoUrl: item.fotoUrl
      },
      especificacao: especificacaoItem || item.especificacao || undefined,
      observacoes: obsItem || undefined,
      isCustom: false
    }]);

    setPopoverAberto(false);
    setBusca('');
    setQuantidadeItem('');
    setEspecificacaoItem('');
    setObsItem('');
    toast.success('Item adicionado');
  };

  const adicionarItemCustom = () => {
    if (!nomeItemCustom.trim()) {
      toast.error('Digite o nome do item');
      return;
    }

    const quantidade = obterQuantidadeDigitada();
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      toast.error('Informe uma quantidade válida maior que zero');
      return;
    }

    setItensLista(prev => [...prev, {
      nome_item: nomeItemCustom.trim(),
      quantidade,
      unidade: unidadeCustom,
      especificacao: especificacaoItem || undefined,
      observacoes: obsItem || undefined,
      isCustom: true
    }]);

    setNomeItemCustom('');
    setQuantidadeItem('');
    setUnidadeCustom('un');
    setEspecificacaoItem('');
    setObsItem('');
    toast.success('Item avulso adicionado; será encaminhado para PN após a aprovação.');
  };

  const removerItem = (index: number) => {
    setItensLista(prev => prev.filter((_, i) => i !== index));
  };

  const limparFormularioCriacao = () => {
    setItensLista([]);
    setObservacoes('');
    setDataNecessidade('');
    setBusca('');
    setQuantidadeItem('');
    setNomeItemCustom('');
    setUnidadeCustom('un');
    setEspecificacaoItem('');
    setObsItem('');
    setLocalOrigemId('');
    setLocalOrigemNome('');
    setPopoverAberto(false);
  };

  const criarSolicitacao = async () => {
    if (isInicializandoSolicitacao) {
      toast.error('Aguarde o carregamento do seu acesso e das configurações');
      return;
    }

    if (!user || !userProfile) {
      toast.error('Usuário não autenticado');
      return;
    }

    if (itensLista.length === 0) {
      toast.error('Adicione pelo menos um item');
      return;
    }

    if (!localOrigemId || !localOrigemNome.trim()) {
      toast.error('Selecione o local de origem antes de criar a solicitação');
      return;
    }
    if (!dataNecessidade) {
      toast.error('Informe a data de necessidade');
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
          data_necessidade: dataNecessidade,
          estoque_id: estoqueInfo?.id || null,
          local_origem: localOrigemNome || null,
          local_origem_id: localOrigemId || null,
          status: 'pendente'
        } as any)
        .select()
        .single();

      if (solError || !solData) {
        throw solError ?? new Error('Não foi possível criar a solicitação');
      }

      const itensInsert = itensLista.map(item => ({
        solicitacao_material_id: solData.id,
        item_id: item.item_id || null,
        nome_item: item.nome_item,
        quantidade: item.quantidade,
        unidade: item.unidade,
        especificacao: item.especificacao || item.item_snapshot?.especificacao || null,
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
        local_origem: localOrigemNome || undefined,
        local_origem_id: localOrigemId || undefined,
        data_necessidade: dataNecessidade,
        itens: itensInsert.map((item, index) => ({
          id: `${index}`,
          item_id: item.item_id || undefined,
          nome_item: item.nome_item,
          quantidade: item.quantidade,
          unidade: item.unidade,
          especificacao: item.especificacao || undefined,
          item_snapshot: item.item_snapshot || undefined,
          observacoes: item.observacoes || undefined,
        })),
      };

      const itensParaPn = obterItensParaPedidoCompra(solicitacaoCriada.itens);
      toast.success(`Solicitação #${solData.numero} criada com sucesso!`);
      if (itensParaPn.length > 0) {
        toast.info('Itens avulsos ou sem saldo serão encaminhados para PN após a aprovação do Almoxarifado.');
      }

      setDialogoCriar(false);
      limparFormularioCriacao();
    } catch (error: any) {
      console.error('Erro ao criar solicitação:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
      });
      toast.error(`Erro ao criar solicitação: ${error?.message || 'verifique o console'}`);
    } finally {
      setEnviando(false);
    }
  };

  const aprovarSolicitacao = async (id: string) => {
    if (!userProfile || !user) return;
    try {
      // A classificação é feita no banco, com o saldo bloqueado naquele instante.
      // Não usamos o saldo carregado no navegador para decidir PN versus retirada.
      const { data, error } = await (supabase as any).rpc('aprovar_solicitacao_material_v2', {
        p_solicitacao_material_id: id,
      });
      if (error) throw error;

      const resultado = data as {
        itensEstoque: number;
        itensPn: number;
        pnsCriadas: number;
      };
      const mensagens = ['Solicitação aprovada.'];
      if (resultado.itensEstoque > 0) mensagens.push(`${resultado.itensEstoque} item(ns) disponível(is) para retirada.`);
      if (resultado.itensPn > 0) mensagens.push(`${resultado.itensPn} item(ns) encaminhado(s) para PN.`);
      if (resultado.pnsCriadas > 0) mensagens.push(`${resultado.pnsCriadas} PN(s) criada(s).`);
      toast.success(mensagens.join(' '));

      const { data: itensClassificados } = await supabase
        .from('solicitacao_material_itens')
        .select('id, destino_atendimento')
        .eq('solicitacao_material_id', id);
      const destinoPorItem = new Map(
        (itensClassificados || []).map((item) => [item.id, item.destino_atendimento])
      );

      carregarSolicitacoes();
      if (solicitacaoSelecionada?.id === id) {
        setSolicitacaoSelecionada(prev => prev ? {
          ...prev,
          status: 'aprovada',
          aprovado_por_nome: userProfile.nome,
          itens: prev.itens.map((item) => ({
            ...item,
            destino_atendimento: destinoPorItem.get(item.id) as 'estoque' | 'pn' | undefined,
          })),
        } : null);
      }
    } catch (error) {
      const mensagem = formatarErroSupabase(
        error,
        'Não foi possível aprovar a solicitação.',
      );
      console.error('Erro ao aprovar solicitação:', error);
      toast.error(mensagem);
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

  const podeEditarSolicitacao = (solicitacao: SolicitacaoMaterialCompleta) =>
    solicitacao.status === 'pendente' && (solicitacao.solicitante_id === user?.id || canManageStock());

  const iniciarEdicaoSolicitacao = (solicitacao: SolicitacaoMaterialCompleta) => {
    setEdicaoSolicitacao({
      observacoes: solicitacao.observacoes || '',
      data_necessidade: solicitacao.data_necessidade || '',
      itens: solicitacao.itens.map((item) => ({
        id: item.id,
        nome_item: item.nome_item,
        especificacao: item.especificacao || item.item_snapshot?.especificacao || '',
        quantidade: String(item.quantidade),
        unidade: item.unidade,
        observacoes: item.observacoes || '',
      })),
    });
    setModoEdicaoSolicitacao(true);
  };

  const atualizarItemEdicao = (index: number, campo: string, valor: string) => {
    setEdicaoSolicitacao((atual) => atual ? {
      ...atual,
      itens: atual.itens.map((item, posicao) => posicao === index ? { ...item, [campo]: valor } : item),
    } : atual);
  };

  const salvarEdicaoSolicitacao = async () => {
    if (!solicitacaoSelecionada || !edicaoSolicitacao) return;
    if (!podeEditarSolicitacao(solicitacaoSelecionada)) {
      toast.error('Esta solicitação não pode mais ser editada');
      return;
    }
    if (!edicaoSolicitacao.data_necessidade) {
      toast.error('Informe a data de necessidade');
      return;
    }
    if (edicaoSolicitacao.itens.some((item) => !item.nome_item.trim() || !item.unidade.trim() || !Number.isFinite(Number(item.quantidade)) || Number(item.quantidade) <= 0)) {
      toast.error('Preencha nome, unidade e quantidade válida de todos os materiais');
      return;
    }

    setSalvandoEdicaoSolicitacao(true);
    try {
      const itensAtualizados = edicaoSolicitacao.itens.map((item) => ({
        id: item.id,
        nome_item: item.nome_item.trim(),
        especificacao: item.especificacao.trim() || null,
        quantidade: Number(item.quantidade),
        unidade: item.unidade.trim(),
        observacoes: item.observacoes.trim() || null,
      }));
      const { error } = await supabase.rpc('editar_solicitacao_material_pendente_v1', {
        p_solicitacao_material_id: solicitacaoSelecionada.id,
        p_observacoes: edicaoSolicitacao.observacoes.trim() || null,
        p_data_necessidade: edicaoSolicitacao.data_necessidade,
        p_itens: itensAtualizados,
      });
      if (error) throw error;

      const proxima: SolicitacaoMaterialCompleta = {
        ...solicitacaoSelecionada,
        observacoes: edicaoSolicitacao.observacoes.trim() || undefined,
        data_necessidade: edicaoSolicitacao.data_necessidade,
        updated_at: new Date().toISOString(),
        itens: solicitacaoSelecionada.itens.map((item) => {
          const editado = itensAtualizados.find((atual) => atual.id === item.id)!;
          return {
            ...item,
            nome_item: editado.nome_item,
            especificacao: editado.especificacao || undefined,
            quantidade: editado.quantidade,
            unidade: editado.unidade,
            observacoes: editado.observacoes || undefined,
            item_snapshot: item.item_snapshot ? {
              ...item.item_snapshot,
              nome: editado.nome_item,
              especificacao: editado.especificacao || '',
            } : item.item_snapshot,
          };
        }),
      };
      setSolicitacaoSelecionada(proxima);
      setSolicitacoes((atuais) => atuais.map((sol) => sol.id === proxima.id ? proxima : sol));
      setModoEdicaoSolicitacao(false);
      setEdicaoSolicitacao(null);
      toast.success('Solicitação atualizada com histórico preservado');
    } catch (error) {
      console.error('Erro ao editar solicitação:', error);
      toast.error(formatarErroSupabase(error, 'Não foi possível editar a solicitação'));
    } finally {
      setSalvandoEdicaoSolicitacao(false);
    }
  };

  const converterEmRetirada = async (sol: SolicitacaoMaterialCompleta) => {
    if (!user || !userProfile) {
      toast.error('Usuário não autenticado');
      return;
    }

    if (!sol.local_origem_id || !sol.local_origem?.trim()) {
      toast.error('Informe o local de origem antes de confirmar a retirada');
      return;
    }

    const itensEstoqueOnly = sol.itens.filter((item) => item.item_id && item.destino_atendimento === 'estoque');
    if (itensEstoqueOnly.length === 0) {
      toast.info('Esta solicitação foi encaminhada integralmente para PN; não há retirada de estoque a confirmar.');
      return;
    }

    setEnviando(true);
    try {
      // A criação e a aprovação da Solicitação de Material não alteram o estoque.
      // Somente esta confirmação de retirada executa a baixa, de forma atômica no banco.
      const { data, error } = await (supabase as any).rpc(
        'converter_solicitacao_material_retirada_v1',
        { p_solicitacao_material_id: sol.id }
      );

      if (error) throw error;

      const resultado = data as {
        solicitacaoRetiradaId: string | null;
        numeroRetirada: number | null;
        itensProcessados: number;
        jaConvertida: boolean;
        somentePn: boolean;
      };

      if (resultado.somentePn) {
        toast.info('Esta solicitação foi encaminhada integralmente para PN; nenhum item foi baixado do estoque.');
      } else if (resultado.jaConvertida && resultado.solicitacaoRetiradaId) {
        toast.info(
          `Esta Solicitação de Material já havia sido convertida na Retirada #${resultado.numeroRetirada || resultado.solicitacaoRetiradaId.slice(-8)}.`
        );
      } else if (resultado.solicitacaoRetiradaId) {
        toast.success(
          `Retirada #${resultado.numeroRetirada || resultado.solicitacaoRetiradaId.slice(-8)} confirmada. ${resultado.itensProcessados} item(ns) baixado(s) do estoque.`
        );
      }

      if (sol.itens.length > itensEstoqueOnly.length) {
        toast.info(
          `${sol.itens.length - itensEstoqueOnly.length} item(ns) foram encaminhados para PN e não foram incluídos na retirada.`
        );
      }

      await carregarSolicitacoes();
      if (solicitacaoSelecionada?.id === sol.id) {
        setSolicitacaoSelecionada((prev) =>
          prev
            ? {
                ...prev,
                status: resultado.somentePn ? prev.status : 'convertida',
                solicitacao_retirada_id: resultado.solicitacaoRetiradaId || undefined,
              }
            : null
        );
      }
    } catch (error: unknown) {
      console.error('Erro ao confirmar retirada:', error);
      toast.error(
        formatarErroSupabase(
          error,
          'A retirada não foi realizada. Nenhum saldo ou registro foi alterado.',
        ),
      );
    } finally {
      setEnviando(false);
    }
  };

  const abrirAdicaoItens = (solicitacao: SolicitacaoMaterialCompleta) => {
    limparFormularioCriacao();
    setSolicitacaoParaAdicionar(solicitacao);
    setDialogoCriar(true);
  };

  const fecharFormularioSolicitacao = () => {
    setDialogoCriar(false);
    setSolicitacaoParaAdicionar(null);
    limparFormularioCriacao();
  };

  const adicionarItensSolicitacao = async () => {
    if (!solicitacaoParaAdicionar || itensLista.length === 0) {
      toast.error('Adicione pelo menos um item');
      return;
    }

    setEnviando(true);
    try {
      const itens = itensLista.map(item => ({
        item_id: item.item_id || null,
        nome_item: item.nome_item,
        quantidade: item.quantidade,
        unidade: item.unidade,
        especificacao: item.especificacao || null,
        item_snapshot: item.item_snapshot || null,
        observacoes: item.observacoes || null,
      }));

      const { data, error } = await (supabase as any).rpc('adicionar_itens_solicitacao_material', {
        p_solicitacao_id: solicitacaoParaAdicionar.id,
        p_itens: itens,
      });
      if (error) throw error;

      const novosItens = (data || []) as SolicitacaoMaterialCompleta['itens'];
      setSolicitacoes(prev => prev.map(sol => sol.id === solicitacaoParaAdicionar.id
        ? { ...sol, itens: [...sol.itens, ...novosItens] }
        : sol));
      setSolicitacaoSelecionada(prev => prev?.id === solicitacaoParaAdicionar.id
        ? { ...prev, itens: [...prev.itens, ...novosItens] }
        : prev);

      toast.success(`${novosItens.length} item(ns) adicionado(s) à solicitação #${solicitacaoParaAdicionar.numero}`);
      fecharFormularioSolicitacao();
      await carregarSolicitacoes();
    } catch (error: any) {
      console.error('Erro ao adicionar itens à solicitação:', error);
      toast.error(error?.message || 'Não foi possível adicionar os itens');
    } finally {
      setEnviando(false);
    }
  };

  const salvarLocalOrigemSolicitacao = async () => {
    if (!solicitacaoSelecionada || !isAdmin()) return;
    if (!localOrigemEdicaoId) {
      toast.error('Selecione o local de origem');
      return;
    }

    const local = obterLocaisUtilizacaoAtivos().find(l => l.id === localOrigemEdicaoId);
    if (!local) {
      toast.error('Local de origem inválido ou inativo');
      return;
    }

    setSalvandoLocalOrigem(true);
    try {
      const { error } = await supabase
        .from('solicitacoes_material')
        .update({
          local_origem_id: local.id,
          local_origem: local.nome
        } as any)
        .eq('id', solicitacaoSelecionada.id);

      if (error) throw error;

      setSolicitacaoSelecionada(prev => prev ? {
        ...prev,
        local_origem_id: local.id,
        local_origem: local.nome,
      } : prev);
      setSolicitacoes(prev => prev.map(sol =>
        sol.id === solicitacaoSelecionada.id
          ? { ...sol, local_origem_id: local.id, local_origem: local.nome }
          : sol
      ));
      toast.success('Local de origem atualizado');
    } catch (error) {
      console.error('Erro ao atualizar local de origem:', error);
      toast.error('Não foi possível atualizar o local de origem');
    } finally {
      setSalvandoLocalOrigem(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente': return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 gap-1">⏳ Pendente</Badge>;
      case 'aprovada': return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">✅ Aprovada</Badge>;
      case 'rejeitada': return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1">❌ Rejeitada</Badge>;
      case 'convertida': return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 gap-1">🔄 Convertida em Retirada</Badge>;
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
          ${sol.local_origem ? `<div class="info-item"><div class="info-label">Local de Origem</div>${sol.local_origem}</div>` : ''}
          ${sol.observacoes ? `<div class="info-item" style="grid-column: span 2"><div class="info-label">Observações</div>${sol.observacoes}</div>` : ''}
          ${sol.aprovado_por_nome ? `<div class="info-item"><div class="info-label">Aprovado por</div>${sol.aprovado_por_nome}</div>` : ''}
          ${sol.data_aprovacao ? `<div class="info-item"><div class="info-label">Data Aprovação</div>${format(new Date(sol.data_aprovacao), "dd/MM/yyyy HH:mm", { locale: ptBR })}</div>` : ''}
        </div>
        <table>
          <thead><tr><th>#</th><th>Item</th><th>Especificação</th><th>Qtd</th><th>Unidade</th><th>Tipo</th><th>Obs</th></tr></thead>
          <tbody>
            ${sol.itens.map((item, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${item.nome_item}${item.item_id && item.item_snapshot?.codigoBarras ? '<br><small style="color:#888">Cód: ' + item.item_snapshot.codigoBarras + '</small>' : ''}</td>
                <td>${item.especificacao || item.item_snapshot?.especificacao || '-'}</td>
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

  const carregarLogoParaPdf = async (): Promise<string | null> => {
    try {
      const { data: arquivos, error } = await supabase.storage
        .from('branding')
        .list('', { limit: 20, sortBy: { column: 'updated_at', order: 'desc' } });
      if (error || !arquivos?.length) return null;

      const arquivo = arquivos.find((item) => /^logo\./i.test(item.name)) || arquivos[0];
      const { data } = supabase.storage.from('branding').getPublicUrl(arquivo.name);
      const resposta = await fetch(data.publicUrl);
      if (!resposta.ok) return null;
      const blob = await resposta.blob();

      return await new Promise<string>((resolve, reject) => {
        const leitor = new FileReader();
        leitor.onload = () => resolve(String(leitor.result));
        leitor.onerror = () => reject(leitor.error);
        leitor.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const gerarPDF = async (sol: SolicitacaoMaterialCompleta) => {
    try {
      const [{ default: jsPDF }, { default: autoTable }, logoDataUrl] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
        carregarLogoParaPdf(),
      ]);
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const estoqueInfo = obterEstoqueAtivoInfo();
      const verdeEscuro: [number, number, number] = [18, 82, 67];
      const verde: [number, number, number] = [29, 126, 96];
      const cinza: [number, number, number] = [83, 96, 104];
      const statusLabel: Record<string, string> = {
        pendente: 'PENDENTE', aprovada: 'APROVADA', rejeitada: 'REJEITADA', convertida: 'CONVERTIDA',
      };
      const quantidadeTotal = sol.itens.reduce((total, item) => total + Number(item.quantidade || 0), 0);
      const loginSolicitante = sol.solicitante_email
        || (sol.solicitante_id === user?.id ? userProfile?.email : undefined)
        || 'Não informado';

      doc.setFillColor(...verdeEscuro);
      doc.rect(0, 0, 210, 33, 'F');
      if (logoDataUrl) {
        try {
          const propriedades = doc.getImageProperties(logoDataUrl);
          const largura = Math.min(42, 18 * (propriedades.width / propriedades.height));
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(12, 6, largura + 8, 21, 2, 2, 'F');
          doc.addImage(logoDataUrl, propriedades.fileType, 16, 8, largura, 17);
        } catch {
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(17);
          doc.text('BAMBUSA', 14, 20);
        }
      } else {
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(17);
        doc.text('BAMBUSA', 14, 20);
      }

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text('SOLICITAÇÃO DE MATERIAL', 198, 14, { align: 'right' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Documento nº ${String(sol.numero).padStart(4, '0')}`, 198, 21, { align: 'right' });
      doc.text(`Emitido em ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 198, 27, { align: 'right' });

      doc.setTextColor(...verdeEscuro);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('DADOS DA SOLICITAÇÃO', 14, 42);
      doc.setDrawColor(210, 218, 216);
      doc.line(14, 44, 196, 44);

      const metadados = [
        ['Solicitante', sol.solicitante_nome],
        ['Login Bambusa', loginSolicitante],
        ['Data da solicitação', format(new Date(sol.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })],
        ['Data de necessidade', sol.data_necessidade ? format(new Date(`${sol.data_necessidade}T12:00:00`), 'dd/MM/yyyy', { locale: ptBR }) : 'Não informada'],
        ['Status', statusLabel[sol.status] || sol.status.toUpperCase()],
        ['Estoque / local', [estoqueInfo?.nome, sol.local_origem].filter(Boolean).join(' - ') || 'Não informado'],
      ];
      metadados.forEach(([rotulo, valor], indice) => {
        const coluna = indice % 2;
        const linha = Math.floor(indice / 2);
        const x = 14 + coluna * 92;
        const y = 50 + linha * 14;
        doc.setFillColor(246, 249, 248);
        doc.roundedRect(x, y, 88, 11, 1.5, 1.5, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...cinza);
        doc.text(rotulo.toUpperCase(), x + 3, y + 4);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 41, 46);
        doc.text(doc.splitTextToSize(String(valor), 81)[0], x + 3, y + 8.5);
      });

      doc.setFillColor(232, 246, 240);
      doc.roundedRect(14, 94, 182, 13, 1.5, 1.5, 'F');
      doc.setTextColor(...verdeEscuro);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`${sol.itens.length} ${sol.itens.length === 1 ? 'item solicitado' : 'itens solicitados'}`, 19, 102);
      doc.text(`Quantidade total: ${quantidadeTotal.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}`, 191, 102, { align: 'right' });

      const tableData = sol.itens.map((item, i) => [
        i + 1,
        item.item_id && item.item_snapshot?.codigoBarras
          ? `${item.nome_item}\nCód.: ${item.item_snapshot.codigoBarras}`
          : item.nome_item,
        item.especificacao || item.item_snapshot?.especificacao || '-',
        Number(item.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 3 }),
        item.unidade,
        item.observacoes || '-',
      ]);

      autoTable(doc, {
        startY: 112,
        margin: { left: 14, right: 14, bottom: 24 },
        head: [['#', 'Material', 'Especificação', 'Quantidade', 'Un.', 'Observações']],
        body: tableData,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.4, valign: 'middle', lineColor: [221, 226, 224], lineWidth: 0.2 },
        headStyles: { fillColor: verde, textColor: 255, fontStyle: 'bold', halign: 'left' },
        alternateRowStyles: { fillColor: [248, 250, 249] },
        columnStyles: {
          0: { cellWidth: 9, halign: 'center' },
          1: { cellWidth: 47 },
          2: { cellWidth: 48 },
          3: { cellWidth: 24, halign: 'right' },
          4: { cellWidth: 13, halign: 'center' },
          5: { cellWidth: 41 },
        },
      });

      const tabelaFinalY = (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 112;
      let assinaturaY = tabelaFinalY + 18;
      if (assinaturaY > 260) {
        doc.addPage();
        assinaturaY = 35;
      }
      if (sol.observacoes) {
        doc.setTextColor(...verdeEscuro);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('OBSERVAÇÕES GERAIS', 14, assinaturaY - 8);
        doc.setTextColor(45, 55, 60);
        doc.setFont('helvetica', 'normal');
        doc.text(doc.splitTextToSize(sol.observacoes, 182), 14, assinaturaY - 3);
        assinaturaY += Math.max(8, doc.splitTextToSize(sol.observacoes, 182).length * 4);
      }
      doc.setDrawColor(130, 140, 138);
      doc.line(22, assinaturaY + 15, 91, assinaturaY + 15);
      doc.line(119, assinaturaY + 15, 188, assinaturaY + 15);
      doc.setFontSize(8);
      doc.setTextColor(...cinza);
      doc.text('Solicitante', 56.5, assinaturaY + 20, { align: 'center' });
      doc.text('Responsável pelo atendimento', 153.5, assinaturaY + 20, { align: 'center' });

      const paginas = doc.getNumberOfPages();
      for (let pagina = 1; pagina <= paginas; pagina += 1) {
        doc.setPage(pagina);
        doc.setDrawColor(220, 225, 223);
        doc.line(14, 284, 196, 284);
        doc.setFontSize(7);
        doc.setTextColor(110, 120, 118);
        doc.text('Bambusa - Documento gerado pelo sistema de gestão', 14, 289);
        doc.text(`Página ${pagina} de ${paginas}`, 196, 289, { align: 'right' });
      }

      doc.save(`solicitacao-material-${String(sol.numero).padStart(4, '0')}.pdf`);
      toast.success('PDF profissional gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF da solicitação:', error);
      toast.error('Não foi possível gerar o PDF da solicitação');
    }
  };

  return (
    <>
      {/* Botão no Menu Principal */}
      <Card
        className="group cursor-pointer hover:scale-105 transition-all duration-300 border-amber-500/30 hover:border-amber-400 bg-gradient-to-br from-amber-950/20 to-orange-950/20 shadow-sm relative overflow-hidden"
        onClick={() => {
          setDialogoListar(true);
          carregarSolicitacoes();
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <CardHeader className="text-center relative z-10">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
            <ClipboardList className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-amber-400">Solicitação de Material</CardTitle>
          <CardDescription className="text-amber-500/70">
            Solicite itens do estoque ou itens não cadastrados. O Almoxarifado define retirada ou PN.
          </CardDescription>
          {pendentesCount > 0 && canManageStock() && (
            <Badge className="absolute top-2 right-2 bg-red-500 text-white border-none animate-pulse shadow-lg shadow-red-500/20">
              {pendentesCount}
            </Badge>
          )}
        </CardHeader>
      </Card>

      {/* Dialog Listar Solicitações */}
      <Dialog open={dialogoListar} onOpenChange={setDialogoListar}>
        <DialogContent className="w-[95vw] sm:w-full max-w-5xl max-h-[90vh] overflow-y-auto">
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
            <Button onClick={() => { setSolicitacaoParaAdicionar(null); limparFormularioCriacao(); setDialogoCriar(true); }} className="gap-2">
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
                  <TableHead>Local de Origem</TableHead>
                  <TableHead>Data necessária</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="min-w-[250px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {solicitacoes.map(sol => (
                  <TableRow key={sol.id}>
                    <TableCell className="font-mono">#{sol.numero}</TableCell>
                    <TableCell>{sol.solicitante_nome}</TableCell>
                    <TableCell>{sol.itens.length} item(ns)</TableCell>
                    <TableCell>{sol.local_origem || '-'}</TableCell>
                    <TableCell>{sol.data_necessidade ? format(new Date(`${sol.data_necessidade}T12:00:00`), "dd/MM/yyyy", { locale: ptBR }) : '—'}</TableCell>
                    <TableCell>{format(new Date(sol.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                    <TableCell>{getStatusBadge(sol.status)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Button variant="ghost" size="icon" title="Visualizar solicitação" onClick={() => { setSolicitacaoSelecionada(sol); setLocalOrigemEdicaoId(sol.local_origem_id || ''); setModoEdicaoSolicitacao(false); setEdicaoSolicitacao(null); setDialogoDetalhes(true); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => imprimirSolicitacao(sol)}>
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1" title="Baixar solicitação em PDF" onClick={() => void gerarPDF(sol)}>
                          <FileText className="h-4 w-4" /> PDF
                        </Button>
                        {podeEditarSolicitacao(sol) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => {
                              setSolicitacaoSelecionada(sol);
                              setLocalOrigemEdicaoId(sol.local_origem_id || '');
                              iniciarEdicaoSolicitacao(sol);
                              setDialogoDetalhes(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" /> Editar
                          </Button>
                        )}
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-primary hover:text-primary/80"
                            title={sol.local_origem_id && sol.local_origem ? "Converter em Retirada" : "Informe o Local de Origem antes de converter"}
                            disabled={!sol.local_origem_id || !sol.local_origem}
                            onClick={() => converterEmRetirada(sol)}
                          >
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
      <Dialog open={dialogoDetalhes} onOpenChange={(aberto) => { setDialogoDetalhes(aberto); if (!aberto) { setModoEdicaoSolicitacao(false); setEdicaoSolicitacao(null); } }}>
        <DialogContent className="w-[95vw] sm:w-full max-w-3xl max-h-[90vh] overflow-y-auto">
          {solicitacaoSelecionada && (
            <>
              <DialogHeader>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <DialogTitle className="flex items-center gap-2">
                    📋 Solicitação #{solicitacaoSelecionada.numero}
                    {getStatusBadge(solicitacaoSelecionada.status)}
                  </DialogTitle>
                  {podeEditarSolicitacao(solicitacaoSelecionada) && !modoEdicaoSolicitacao && (
                    <Button type="button" variant="outline" size="sm" onClick={() => iniciarEdicaoSolicitacao(solicitacaoSelecionada)}>
                      <Pencil className="mr-2 h-4 w-4" /> Editar solicitação
                    </Button>
                  )}
                </div>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Solicitante:</span> {solicitacaoSelecionada.solicitante_nome}</div>
                <div><span className="text-muted-foreground">Data:</span> {format(new Date(solicitacaoSelecionada.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</div>
                <div>
                  <span className="text-muted-foreground">Data necessária:</span>{' '}
                  {modoEdicaoSolicitacao && edicaoSolicitacao
                    ? <Input type="date" className="mt-1" value={edicaoSolicitacao.data_necessidade} onChange={(e) => setEdicaoSolicitacao((atual) => atual ? { ...atual, data_necessidade: e.target.value } : atual)} />
                    : solicitacaoSelecionada.data_necessidade ? format(new Date(`${solicitacaoSelecionada.data_necessidade}T12:00:00`), "dd/MM/yyyy", { locale: ptBR }) : 'Não informada'}
                </div>
                {modoEdicaoSolicitacao && edicaoSolicitacao ? (
                  <div className="col-span-2 space-y-1"><Label>Observações gerais</Label><Textarea value={edicaoSolicitacao.observacoes} onChange={(e) => setEdicaoSolicitacao((atual) => atual ? { ...atual, observacoes: e.target.value } : atual)} /></div>
                ) : solicitacaoSelecionada.observacoes ? (
                  <div className="col-span-2"><span className="text-muted-foreground">Observações:</span> {solicitacaoSelecionada.observacoes}</div>
                ) : null}
                {solicitacaoSelecionada.aprovado_por_nome && (
                  <div><span className="text-muted-foreground">Aprovado por:</span> {solicitacaoSelecionada.aprovado_por_nome}</div>
                )}
                <div className={cn(!solicitacaoSelecionada.local_origem && "text-destructive")}>
                  <span className="text-muted-foreground">Local de Origem:</span> {solicitacaoSelecionada.local_origem || 'Não informado'}
                </div>
              </div>

              {isAdmin() && (
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                  <Label>Corrigir Local de Origem</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <SearchableSelect
                      value={localOrigemEdicaoId}
                      onValueChange={setLocalOrigemEdicaoId}
                      placeholder="Selecione o local de origem"
                      searchPlaceholder="Buscar local de origem..."
                      options={obterLocaisUtilizacaoAtivos().map((local) => ({ value: local.id, label: local.nome }))}
                    />
                    <Button
                      type="button"
                      onClick={salvarLocalOrigemSolicitacao}
                      disabled={salvandoLocalOrigem || !localOrigemEdicaoId}
                      className="sm:w-auto"
                    >
                      {salvandoLocalOrigem ? 'Salvando...' : 'Salvar Local'}
                    </Button>
                  </div>
                </div>
              )}

              <Separator />

              <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Foto</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Especificação</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Obs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {solicitacaoSelecionada.itens.map((item, i) => {
                    const vaiParaCompra = solicitacaoSelecionada.status === 'pendente'
                      ? itemVaiParaCompra({ ...item, isCustom: !item.item_id })
                      : item.destino_atendimento === 'pn';
                    const itemEdicao = edicaoSolicitacao?.itens[i];

                    return (
                      <TableRow key={item.id}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>
                          <ItemFotoMiniatura fotoUrl={item.item_snapshot?.fotoUrl} nome={item.nome_item} />
                        </TableCell>
                        <TableCell className="font-medium">
                          {modoEdicaoSolicitacao && itemEdicao ? <Input value={itemEdicao.nome_item} onChange={(e) => atualizarItemEdicao(i, 'nome_item', e.target.value)} /> : <div className="flex items-center gap-1">{item.nome_item}</div>}
                          {item.item_id && item.item_snapshot?.codigoBarras && (
                            <span className="block text-xs text-muted-foreground">Cód: {item.item_snapshot.codigoBarras}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {modoEdicaoSolicitacao && itemEdicao
                            ? <Input value={itemEdicao.especificacao} onChange={(e) => atualizarItemEdicao(i, 'especificacao', e.target.value)} placeholder="Medida, material, acabamento..." />
                            : item.especificacao || item.item_snapshot?.especificacao || '-'}
                        </TableCell>
                        <TableCell>
                          {modoEdicaoSolicitacao && itemEdicao ? <Input type="number" min="0.01" step="0.01" className="w-24" value={itemEdicao.quantidade} onChange={(e) => atualizarItemEdicao(i, 'quantidade', e.target.value)} /> : <span>{item.quantidade}</span>}
                        </TableCell>
                        <TableCell>{modoEdicaoSolicitacao && itemEdicao ? <Input className="w-20" value={itemEdicao.unidade} onChange={(e) => atualizarItemEdicao(i, 'unidade', e.target.value)} /> : item.unidade}</TableCell>
                        <TableCell>
                          <Badge variant={vaiParaCompra ? 'secondary' : 'default'}>
                            {vaiParaCompra ? 'Previsão de Necessidade (PN)' : 'Estoque'}
                          </Badge>
                        </TableCell>
                        <TableCell>{modoEdicaoSolicitacao && itemEdicao ? <Input value={itemEdicao.observacoes} onChange={(e) => atualizarItemEdicao(i, 'observacoes', e.target.value)} /> : item.observacoes || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>

              <div className="flex flex-col sm:flex-row justify-between pt-4 gap-4 border-t mt-4">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => imprimirSolicitacao(solicitacaoSelecionada)} className="gap-2 flex-1 sm:flex-none">
                    <Printer className="h-4 w-4 shrink-0" /> <span className="truncate">Imprimir</span>
                  </Button>
                  <Button variant="outline" onClick={() => gerarPDF(solicitacaoSelecionada)} className="gap-2 flex-1 sm:flex-none">
                    <FileText className="h-4 w-4 shrink-0" /> <span className="truncate">Baixar PDF</span>
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {modoEdicaoSolicitacao && (
                    <>
                      <Button variant="outline" disabled={salvandoEdicaoSolicitacao} onClick={() => { setModoEdicaoSolicitacao(false); setEdicaoSolicitacao(null); }}>Cancelar edição</Button>
                      <Button disabled={salvandoEdicaoSolicitacao} onClick={() => void salvarEdicaoSolicitacao()}>
                        <Save className="mr-2 h-4 w-4" /> {salvandoEdicaoSolicitacao ? 'Salvando...' : 'Salvar alterações'}
                      </Button>
                    </>
                  )}
                  {!modoEdicaoSolicitacao && solicitacaoSelecionada.status === 'pendente' && solicitacaoSelecionada.solicitante_id === user?.id && (
                    <Button variant="outline" className="gap-1 flex-1 sm:flex-none" onClick={() => abrirAdicaoItens(solicitacaoSelecionada)}>
                      <Plus className="h-4 w-4 shrink-0" /> <span className="truncate">Adicionar itens</span>
                    </Button>
                  )}
                  {!modoEdicaoSolicitacao && canManageStock() && solicitacaoSelecionada.status === 'pendente' && (
                    <>
                      <Button variant="outline" className="text-red-400 border-red-400/30 flex-1 sm:flex-none" onClick={() => rejeitarSolicitacao(solicitacaoSelecionada.id)}>
                        <X className="h-4 w-4 mr-1 shrink-0" /> <span className="truncate">Rejeitar</span>
                      </Button>
                      <Button className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none" onClick={() => aprovarSolicitacao(solicitacaoSelecionada.id)}>
                        <Check className="h-4 w-4 mr-1 shrink-0" /> <span className="truncate">Aprovar</span>
                      </Button>
                    </>
                  )}
                  {!modoEdicaoSolicitacao && canManageStock() && solicitacaoSelecionada.status === 'aprovada' && (
                    <Button
                      className="gap-1 bg-primary hover:bg-primary/90 flex-1 sm:flex-none"
                      disabled={!solicitacaoSelecionada.local_origem_id || !solicitacaoSelecionada.local_origem}
                      title={solicitacaoSelecionada.local_origem_id && solicitacaoSelecionada.local_origem ? undefined : "Informe o Local de Origem antes de converter"}
                      onClick={() => converterEmRetirada(solicitacaoSelecionada)}
                    >
                      <ArrowRight className="h-4 w-4 shrink-0" /> <span className="truncate">Converter em Retirada</span>
                    </Button>
                  )}
                  {!modoEdicaoSolicitacao && isAdmin() && (
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
      <Dialog open={dialogoCriar} onOpenChange={(aberto) => aberto ? setDialogoCriar(true) : fecharFormularioSolicitacao()}>
        <DialogContent className="w-[95vw] sm:w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" /> {solicitacaoParaAdicionar ? `Adicionar itens à Solicitação #${solicitacaoParaAdicionar.numero}` : 'Nova Solicitação de Material'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {!solicitacaoParaAdicionar && <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="local_origem">Local de Origem *</Label>
                <SearchableSelect
                  value={localOrigemId}
                  onValueChange={(value) => {
                    setLocalOrigemId(value);
                    const nome = obterLocaisUtilizacaoAtivos().find((l) => l.id === value)?.nome || '';
                    setLocalOrigemNome(nome);
                  }}
                  placeholder="Selecione o local de origem"
                  searchPlaceholder="Buscar local de origem..."
                  options={obterLocaisUtilizacaoAtivos().map((local) => ({ value: local.id, label: local.nome }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data_necessidade">Data de necessidade *</Label>
                <Input id="data_necessidade" type="date" value={dataNecessidade} onChange={(e) => setDataNecessidade(e.target.value)} required />
                <p className="text-xs text-muted-foreground">A data acompanhará a PN e a RC quando houver compra.</p>
              </div>
            </div>}

            {solicitacaoParaAdicionar && (
              <p className="text-sm text-muted-foreground">
                Os novos itens serão incluídos na solicitação pendente. Após a aprovação pelo Almoxarifado, novas inclusões serão bloqueadas.
              </p>
            )}

            <h3 className="text-sm font-medium">Adicionar item do estoque</h3>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label>Item</Label>
                <Popover modal={true} open={popoverAberto} onOpenChange={setPopoverAberto}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      Buscar item no estoque...
                      <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[440px] p-0" align="start" side="bottom" avoidCollisions={false} sideOffset={4}>
                    <Command>
                      <CommandInput placeholder="Buscar por nome, código..." value={busca} onValueChange={setBusca} />
                      <CommandList className="max-h-[250px]">
                        <CommandEmpty>Nenhum item encontrado</CommandEmpty>
                        <CommandGroup>
                          {itensFiltrados.map(item => {
                            const quantidade = obterQuantidadeDigitada();
                            const vaiParaCompra = Number.isFinite(quantidade) && quantidade > 0 && item.estoqueAtual < quantidade;

                            return (
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
                                <div className="flex items-center gap-3 w-full">
                                  <ItemFotoMiniatura
                                    fotoUrl={item.fotoUrl}
                                    nome={item.nome}
                                    className="h-10 w-10 flex-shrink-0"
                                    placeholderClassName="h-10 w-10 flex-shrink-0"
                                    disableZoom
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium truncate">{item.nome}</span>
                                      {vaiParaCompra && (
                                        <Badge variant="secondary" className="text-[10px]">Compra</Badge>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      Cód: {item.codigoBarras} • Estoque: {item.estoqueAtual} {item.unidade}
                                    </div>
                                  </div>
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="w-24">
                <Label>Qtd</Label>
                <Input type="number" min={1} value={quantidadeItem} onChange={(e) => setQuantidadeItem(e.target.value)} placeholder="Qtd" />
              </div>
            </div>

            <Separator />

            <h3 className="text-sm font-medium">Ou adicionar item que não está no estoque</h3>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label>Nome do item</Label>
                <Input value={nomeItemCustom} onChange={(e) => setNomeItemCustom(e.target.value)} placeholder="Digite o nome do material necessário" />
              </div>
              <div className="w-24">
                <Label>Qtd</Label>
                <Input type="number" min={1} value={quantidadeItem} onChange={(e) => setQuantidadeItem(e.target.value)} placeholder="Qtd" />
              </div>
              <div className="w-24">
                <Label>Unidade</Label>
                <Input value={unidadeCustom} onChange={(e) => setUnidadeCustom(e.target.value)} placeholder="un" />
              </div>
              <Button type="button" onClick={adicionarItemCustom} variant="secondary" className="gap-1 whitespace-nowrap">
                <Plus className="h-4 w-4" /> Adicionar
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Especificação do material</Label>
                <Input value={especificacaoItem} onChange={(e) => setEspecificacaoItem(e.target.value)} placeholder="Ex: seção, comprimento, espécie, acabamento..." />
              </div>
              <div>
                <Label>Observação do item (opcional)</Label>
                <Input value={obsItem} onChange={(e) => setObsItem(e.target.value)} placeholder="Ex: urgente, referência de uso..." />
              </div>
            </div>

            <Separator />

            {itensLista.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">Itens da solicitação ({itensLista.length})</h3>
                <div className="overflow-x-auto">
                  <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Foto</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Especificação</TableHead>
                      <TableHead>Qtd</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead>Destino</TableHead>
                      <TableHead>Obs</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itensLista.map((item, i) => {
                      const vaiParaCompra = itemVaiParaCompra(item);

                      return (
                        <TableRow key={i}>
                          <TableCell>
                            <ItemFotoMiniatura fotoUrl={item.item_snapshot?.fotoUrl} nome={item.nome_item} />
                          </TableCell>
                          <TableCell className="font-medium">
                            {item.nome_item}
                            {!item.isCustom && item.item_snapshot?.codigoBarras && (
                              <span className="block text-xs text-muted-foreground">Cód: {item.item_snapshot.codigoBarras}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.especificacao || item.item_snapshot?.especificacao || '-'}</TableCell>
                          <TableCell>{item.quantidade}</TableCell>
                          <TableCell>{item.unidade}</TableCell>
                          <TableCell>
                            <Badge variant={vaiParaCompra ? 'secondary' : 'default'} className="text-xs">
                              {vaiParaCompra ? 'Previsão de Necessidade (PN)' : 'Estoque'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.observacoes || '-'}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => removerItem(i)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              </div>
            )}

            {!solicitacaoParaAdicionar && <div>
              <Label>Observações gerais</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Observações sobre a solicitação (opcional)" rows={2} />
            </div>}

            <div className="flex justify-between items-center pt-4 border-t gap-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={fecharFormularioSolicitacao}
                className="hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                onClick={solicitacaoParaAdicionar ? adicionarItensSolicitacao : criarSolicitacao}
                disabled={enviando || isInicializandoSolicitacao || itensLista.length === 0 || (!solicitacaoParaAdicionar && (!localOrigemId || !dataNecessidade))}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 transition-all duration-300 hover:scale-[1.02]"
              >
                {enviando ? 'Enviando...' : isInicializandoSolicitacao ? 'Carregando...' : solicitacaoParaAdicionar ? 'Adicionar à solicitação' : '🚀 Criar Solicitação'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
