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
      // Usar o solicitante selecionado na interface
      let solicitanteId = novaSolicitacao.solicitante_id || user.id;
      let solicitanteNome = novaSolicitacao.solicitante_nome || userProfile.nome;

      // Criar solicitação
      const { data: solicitacaoData, error: solicitacaoError } = await supabase
        .from('solicitacoes')
        .insert([{
          solicitante_id: solicitanteId,
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
        quantidade_aprovada: item.quantidade_solicitada, // Define quantidade aprovada igual à solicitada
        item_snapshot: item.item_snapshot
      }));

      const { error: itensError } = await supabase
        .from('solicitacao_itens')
        .insert(itensParaInserir);

      if (itensError) throw itensError;

      // Criar movimentações automaticamente
      const isRetirada = !novaSolicitacao.tipo_operacao || 
                         novaSolicitacao.tipo_operacao === 'saida_producao' || 
                         novaSolicitacao.tipo_operacao === 'saida_obra';
      
      const isDevolucao = novaSolicitacao.tipo_operacao === 'devolucao' || 
                         novaSolicitacao.tipo_operacao === 'devolucao_estoque';

      for (const item of novaSolicitacao.itens) {
        // Obter item do estoque
        const { data: itemEstoque, error: itemEstoqueError } = await supabase
          .from('items')
          .select('*')
          .eq('id', item.item_id)
          .single();

        if (itemEstoqueError) throw itemEstoqueError;

        const quantidadeAnterior = itemEstoque.quantidade;
        let novaQuantidade = quantidadeAnterior;
        let tipoMovimentacao: 'ENTRADA' | 'SAIDA' = 'SAIDA';

        if (isRetirada) {
          novaQuantidade = quantidadeAnterior - item.quantidade_solicitada;
          tipoMovimentacao = 'SAIDA';
        } else if (isDevolucao) {
          novaQuantidade = quantidadeAnterior + item.quantidade_solicitada;
          tipoMovimentacao = 'ENTRADA';
        }

        // Atualizar quantidade no estoque
        const { error: updateEstoqueError } = await supabase
          .from('items')
          .update({ quantidade: novaQuantidade })
          .eq('id', item.item_id);

        if (updateEstoqueError) throw updateEstoqueError;

        // Criar movimentação
        const movimentacaoData = {
          item_id: item.item_id,
          tipo: tipoMovimentacao,
          quantidade: item.quantidade_solicitada,
          quantidade_anterior: quantidadeAnterior,
          quantidade_atual: novaQuantidade,
          responsavel: userProfile.nome,
          observacoes: `${isDevolucao ? 'Devolução' : 'Retirada'} - Solicitação #${solicitacaoData.numero || solicitacaoData.id.slice(-8)}${novaSolicitacao.observacoes ? ' - ' + novaSolicitacao.observacoes : ''}`,
          local_utilizacao: novaSolicitacao.local_utilizacao,
          item_snapshot: item.item_snapshot,
          solicitacao_id: solicitacaoData.id
        };

        console.log('Criando movimentação com dados:', movimentacaoData);

        const { error: movimentacaoError } = await supabase
          .from('movements')
          .insert(movimentacaoData);

        if (movimentacaoError) {
          console.error('Erro ao criar movimentação:', movimentacaoError);
          throw movimentacaoError;
        }
      }

      toast.success('Solicitação criada e estoque atualizado!');
      await carregarSolicitacoes();
      return true;
    } catch (error) {
      console.error('Erro ao criar solicitação:', error);
      toast.error('Erro ao criar solicitação');
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
    atualizarAceites,
    carregarSolicitacoes,
    validarItensDevolucao
  };
};