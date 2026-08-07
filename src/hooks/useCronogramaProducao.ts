import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatarErroSupabase } from '@/utils/supabaseError';

export interface AlocacaoGanttProducao {
  data: string;
  quantidade_planejada: number;
  pessoas_planejadas: number;
}

export interface GanttOrdemProducao {
  id: string;
  numero: number;
  status: string;
  local_tipo: string;
  quantidade_planejada: number;
  quantidade_realizada: number;
  percentual_realizado: number;
  data_inicio_prevista: string;
  data_fim_prevista: string;
  data_inicio_real: string | null;
  data_fim_real: string | null;
  responsavel_nome: string | null;
}

export interface GanttEtapaProducao {
  etapa_id: string;
  codigo: string;
  etapa_nome: string;
  projeto_id: string;
  projeto_nome: string;
  cidade: string | null;
  uf: string | null;
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
  ordens: GanttOrdemProducao[];
}

export interface PlanoDiarioProducaoItem {
  etapa_id: string;
  codigo: string;
  etapa_nome: string;
  projeto_id: string;
  projeto_nome: string;
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
        (supabase.rpc as any)('listar_gantt_producao'),
        supabase.from('producao_cronograma_configuracoes').select('equipe_disponivel_por_dia,trabalha_sabado,trabalha_domingo,horizonte_dias').eq('id', 1).maybeSingle(),
        supabase.from('producao_cronograma_alertas').select('id,processo_id,data,severidade,codigo,mensagem').order('created_at', { ascending: false }).limit(100),
      ]);
      if (error) throw new Error(formatarErroSupabase(error, 'Não foi possível carregar o Gantt.'));
      if (configResult.error) throw new Error(formatarErroSupabase(configResult.error, 'Não foi possível carregar a configuração do cronograma.'));
      if (alertasResult.error) throw new Error(formatarErroSupabase(alertasResult.error, 'Não foi possível carregar os alertas do cronograma.'));

      const resultado = ((data ?? []) as GanttEtapaProducao[]).map((item) => {
        const ordensOriginais = Array.isArray(item.ordens) ? item.ordens : [];
        const ordens = ordensOriginais.map((ordem) => ({
          ...ordem,
          // No Gantt, a posição da OP é definida pela própria programação da OP.
          // Datas reais/status não substituem início planejado e prazo da OP.
          data_inicio_real: null,
          data_fim_real: null,
        }));
        const ordensValidas = ordens.filter((ordem) => ordem.status !== 'cancelada');
        const datasInicio = ordensValidas
          .map((ordem) => ordem.data_inicio_prevista)
          .filter((valor): valor is string => Boolean(valor))
          .sort();
        const datasFim = ordensValidas
          .map((ordem) => ordem.data_fim_prevista)
          .filter((valor): valor is string => Boolean(valor))
          .sort();
        const planejadoOps = ordensValidas.reduce(
          (total, ordem) => total + Number(ordem.quantidade_planejada ?? 0),
          0,
        );
        const realizadoOps = ordensValidas.reduce(
          (total, ordem) => total + Number(ordem.quantidade_realizada ?? 0),
          0,
        );
        const possuiOps = ordensValidas.length > 0;

        return {
          ...item,
          alocacoes: Array.isArray(item.alocacoes) ? item.alocacoes : [],
          ordens,
          // A Etapa é apenas a consolidação visual das OPs no cronograma.
          // Quando existem OPs, seu período é o menor início e o maior prazo delas.
          data_inicio_prevista: possuiOps
            ? (datasInicio[0] ?? item.data_inicio_prevista)
            : item.data_inicio_prevista,
          data_fim_prevista: possuiOps
            ? (datasFim[datasFim.length - 1] ?? item.data_fim_prevista)
            : item.data_fim_prevista,
          data_inicio_real: possuiOps ? null : item.data_inicio_real,
          data_fim_real: possuiOps ? null : item.data_fim_real,
          quantidade_realizada: possuiOps ? realizadoOps : Number(item.quantidade_realizada ?? 0),
          percentual_realizado: possuiOps && planejadoOps > 0
            ? Math.min(100, Math.round((realizadoOps / planejadoOps) * 10000) / 100)
            : Number(item.percentual_realizado ?? 0),
        };
      });
      setEtapas(resultado);
      if (configResult.data) setConfiguracao(configResult.data as ConfiguracaoCronogramaProducao);
      setAlertas((alertasResult.data ?? []) as AlertaCronogramaProducao[]);
      return resultado;
    } catch (error) {
      const mensagem = formatarErroSupabase(error, 'Não foi possível carregar o cronograma.');
      setErro(mensagem);
      setEtapas([]);
      throw new Error(mensagem);
    } finally {
      setLoading(false);
    }
  }, []);

  const listarPlanoDiario = useCallback(async (dataInicio: string, dias = 60) => {
    const { data, error } = await supabase.rpc('listar_plano_diario_producao', {
      p_data_inicio: dataInicio,
      p_dias: dias,
    });
    if (error) throw new Error(formatarErroSupabase(error, 'Não foi possível carregar o Plano Diário.'));
    const resultado = (data ?? []) as PlanoDiarioProducaoItem[];
    setPlanoDiario(resultado);
    return resultado;
  }, []);

  const recalcularCronograma = useCallback(async () => {
    setRecalculando(true);
    try {
      const { error } = await supabase.rpc('recalcular_cronograma_producao');
      if (error) throw new Error(formatarErroSupabase(error, 'Não foi possível recalcular o cronograma.'));
      await listarCronograma();
    } finally {
      setRecalculando(false);
    }
  }, [listarCronograma]);

  const salvarConfiguracao = useCallback(async (dados: ConfiguracaoCronogramaProducao) => {
    setRecalculando(true);
    try {
      const { error } = await supabase.rpc('salvar_configuracao_cronograma_producao', {
        p_equipe_disponivel: dados.equipe_disponivel_por_dia,
        p_trabalha_sabado: dados.trabalha_sabado,
        p_trabalha_domingo: dados.trabalha_domingo,
        p_horizonte_dias: dados.horizonte_dias,
      });
      if (error) throw new Error(formatarErroSupabase(error, 'Não foi possível salvar a configuração do cronograma.'));
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