import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ProducaoProcesso, ProducaoProcessoStatus, ProducaoPrioridade } from '@/types/producao';

export interface ProcessoProducaoInput {
  projeto_id: string;
  nome: string;
  descricao?: string | null;
  prioridade: ProducaoPrioridade;
  codigo?: string | null;
  produto_entregavel?: string | null;
  unidade_medida?: string | null;
  quantidade_planejada?: number | null;
}

export const useProcessosProducao = () => {
  const [processos, setProcessos] = useState<ProducaoProcesso[]>([]);
  const [loading, setLoading] = useState(false);

  const listarProcessos = useCallback(async (status?: ProducaoProcessoStatus) => {
    setLoading(true);
    try {
      let consulta = supabase
        .from('producao_processos')
        .select('*, projeto:producao_projetos(nome,cidade,uf)')
        .order('created_at', { ascending: false });
      if (status) consulta = consulta.eq('status', status);
      const { data, error } = await consulta;
      if (error) throw error;
      const resultado = (data ?? []) as ProducaoProcesso[];
      setProcessos(resultado);
      return resultado;
    } finally {
      setLoading(false);
    }
  }, []);

  const criarProcesso = useCallback(async (dados: ProcessoProducaoInput) => {
    const { data: id, error } = await supabase.rpc('criar_processo_producao', {
      p_projeto_id: dados.projeto_id,
      p_nome: dados.nome,
      p_descricao: dados.descricao ?? null,
      p_prioridade: dados.prioridade,
      p_codigo: dados.codigo ?? null,
      p_produto_entregavel: dados.produto_entregavel ?? null,
      p_unidade_medida: dados.unidade_medida ?? null,
      p_quantidade_planejada: dados.quantidade_planejada ?? null,
    });
    if (error) throw error;
    const { data, error: readError } = await supabase
      .from('producao_processos')
      .select('*, projeto:producao_projetos(nome,cidade,uf)')
      .eq('id', id)
      .single();
    if (readError) throw readError;
    const processo = data as ProducaoProcesso;
    setProcessos((atuais) => [processo, ...atuais]);
    return processo;
  }, []);

  const transicaoProcesso = useCallback(async (
    id: string,
    acao: 'iniciar' | 'pausar' | 'retomar' | 'bloquear' | 'desbloquear' | 'finalizar' | 'cancelar' | 'reabrir',
    justificativa?: string,
  ) => {
    const { error } = await supabase.rpc('transicao_processo_producao', {
      p_processo_id: id,
      p_acao: acao,
      p_justificativa: justificativa ?? null,
    });
    if (error) throw error;
    await listarProcessos();
  }, [listarProcessos]);

  const obterResumoFinalizacao = useCallback(async (id: string) => {
    const { data, error } = await supabase.rpc('obter_resumo_finalizacao_processo', {
      p_processo_id: id,
    });
    if (error) throw error;
    return data?.[0] ?? null;
  }, []);

  return { processos, loading, listarProcessos, criarProcesso, transicaoProcesso, obterResumoFinalizacao };
};
