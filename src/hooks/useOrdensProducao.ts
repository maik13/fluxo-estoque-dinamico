import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type {
  NovaOrdemProducao,
  ProducaoOrdemProducao,
  ProducaoOrdemStatus,
} from '@/types/producao';
import { formatarErroSupabase } from '@/utils/supabaseError';

const erro = (value: unknown, fallback: string) =>
  new Error(formatarErroSupabase(value, fallback));

export const formatarNumeroOrdemProducao = (numero: number | null | undefined) =>
  numero ? `OP ${String(numero).padStart(6, '0')}` : 'OP sem número';

const normalizarOrdem = (item: any): ProducaoOrdemProducao => ({
  ...item,
  numero: Number(item.numero),
  quantidade_planejada: Number(item.quantidade_planejada ?? 0),
  quantidade_realizada: Number(item.quantidade_realizada ?? 0),
  percentual_realizado: Number(item.percentual_realizado ?? 0),
  pintura_comprimento_ripa_m_snapshot: item.pintura_comprimento_ripa_m_snapshot == null ? null : Number(item.pintura_comprimento_ripa_m_snapshot),
  pintura_largura_ripa_cm_snapshot: item.pintura_largura_ripa_cm_snapshot == null ? null : Number(item.pintura_largura_ripa_cm_snapshot),
  pintura_ripas_por_painel_snapshot: item.pintura_ripas_por_painel_snapshot == null ? null : Number(item.pintura_ripas_por_painel_snapshot),
  pintura_consumo_ml_por_ripa_snapshot: item.pintura_consumo_ml_por_ripa_snapshot == null ? null : Number(item.pintura_consumo_ml_por_ripa_snapshot),
  pintura_quantidade_ripas_calculada: item.pintura_quantidade_ripas_calculada == null ? null : Number(item.pintura_quantidade_ripas_calculada),
  pintura_consumo_ml_por_unidade: item.pintura_consumo_ml_por_unidade == null ? null : Number(item.pintura_consumo_ml_por_unidade),
  pintura_consumo_total_ml: item.pintura_consumo_total_ml == null ? null : Number(item.pintura_consumo_total_ml),
});

export const useOrdensProducao = () => {
  const [ordens, setOrdens] = useState<ProducaoOrdemProducao[]>([]);
  const [loading, setLoading] = useState(false);

  const listarOrdens = useCallback(async (
    processoId?: string | null,
    status?: ProducaoOrdemStatus | null,
  ) => {
    setLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)('listar_ordens_producao', {
        p_processo_id: processoId ?? null,
        p_status: status ?? null,
      });
      if (error) throw erro(error, 'Não foi possível carregar as Ordens de Produção.');
      const resultado = (data ?? []).map(normalizarOrdem) as ProducaoOrdemProducao[];
      setOrdens(resultado);
      return resultado;
    } finally {
      setLoading(false);
    }
  }, []);

  const criarOrdem = useCallback(async (dados: NovaOrdemProducao) => {
    const { data: id, error } = await (supabase.rpc as any)('criar_ordem_producao', {
      p_processo_id: dados.processo_id,
      p_quantidade_planejada: dados.quantidade_planejada,
      p_data_inicio_prevista: dados.data_inicio_prevista,
      p_data_fim_prevista: dados.data_fim_prevista,
      p_local_tipo: dados.local_tipo,
      p_responsavel_id: dados.responsavel_id ?? null,
      p_responsavel_nome: dados.responsavel_nome ?? null,
      p_equipe_prevista: dados.equipe_prevista ?? null,
      p_instrucoes: dados.instrucoes ?? null,
      p_descricao: dados.descricao ?? null,
      p_prioridade: dados.prioridade ?? 'normal',
      p_pintura_tipo: dados.pintura_tipo ?? null,
      p_pintura_preset_id: dados.pintura_preset_id ?? null,
    });
    if (error) throw erro(error, 'Não foi possível emitir a Ordem de Produção.');
    const atualizadas = await listarOrdens();
    const ordem = atualizadas.find((item) => item.id === id);
    if (!ordem) throw new Error('A OP foi emitida, mas não pôde ser recarregada.');
    return ordem;
  }, [listarOrdens]);

  const transicaoOrdem = useCallback(async (
    id: string,
    acao: 'iniciar' | 'concluir' | 'cancelar' | 'reabrir',
    justificativa?: string | null,
  ) => {
    const { error } = await (supabase.rpc as any)('transicao_ordem_producao', {
      p_ordem_producao_id: id,
      p_acao: acao,
      p_justificativa: justificativa ?? null,
    });
    if (error) throw erro(error, `Não foi possível ${acao} a Ordem de Produção.`);
    await listarOrdens();
  }, [listarOrdens]);

  return {
    ordens,
    loading,
    listarOrdens,
    criarOrdem,
    transicaoOrdem,
  };
};
