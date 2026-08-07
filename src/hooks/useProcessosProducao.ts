import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { ProducaoProcesso, ProducaoProcessoStatus, ProducaoPrioridade } from '@/types/producao';
import { formatarErroSupabase } from '@/utils/supabaseError';

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

export interface RetificacaoEtapaProducaoInput {
  nome: string;
  descricao?: string | null;
  prioridade: ProducaoPrioridade;
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
  justificativa: string;
}

export interface ResumoExclusaoProcessoProducao {
  processo_id: string;
  codigo: string;
  nome: string;
  status: string;
  total_apontamentos: number;
  total_apontamentos_conferidos: number;
  total_eventos: number;
  total_dependencias: number;
  total_alocacoes: number;
  total_alertas: number;
  pode_excluir: boolean;
  motivo_bloqueio: string | null;
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
      if (error) throw new Error(formatarErroSupabase(error, 'Não foi possível carregar as etapas.'));
      const resultado = (data ?? []) as ProducaoProcesso[];
      setProcessos(resultado);
      return resultado;
    } finally {
      setLoading(false);
    }
  }, []);

  const listarDependencias = useCallback(async (processoId: string) => {
    const { data, error } = await (supabase.from as any)('producao_processo_dependencias')
      .select('depende_de_processo_id,tipo')
      .eq('processo_id', processoId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(formatarErroSupabase(error, 'Não foi possível carregar as dependências da etapa.'));
    return (data ?? []).map((item: { depende_de_processo_id: string; tipo: 'fim_inicio' | 'inicio_inicio' }) => ({
      etapa_id: item.depende_de_processo_id,
      tipo: item.tipo,
    })) as DependenciaEtapaInput[];
  }, []);

  const obterProximoCodigo = useCallback(async () => {
    const { data, error } = await supabase.rpc('obter_proximo_codigo_etapa_producao');
    if (error) throw new Error(formatarErroSupabase(error, 'Não foi possível obter o próximo código da etapa.'));
    return String(data ?? '');
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
      p_dependencias: (dados.dependencias ?? []) as unknown as Json,
    });
    if (error) throw new Error(formatarErroSupabase(error, 'Não foi possível salvar a etapa.'));

    const { data, error: readError } = await supabase
      .from('producao_processos')
      .select(PROCESSO_SELECT)
      .eq('id', id)
      .single();
    if (readError) throw new Error(formatarErroSupabase(readError, 'A etapa foi criada, mas não pôde ser recarregada.'));
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
      p_dependencias: (dados.dependencias ?? []) as unknown as Json,
    });
    if (error) throw new Error(formatarErroSupabase(error, 'Não foi possível atualizar o planejamento da etapa.'));
    await listarProcessos();
  }, [listarProcessos]);

  const retificarProcesso = useCallback(async (
    id: string,
    dados: RetificacaoEtapaProducaoInput,
  ) => {
    const { error } = await (supabase.rpc as any)('retificar_etapa_producao', {
      p_processo_id: id,
      p_nome: dados.nome,
      p_descricao: dados.descricao ?? null,
      p_prioridade: dados.prioridade,
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
      p_dependencias: (dados.dependencias ?? []) as unknown as Json,
      p_justificativa: dados.justificativa,
    });
    if (error) throw new Error(formatarErroSupabase(error, 'Não foi possível retificar a etapa.'));
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
    if (error) throw new Error(formatarErroSupabase(error, `Não foi possível ${acao} a etapa.`));
    await listarProcessos();
  }, [listarProcessos]);

  const obterResumoFinalizacao = useCallback(async (id: string) => {
    const { data, error } = await supabase.rpc('obter_resumo_finalizacao_processo', {
      p_processo_id: id,
    });
    if (error) throw new Error(formatarErroSupabase(error, 'Não foi possível preparar a finalização da etapa.'));
    return data?.[0] ?? null;
  }, []);

  const obterResumoExclusao = useCallback(async (id: string) => {
    const { data, error } = await (supabase.rpc as any)('obter_resumo_exclusao_processo_producao', {
      p_processo_id: id,
    });
    if (error) throw new Error(formatarErroSupabase(error, 'Não foi possível verificar os vínculos da etapa.'));
    const resumo = (data?.[0] ?? null) as ResumoExclusaoProcessoProducao | null;
    if (!resumo) throw new Error('Etapa não encontrada ou usuário sem permissão administrativa.');
    return resumo;
  }, []);

  const excluirProcesso = useCallback(async (
    id: string,
    codigoConfirmacao: string,
    justificativa: string,
  ) => {
    const { error } = await (supabase.rpc as any)('excluir_processo_producao', {
      p_processo_id: id,
      p_codigo_confirmacao: codigoConfirmacao,
      p_justificativa: justificativa,
    });
    if (error) throw new Error(formatarErroSupabase(error, 'Não foi possível excluir a etapa.'));
    setProcessos((atuais) => atuais.filter((processo) => processo.id !== id));
  }, []);

  return {
    processos,
    loading,
    listarProcessos,
    listarDependencias,
    obterProximoCodigo,
    criarProcesso,
    salvarPlanejamento,
    retificarProcesso,
    transicaoProcesso,
    obterResumoFinalizacao,
    obterResumoExclusao,
    excluirProcesso,
  };
};
