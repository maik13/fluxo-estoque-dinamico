import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type {
  NovaOrdemProducao,
  ProducaoLocalTipo,
  ProducaoOrdemProducao,
  ProducaoOrdemStatus,
  ProducaoPrioridade,
} from '@/types/producao';
import { formatarErroSupabase } from '@/utils/supabaseError';

const EVENTO_ORDENS_ALTERADAS = 'producao:ordens-alteradas';

const erro = (value: unknown, fallback: string) =>
  new Error(formatarErroSupabase(value, fallback));

const erroRpcEmissao = (value: unknown) => {
  const mensagem = formatarErroSupabase(
    value,
    'Não foi possível emitir a Ordem de Produção.',
  );

  if (
    /criar_ordem_producao_sem_limite_v2|schema cache|could not find the function/i.test(
      mensagem,
    )
  ) {
    return new Error(
      'A atualização do banco para emissão de múltiplas OPs ainda não foi aplicada neste ambiente. Execute a migration 20260806112000_criar_ordem_producao_sem_limite_v2.sql no Supabase conectado ao sistema.',
    );
  }

  return new Error(mensagem);
};

const erroRpcEdicao = (value: unknown) => {
  const mensagem = formatarErroSupabase(
    value,
    'Não foi possível editar a Ordem de Produção.',
  );

  if (
    /editar_ordem_producao_v1|schema cache|could not find the function/i.test(
      mensagem,
    )
  ) {
    return new Error(
      'A atualização do banco para edição de OP ainda não foi aplicada neste ambiente. Execute a migration 20260806115500_editar_ordem_producao_v1.sql no Supabase conectado ao sistema.',
    );
  }

  return new Error(mensagem);
};

export interface DadosEdicaoOrdemProducao {
  ordem_producao_id: string;
  quantidade_planejada: number;
  data_inicio_prevista: string;
  data_fim_prevista: string;
  local_tipo: ProducaoLocalTipo;
  responsavel_id?: string | null;
  responsavel_nome?: string | null;
  equipe_prevista?: number | null;
  instrucoes?: string | null;
  descricao?: string | null;
  prioridade: ProducaoPrioridade;
  justificativa: string;
}

export const editarOrdemProducao = async (
  dados: DadosEdicaoOrdemProducao,
) => {
  const { error } = await (supabase.rpc as any)('editar_ordem_producao_v1', {
    p_ordem_producao_id: dados.ordem_producao_id,
    p_quantidade_planejada: dados.quantidade_planejada,
    p_data_inicio_prevista: dados.data_inicio_prevista,
    p_data_fim_prevista: dados.data_fim_prevista,
    p_local_tipo: dados.local_tipo,
    p_responsavel_id: dados.responsavel_id ?? null,
    p_responsavel_nome: dados.responsavel_nome ?? null,
    p_equipe_prevista: dados.equipe_prevista ?? null,
    p_instrucoes: dados.instrucoes ?? null,
    p_descricao: dados.descricao ?? null,
    p_prioridade: dados.prioridade,
    p_justificativa: dados.justificativa,
  });

  if (error) throw erroRpcEdicao(error);
};

export const notificarOrdensProducaoAlteradas = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(EVENTO_ORDENS_ALTERADAS));
  }
};

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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const recarregar = () => {
      void listarOrdens();
    };

    window.addEventListener(EVENTO_ORDENS_ALTERADAS, recarregar);
    return () => window.removeEventListener(EVENTO_ORDENS_ALTERADAS, recarregar);
  }, [listarOrdens]);

  const criarOrdem = useCallback(async (dados: NovaOrdemProducao) => {
    const { data: id, error } = await (supabase.rpc as any)(
      'criar_ordem_producao_sem_limite_v2',
      {
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
      },
    );
    if (error) throw erroRpcEmissao(error);
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
