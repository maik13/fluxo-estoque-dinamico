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
      // Criar solicitação
      const { data: solicitacaoData, error: solicitacaoError } = await supabase
        .from('solicitacoes')
        .insert([{
          solicitante_id: user.id,
          solicitante_nome: userProfile.nome,
          observacoes: novaSolicitacao.observacoes,
          local_utilizacao: novaSolicitacao.local_utilizacao,
          responsavel_estoque: novaSolicitacao.responsavel_estoque,
          tipo_operacao: novaSolicitacao.tipo_operacao || 'saida_producao'
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

      // Atualizar quantidades aprovadas dos itens
      for (const item of itensAprovados) {
        const { error: itemError } = await supabase
          .from('solicitacao_itens')
          .update({ quantidade_aprovada: item.quantidade })
          .eq('id', item.id);

        if (itemError) throw itemError;
      }

      toast.success('Solicitação aprovada com sucesso!');
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

  return {
    solicitacoes,
    loading,
    criarSolicitacao,
    aprovarSolicitacao,
    rejeitarSolicitacao,
    atualizarAceites,
    carregarSolicitacoes
  };
};