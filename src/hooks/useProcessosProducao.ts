import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ProducaoProcesso, ProducaoProcessoStatus, ProducaoPrioridade } from '@/types/producao';

export interface DependenciaEtapaInput {
  etapa_id: string;
  tipo: 'fim_inicio' | 'inicio_inicio';
}

export interface ProcessoProducaoInput {
  projeto_local_id: string;
  nome: string;
  descricao?: string | null;
  prioridade: ProducaoPrioridade;
  codigo?: string | null;
  produto_entregavel?: string | null;
  unidade_medida?: string | null;
  quantidade_planejada?: number | null;
  data_inicio_prevista?: string | null;
  data_fim_prevista?: string | null;
  grupo_cronograma?: string | null;
  sequencia?: number;
  capacidade_diaria?: number | null;
  pessoas_necessarias?: number | null;
  aceita_producao_proporcional?: boolean;
  dependencias?: DependenciaEtapaInput[];
}

const PROCESSO_SELECT = '*, projeto:producao_projetos(nome,cidade,uf,local_utilizacao_id)';

export const useProcessosProducao = () => {
  const [processos, setProcessos] = useState<ProducaoProcesso[]>([]);
  const [loading, setLoading] = useState(false);

  const listarProcessos = useCallback(async (status?: ProducaoProcessoStatus) => {
    setLoading(true);
    try {
      let consulta = supabase
        .from('producao_processos')
        .select(PROCESSO_SELECT)
        .order('sequencia', { ascending: true })
        .order('created_at', { ascending: true });
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
    const { data: id, error } = await supabase.rpc('criar_etapa_producao', {
      p_projeto_local_id: dados.projeto_local_id,
      p_nome: dados.nome,
      p_descricao: dados.descricao ?? null,
      p_prioridade: dados.prioridade,
      p_codigo: dados.codigo ?? null,
      p_produto_entregavel: dados.produto_entregavel ?? null,
      p_unidade_medida: dados.unidade_medida ?? null,
      p_quantidade_planejada: dados.quantidade_planejada ?? null,
      p_data_inicio_desejada: dados.data_inicio_prevista ?? null,
      p_data_limite: dados.data_fim_prevista ?? null,
      p_grupo_cronograma: dados.grupo_cronograma ?? null,
      p_sequencia: dados.sequencia ?? 0,
      p_capacidade_diaria: dados.capacidade_diaria ?? null,
      p_pessoas_necessarias: dados.pessoas_necessarias ?? null,
      p_aceita_producao_proporcional: dados.aceita_producao_proporcional ?? false,
      p_dependencias: dados.dependencias ?? [],
    });
    if (error) throw error;

    const { data, error: readError } = await supabase
      .from('producao_processos')
      .select(PROCESSO_SELECT)
      .eq('id', id)
      .single();
    if (readError) throw readError;
    const processo = data as ProducaoProcesso;
    setProcessos((atuais) => [...atuais, processo]);
    return processo;
  }, []);

  const salvarPlanejamento = useCallback(async (id: string, dados: Omit<ProcessoProducaoInput, 'projeto_local_id' | 'nome' | 'prioridade'>) => {
    const { error } = await supabase.rpc('salvar_planejamento_etapa_producao', {
      p_processo_id: id,
      p_data_inicio_desejada: dados.data_inicio_prevista ?? null,
      p_data_limite: dados.data_fim_prevista ?? null,
      p_grupo_cronograma: dados.grupo_cronograma ?? null,
      p_sequencia: dados.sequencia ?? 0,
      p_capacidade_diaria: dados.capacidade_diaria ?? null,
      p_pessoas_necessarias: dados.pessoas_necessarias ?? null,
      p_aceita_producao_proporcional: dados.aceita_producao_proporcional ?? false,
      p_dependencias: dados.dependencias ?? [],
    });
    if (error) throw error;
    await listarProcessos();
  }, [listarProcessos]);

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

  return {
    processos,
    loading,
    listarProcessos,
    criarProcesso,
    salvarPlanejamento,
    transicaoProcesso,
    obterResumoFinalizacao,
  };
};
