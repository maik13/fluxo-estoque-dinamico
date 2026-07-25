import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { ProducaoMaterialProjeto } from '@/types/producao';
import { formatarErroSupabase } from '@/utils/supabaseError';

export type MovimentoOficialProducao =
  Database['public']['Tables']['movements']['Row'];

interface VinculoMaterialProducao {
  movement_id: string;
  projeto_local_id: string;
  apontamento_id?: string | null;
  observacoes_producao?: string | null;
}

export const useProducaoMateriais = () => {
  const [movimentacoes, setMovimentacoes] = useState<MovimentoOficialProducao[]>([]);
  const [materiaisVinculados, setMateriaisVinculados] = useState<ProducaoMaterialProjeto[]>([]);
  const [loading, setLoading] = useState(false);

  const listarMovimentacoesPorProjeto = useCallback(async (projetoLocalId: string) => {
    if (!projetoLocalId?.trim()) throw new Error('O projeto/local é obrigatório.');

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('movements')
        .select('*')
        .eq('local_utilizacao_id', projetoLocalId)
        .order('data_hora', { ascending: false });

      if (error) throw new Error(formatarErroSupabase(error, 'Não foi possível consultar as movimentações.'));
      const resultado = data ?? [];
      setMovimentacoes(resultado);
      return resultado;
    } finally {
      setLoading(false);
    }
  }, []);

  const listarMateriaisVinculados = useCallback(async (projetoLocalId?: string) => {
    setLoading(true);
    try {
      let consulta = supabase
        .from('producao_materiais_projeto')
        .select('*')
        .order('created_at', { ascending: false });

      if (projetoLocalId) consulta = consulta.eq('projeto_local_id', projetoLocalId);

      const { data, error } = await consulta;
      if (error) throw new Error(formatarErroSupabase(error, 'Não foi possível carregar os materiais vinculados.'));

      const resultado = (data ?? []) as ProducaoMaterialProjeto[];
      setMateriaisVinculados(resultado);
      return resultado;
    } finally {
      setLoading(false);
    }
  }, []);

  const criarVinculoMaterial = useCallback(async ({
    movement_id,
    projeto_local_id,
    apontamento_id = null,
    observacoes_producao = null,
  }: VinculoMaterialProducao) => {
    if (!movement_id?.trim()) throw new Error('A movimentação é obrigatória.');
    if (!projeto_local_id?.trim()) throw new Error('O projeto/local é obrigatório.');

    const { data: vinculoId, error: rpcError } = await (supabase.rpc as any)(
      'vincular_material_producao',
      {
        p_movement_id: movement_id,
        p_projeto_local_id: projeto_local_id,
        p_apontamento_id: apontamento_id,
        p_observacoes: observacoes_producao?.trim() || null,
      },
    );

    if (rpcError) {
      throw new Error(formatarErroSupabase(rpcError, 'Não foi possível vincular o material à Produção.'));
    }

    const { data, error } = await supabase
      .from('producao_materiais_projeto')
      .select('*')
      .eq('id', vinculoId)
      .single();

    if (error) throw new Error(formatarErroSupabase(error, 'O vínculo foi criado, mas não pôde ser recarregado.'));

    const vinculo = data as ProducaoMaterialProjeto;
    setMateriaisVinculados((atuais) => {
      const semDuplicado = atuais.filter((item) => item.id !== vinculo.id);
      return [vinculo, ...semDuplicado];
    });
    return vinculo;
  }, []);

  return {
    movimentacoes,
    materiaisVinculados,
    loading,
    listarMovimentacoesPorProjeto,
    listarMateriaisVinculados,
    criarVinculoMaterial,
  };
};
