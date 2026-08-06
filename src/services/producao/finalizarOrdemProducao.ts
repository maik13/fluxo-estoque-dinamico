import { supabase } from '@/integrations/supabase/client';
import { formatarErroSupabase } from '@/utils/supabaseError';

export interface ResultadoFinalizacaoOrdemProducao {
  ordem_producao_id: string;
  apontamentos_conferidos: number;
  apontamentos_validos: number;
  quantidade_planejada: number;
  quantidade_confirmada: number;
  status: 'concluida';
}

export class FinalizacaoParcialOrdemProducaoError extends Error {
  constructor(message: string) {
    super(message.replace(/^JUSTIFICATIVA_PARCIAL:\s*/i, ''));
    this.name = 'FinalizacaoParcialOrdemProducaoError';
  }
}

export const finalizarOrdemProducaoComConferencia = async (
  ordemProducaoId: string,
  justificativa?: string | null,
): Promise<ResultadoFinalizacaoOrdemProducao> => {
  const { data, error } = await (supabase.rpc as any)(
    'finalizar_ordem_producao_com_conferencia_v1',
    {
      p_ordem_producao_id: ordemProducaoId,
      p_justificativa: justificativa?.trim() || null,
    },
  );

  if (error) {
    const mensagem = formatarErroSupabase(
      error,
      'Não foi possível finalizar a Ordem de Produção.',
    );

    if (/JUSTIFICATIVA_PARCIAL/i.test(mensagem)) {
      throw new FinalizacaoParcialOrdemProducaoError(mensagem);
    }

    if (
      /finalizar_ordem_producao_com_conferencia_v1|schema cache|could not find the function/i.test(
        mensagem,
      )
    ) {
      throw new Error(
        'A atualização do banco para finalizar a OP com conferência automática ainda não foi aplicada. Execute a migration 20260806145500_finalizar_op_com_conferencia_v1.sql no Supabase conectado ao sistema.',
      );
    }

    throw new Error(mensagem);
  }

  return data as ResultadoFinalizacaoOrdemProducao;
};
