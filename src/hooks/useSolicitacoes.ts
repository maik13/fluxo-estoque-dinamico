import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { usePermissions } from './usePermissions';
import { NovaSolicitacao, Solicitacao, SolicitacaoCompleta, SolicitacaoItem } from '@/types/solicitacao';
import { Item } from '@/types/estoque';
import { toast } from 'sonner';

export const useSolicitacoes = () => {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoCompleta[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { userProfile, canManageStock } = usePermissions();

  useEffect(() => {
    if (user) {
      carregarSolicitacoes();
    }
  }, [user]);

  // Realtime: atualiza automaticamente quando houver mudanças nas solicitações
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('solicitacoes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes' }, () => {
        carregarSolicitacoes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const carregarSolicitacoes = async () => {
    try {
      setLoading(true);

      // Carregar solicitações
      const { data: solicitacoesData, error: solicitacoesError } = await supabase
        .from('solicitacoes')
        .select('*')
        .order('data_solicitacao', { ascending: false });

      if (solicitacoesError) throw solicitacoesError;

      // Carregar itens das solicitações
      const { data: itensData, error: itensError } = await supabase
        .from('solicitacao_itens')
        .select('*');

      if (itensError) throw itensError;

      // Combinar dados
      const solicitacoesCompletas: SolicitacaoCompleta[] = (solicitacoesData || []).map(solicitacao => ({
        ...solicitacao,
        status: solicitacao.status as 'pendente' | 'aprovada' | 'rejeitada',
        itens: (itensData || []).filter(item => item.solicitacao_id === solicitacao.id).map(item => ({
          ...item,
          item_snapshot: item.item_snapshot as Partial<Item>
        }))
      }));

      setSolicitacoes(solicitacoesCompletas);
    } catch (error) {
      console.error('Erro ao carregar solicitações:', error);
      toast.error('Erro ao carregar solicitações');
    } finally {
      setLoading(false);
    }
  };

  const criarSolicitacao = async (novaSolicitacao: NovaSolicitacao): Promise<boolean> => {
    if (!user || !userProfile) {
      toast.error('Usuário não autenticado');
      return false;
    }

    try {
      // Buscar o user_id do solicitante selecionado
      let solicitanteUserId = user.id;
      let solicitanteNome = userProfile.nome;
      
      if (novaSolicitacao.solicitante_id && novaSolicitacao.solicitante_nome) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('id', novaSolicitacao.solicitante_id)
          .single();
        
        if (profileData) {
          solicitanteUserId = profileData.user_id;
          solicitanteNome = novaSolicitacao.solicitante_nome;
        }
      }

      // Criar solicitação
      const { data: solicitacaoData, error: solicitacaoError } = await supabase
        .from('solicitacoes')
        .insert([{
          solicitante_id: solicitanteUserId,
          solicitante_nome: solicitanteNome,
          observacoes: novaSolicitacao.observacoes,
          local_utilizacao: novaSolicitacao.local_utilizacao,
          responsavel_estoque: novaSolicitacao.responsavel_estoque,
          tipo_operacao: novaSolicitacao.tipo_operacao || 'saida_producao',
          solicitacao_origem_id: novaSolicitacao.solicitacao_origem_id
        }])
        .select()
        .single();

      if (solicitacaoError) throw solicitacaoError;

      // Criar itens da solicitação
      const itensParaInserir = novaSolicitacao.itens.map(item => ({
        solicitacao_id: solicitacaoData.id,
        item_id: item.item_id,
        quantidade_solicitada: item.quantidade_solicitada,
        item_snapshot: item.item_snapshot
      }));

      const { error: itensError } = await supabase
        .from('solicitacao_itens')
        .insert(itensParaInserir);

      if (itensError) throw itensError;

      toast.success('Solicitação criada com sucesso!');
      await carregarSolicitacoes();
      return true;
    } catch (error) {
      console.error('Erro ao criar solicitação:', error);
      toast.error('Erro ao criar solicitação');
      return false;
    }
  };

  const aprovarSolicitacao = async (solicitacaoId: string, itensAprovados: { id: string; quantidade: number }[]): Promise<boolean> => {
    if (!user || !userProfile || !canManageStock()) {
      toast.error('Sem permissão para aprovar solicitações');
      return false;
    }

    try {
      // Obter dados da solicitação
      const { data: solicitacao, error: solicitacaoFetchError } = await supabase
        .from('solicitacoes')
        .select('*, solicitacao_itens(*)')
        .eq('id', solicitacaoId)
        .single();

      if (solicitacaoFetchError) throw solicitacaoFetchError;

      // Atualizar status da solicitação
      const { error: solicitacaoError } = await supabase
        .from('solicitacoes')
        .update({
          status: 'aprovada',
          data_aprovacao: new Date().toISOString(),
          aprovado_por_id: user.id,
          aprovado_por_nome: userProfile.nome
        })
        .eq('id', solicitacaoId);

      if (solicitacaoError) throw solicitacaoError;

      // Atualizar quantidades aprovadas dos itens e processar movimentações
      for (const itemAprovado of itensAprovados) {
        // Atualizar quantidade aprovada
        const { error: itemError } = await supabase
          .from('solicitacao_itens')
          .update({ quantidade_aprovada: itemAprovado.quantidade })
          .eq('id', itemAprovado.id);

        if (itemError) throw itemError;

        // Obter dados completos do item da solicitação
        const { data: solicitacaoItem } = await supabase
          .from('solicitacao_itens')
          .select('*')
          .eq('id', itemAprovado.id)
          .single();

        if (!solicitacaoItem) continue;

        // Obter item do estoque
        const { data: itemEstoque, error: itemEstoqueError } = await supabase
          .from('items')
          .select('*')
          .eq('id', solicitacaoItem.item_id)
          .single();

        if (itemEstoqueError) throw itemEstoqueError;

        const quantidadeAnterior = itemEstoque.quantidade;
        let novaQuantidade = quantidadeAnterior;
        let tipoMovimentacao: 'ENTRADA' | 'SAIDA' = 'SAIDA';

        // Determinar tipo de operação
        const isRetirada = !solicitacao.tipo_operacao || 
                          solicitacao.tipo_operacao === 'saida_producao' || 
                          solicitacao.tipo_operacao === 'saida_obra';
        
        const isDevolucao = solicitacao.tipo_operacao === 'devolucao' || 
                           solicitacao.tipo_operacao === 'devolucao_estoque';

        if (isRetirada) {
          // Retirada: subtrai do estoque
          novaQuantidade = quantidadeAnterior - itemAprovado.quantidade;
          tipoMovimentacao = 'SAIDA';
        } else if (isDevolucao) {
          // Devolução: adiciona ao estoque
          novaQuantidade = quantidadeAnterior + itemAprovado.quantidade;
          tipoMovimentacao = 'ENTRADA';
        }

        // Atualizar quantidade no estoque
        const { error: updateEstoqueError } = await supabase
          .from('items')
          .update({ quantidade: novaQuantidade })
          .eq('id', solicitacaoItem.item_id);

        if (updateEstoqueError) throw updateEstoqueError;

        // Criar movimentação com solicitacao_id no item_snapshot
        const itemSnapshotComSolicitacao = {
          ...(solicitacaoItem.item_snapshot as object || {}),
          solicitacao_id: solicitacaoId
        };

        const { error: movimentacaoError } = await supabase
          .from('movements')
          .insert({
            item_id: solicitacaoItem.item_id,
            tipo: tipoMovimentacao,
            quantidade: itemAprovado.quantidade,
            quantidade_anterior: quantidadeAnterior,
            quantidade_atual: novaQuantidade,
            responsavel: userProfile.nome,
            observacoes: `${isDevolucao ? 'Devolução' : 'Retirada'} aprovada - Solicitação #${solicitacao.numero || solicitacaoId.slice(-8)}${solicitacao.observacoes ? ' - ' + solicitacao.observacoes : ''}`,
            local_utilizacao: solicitacao.local_utilizacao,
            item_snapshot: itemSnapshotComSolicitacao
          });

        if (movimentacaoError) throw movimentacaoError;
      }

      toast.success('Solicitação aprovada e estoque atualizado!');
      await carregarSolicitacoes();
      return true;
    } catch (error) {
      console.error('Erro ao aprovar solicitação:', error);
      toast.error('Erro ao aprovar solicitação');
      return false;
    }
  };

  const rejeitarSolicitacao = async (solicitacaoId: string): Promise<boolean> => {
    if (!user || !userProfile || !canManageStock()) {
      toast.error('Sem permissão para rejeitar solicitações');
      return false;
    }

    try {
      const { error } = await supabase
        .from('solicitacoes')
        .update({
          status: 'rejeitada',
          data_aprovacao: new Date().toISOString(),
          aprovado_por_id: user.id,
          aprovado_por_nome: userProfile.nome
        })
        .eq('id', solicitacaoId);

      if (rejeitarSolicitacao) throw error;

      toast.success('Solicitação rejeitada');
      await carregarSolicitacoes();
      return true;
    } catch (error) {
      console.error('Erro ao rejeitar solicitação:', error);
      toast.error('Erro ao rejeitar solicitação');
      return false;
    }
  };

  const atualizarAceites = async (solicitacaoId: string, aceiteSeparador?: boolean, aceiteSolicitante?: boolean): Promise<boolean> => {
    try {
      const updates: any = {};
      if (aceiteSeparador !== undefined) updates.aceite_separador = aceiteSeparador;
      if (aceiteSolicitante !== undefined) updates.aceite_solicitante = aceiteSolicitante;

      const { error } = await supabase
        .from('solicitacoes')
        .update(updates)
        .eq('id', solicitacaoId);

      if (error) throw error;

      await carregarSolicitacoes();
      return true;
    } catch (error) {
      console.error('Erro ao atualizar aceites:', error);
      toast.error('Erro ao atualizar aceites');
      return false;
    }
  };

  const validarItensDevolucao = (itensRetirada: SolicitacaoItem[], itensDevolucao: { item_id: string; quantidade_solicitada: number; item_snapshot: Partial<Item> }[]): { valido: boolean; divergencias: string[] } => {
    const divergencias: string[] = [];
    
    itensDevolucao.forEach(itemDevolucao => {
      const itemRetirado = itensRetirada.find(ir => ir.item_id === itemDevolucao.item_id);
      
      if (!itemRetirado) {
        divergencias.push(`Item "${itemDevolucao.item_snapshot.nome}" não foi retirado na solicitação original`);
      }
    });
    
    return {
      valido: divergencias.length === 0,
      divergencias
    };
  };

  return {
    solicitacoes,
    loading,
    criarSolicitacao,
    aprovarSolicitacao,
    rejeitarSolicitacao,
    atualizarAceites,
    carregarSolicitacoes,
    validarItensDevolucao
  };
};