import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { ProducaoMaterialProjeto } from '@/types/producao';

export type MovimentoOficialProducao =
  Database['public']['Tables']['movements']['Row'];

interface VinculoMaterialProducao {
  movement_id: string;
  projeto_local_id: string;
  apontamento_id?: string | null;
  observacoes_producao?: string | null;
}

export const useProducaoMateriais = () => {
  const [movimentacoes, setMovimentacoes] = useState<
    MovimentoOficialProducao[]
  >([]);
  const [materiaisVinculados, setMateriaisVinculados] = useState<
    ProducaoMaterialProjeto[]
  >([]);
  const [loading, setLoading] = useState(false);

  const listarMovimentacoesPorProjeto = useCallback(
    async (projetoLocalId: string) => {
      if (!projetoLocalId?.trim()) {
        throw new Error('O projeto/local é obrigatório.');
      }

      setLoading(true);

      try {
        // Leitura somente: este hook nunca escreve em public.movements.
        const { data, error } = await supabase
          .from('movements')
          .select('*')
          .eq('local_utilizacao_id', projetoLocalId)
          .order('data_hora', { ascending: false });

        if (error) throw error;

        const resultado = data ?? [];
        setMovimentacoes(resultado);
        return resultado;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const listarMateriaisVinculados = useCallback(
    async (projetoLocalId?: string) => {
      setLoading(true);

      try {
        let consulta = supabase
          .from('producao_materiais_projeto')
          .select('*')
          .order('created_at', { ascending: false });

        if (projetoLocalId) {
          consulta = consulta.eq('projeto_local_id', projetoLocalId);
        }

        const { data, error } = await consulta;
        if (error) throw error;

        const resultado = (data ?? []) as ProducaoMaterialProjeto[];
        setMateriaisVinculados(resultado);
        return resultado;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const criarVinculoMaterial = useCallback(
    async ({
      movement_id,
      projeto_local_id,
      apontamento_id = null,
      observacoes_producao = null,
    }: VinculoMaterialProducao) => {
      if (!movement_id?.trim()) {
        throw new Error('A movimentação é obrigatória.');
      }
      if (!projeto_local_id?.trim()) {
        throw new Error('O projeto/local é obrigatório.');
      }

      // A origem dos dados é sempre uma movimentação oficial já existente.
      const { data: movimentacao, error: movimentacaoError } = await supabase
        .from('movements')
        .select(
          'id, local_utilizacao_id, item_id, tipo, quantidade, item_snapshot',
        )
        .eq('id', movement_id)
        .maybeSingle();

      if (movimentacaoError) throw movimentacaoError;
      if (!movimentacao) {
        throw new Error('A movimentação informada não existe.');
      }
      if (!movimentacao.local_utilizacao_id) {
        throw new Error('A movimentação não possui projeto/local vinculado.');
      }
      if (movimentacao.local_utilizacao_id !== projeto_local_id) {
        throw new Error(
          'O projeto/local deve ser o mesmo da movimentação oficial.',
        );
      }
      if (movimentacao.quantidade <= 0) {
        throw new Error('A movimentação precisa ter quantidade maior que zero.');
      }

      const { data: existente, error: existenteError } = await supabase
        .from('producao_materiais_projeto')
        .select('*')
        .eq('movement_id', movement_id)
        .maybeSingle();

      if (existenteError) throw existenteError;
      if (existente) {
        throw new Error('Esta movimentação já está vinculada à Produção.');
      }

      // Única escrita deste fluxo: criação da referência na tabela satélite.
      const { data, error } = await supabase
        .from('producao_materiais_projeto')
        .insert({
          movement_id: movimentacao.id,
          projeto_local_id: movimentacao.local_utilizacao_id,
          apontamento_id,
          tipo: movimentacao.tipo,
          item_id: movimentacao.item_id,
          quantidade: movimentacao.quantidade,
          item_snapshot: movimentacao.item_snapshot,
          observacoes_producao: observacoes_producao?.trim() || null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Esta movimentação já está vinculada à Produção.');
        }
        throw error;
      }

      const vinculo = data as ProducaoMaterialProjeto;
      setMateriaisVinculados((atuais) => [vinculo, ...atuais]);
      return vinculo;
    },
    [],
  );

  return {
    movimentacoes,
    materiaisVinculados,
    loading,
    listarMovimentacoesPorProjeto,
    listarMateriaisVinculados,
    criarVinculoMaterial,
  };
};
