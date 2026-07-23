import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ProducaoLocalOperacionalTipo } from '@/types/producao';

const db = supabase as any;

export interface AlocacaoGanttProducao {
  data: string;
  quantidade_planejada: number;
  pessoas_planejadas: number;
}

export interface GanttEtapaProducao {
  etapa_id: string;
  codigo: string;
  etapa_nome: string;
  projeto_id: string;
  projeto_nome: string;
  cidade: string | null;
  uf: string | null;
  local_operacional_id: string | null;
  local_operacional_nome: string | null;
  local_operacional_tipo: ProducaoLocalOperacionalTipo | null;
  local_operacional_cidade: string | null;
  local_operacional_uf: string | null;
  grupo_cronograma: string | null;
  sequencia: number;
  unidade_medida: string | null;
  quantidade_planejada: number | null;
  quantidade_realizada: number;
  percentual_realizado: number;
  status: string;
  prioridade: string;
  data_inicio_desejada: string | null;
  data_limite: string | null;
  data_inicio_prevista: string | null;
  data_fim_prevista: string | null;
  data_inicio_real: string | null;
  data_fim_real: string | null;
  capacidade_diaria: number | null;
  pessoas_necessarias: number | null;
  alocacoes: AlocacaoGanttProducao[];
}

export interface PlanoDiarioProducaoItem {
  etapa_id: string;
  codigo: string;
  etapa_nome: string;
  projeto_id: string;
  projeto_nome: string;
  local_operacional_id: string | null;
  local_operacional_nome: string | null;
  local_operacional_tipo: ProducaoLocalOperacionalTipo | null;
  grupo_cronograma: string | null;
  unidade_medida: string | null;
  data: string;
  quantidade_planejada: number;
  pessoas_planejadas: number;
  quantidade_realizada: number;
  status: string;
}

export interface ConfiguracaoCronogramaProducao {
  equipe_disponivel_por_dia: number;
  trabalha_sabado: boolean;
  trabalha_domingo: boolean;
  horizonte_dias: number;
}

export interface AlertaCronogramaProducao {
  id: string;
  processo_id: string | null;
  data: string | null;
  severidade: 'baixa' | 'media' | 'alta';
  codigo: string;
  mensagem: string;
}

export const useCronogramaProducao = () => {
  const [etapas, setEtapas] = useState<GanttEtapaProducao[]>([]);
  const [planoDiario, setPlanoDiario] = useState<PlanoDiarioProducaoItem[]>([]);
  const [configuracao, setConfiguracao] = useState<ConfiguracaoCronogramaProducao | null>(null);
  const [alertas, setAlertas] = useState<AlertaCronogramaProducao[]>([]);
  const [loading, setLoading] = useState(false);
  const [recalculando, setRecalculando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const listarCronograma = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [{ data, error }, configResult, alertasResult] = await Promise.all([
        db.rpc('listar_gantt_producao'),
        db.from('producao_cronograma_configuracoes').select('equipe_disponivel_por_dia,trabalha_sabado,trabalha_domingo,horizonte_dias').eq('id', 1).maybeSingle(),
        db.from('producao_cronograma_alertas').select('id,processo_id,data,severidade,codigo,mensagem').order('created_at', { ascending: false }).limit(100),
      ]);
      if (error) throw error;
      const resultado = ((data ?? []) as GanttEtapaProducao[]).map((item) => ({
        ...item,
        alocacoes: Array.isArray(item.alocacoes) ? item.alocacoes : [],
      }));
      setEtapas(resultado);
      if (!configResult.error && configResult.data) setConfiguracao(configResult.data as ConfiguracaoCronogramaProducao);
      if (!alertasResult.error) setAlertas((alertasResult.data ?? []) as AlertaCronogramaProducao[]);
      return resultado;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Não foi possível carregar o cronograma.';
      setErro(mensagem);
      setEtapas([]);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const listarPlanoDiario = useCallback(async (dataInicio: string, dias = 60) => {
    const { data, error } = await db.rpc('listar_plano_diario_producao', {
      p_data_inicio: dataInicio,
      p_dias: dias,
    });
    if (error) throw error;
    const resultado = (data ?? []) as PlanoDiarioProducaoItem[];
    setPlanoDiario(resultado);
    return resultado;
  }, []);

  const recalcularCronograma = useCallback(async () => {
    setRecalculando(true);
    try {
      const { error } = await db.rpc('recalcular_cronograma_producao');
      if (error) throw error;
      await listarCronograma();
    } finally {
      setRecalculando(false);
    }
  }, [listarCronograma]);

  const salvarConfiguracao = useCallback(async (dados: ConfiguracaoCronogramaProducao) => {
    setRecalculando(true);
    try {
      const { error } = await db.rpc('salvar_configuracao_cronograma_producao', {
        p_equipe_disponivel: dados.equipe_disponivel_por_dia,
        p_trabalha_sabado: dados.trabalha_sabado,
        p_trabalha_domingo: dados.trabalha_domingo,
        p_horizonte_dias: dados.horizonte_dias,
      });
      if (error) throw error;
      setConfiguracao(dados);
      await listarCronograma();
    } finally {
      setRecalculando(false);
    }
  }, [listarCronograma]);

  return {
    etapas,
    planoDiario,
    configuracao,
    alertas,
    loading,
    recalculando,
    erro,
    listarCronograma,
    listarPlanoDiario,
    recalcularCronograma,
    salvarConfiguracao,
  };
};
