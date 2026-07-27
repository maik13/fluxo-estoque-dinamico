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
      const resultado = (data ?? []) as ProducaoOrdemProducao[];
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
