import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  data_inicio_prevista: string | null;
  data_fim_prevista: string | null;
  data_inicio_real: string | null;
  data_fim_real: string | null;
  capacidade_diaria: number | null;
  pessoas_necessarias: number | null;
}

export const useCronogramaProducao = () => {
  const [etapas, setEtapas] = useState<GanttEtapaProducao[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const listarCronograma = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const { data, error } = await supabase.rpc('listar_gantt_producao');
      if (error) throw error;
      const resultado = (data ?? []) as GanttEtapaProducao[];
      setEtapas(resultado);
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

  return { etapas, loading, erro, listarCronograma };
};
