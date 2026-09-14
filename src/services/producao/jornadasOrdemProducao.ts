import { supabase } from '@/integrations/supabase/client';
import type {
  HorarioMembroApontamento,
  ProducaoApontamento,
} from '@/types/producao';
import { formatarErroSupabase } from '@/utils/supabaseError';

export interface JornadaOpAberta {
  id: string;
  ordem_producao_id: string;
  iniciado_em: string;
  iniciado_por_id: string | null;
  iniciado_por_nome_snapshot: string | null;
  pendente_dia_anterior: boolean;
}

export interface ContextoFechamentoJornadaOp {
  jornadaId: string;
  ordemProducaoId: string;
  iniciadoEm: string;
  concluirOp: boolean;
}

export interface FinalizarJornadaOpInput {
  jornadaId: string;
  tarefaId: string;
  quantidadeProduzida: number | null;
  termino: string;
  minutosImprodutivos: number;
  motivoImprodutivo: string | null;
  observacoes: string | null;
  membrosIds: string[];
  horariosMembros: HorarioMembroApontamento[];
  concluirOp: boolean;
  motivoRegularizacao: string | null;
  justificativaConclusao: string | null;
}

const erro = (value: unknown, fallback: string) =>
  new Error(formatarErroSupabase(value, fallback));

export const listarJornadasOpAbertas = async (): Promise<JornadaOpAberta[]> => {
  const { data, error } = await (supabase.rpc as any)(
    'listar_jornadas_op_abertas_v1',
  );

  if (error) {
    throw erro(error, 'Não foi possível carregar os apontamentos em aberto das OPs.');
  }

  return (data ?? []) as JornadaOpAberta[];
};

export const iniciarJornadaOp = async (
  ordemProducaoId: string,
): Promise<JornadaOpAberta> => {
  const { data, error } = await (supabase.rpc as any)(
    'iniciar_jornada_op_v1',
    { p_ordem_producao_id: ordemProducaoId },
  );

  if (error) {
    throw erro(error, 'Não foi possível iniciar o trabalho nesta OP.');
  }

  const resultado = data as {
    jornada_id: string;
    ordem_producao_id: string;
    iniciado_em: string;
  };

  return {
    id: resultado.jornada_id,
    ordem_producao_id: resultado.ordem_producao_id,
    iniciado_em: resultado.iniciado_em,
    iniciado_por_id: null,
    iniciado_por_nome_snapshot: null,
    pendente_dia_anterior: false,
  };
};

export const finalizarJornadaOp = async (
  dados: FinalizarJornadaOpInput,
): Promise<ProducaoApontamento> => {
  const { data, error } = await (supabase.rpc as any)(
    'finalizar_jornada_op_v1',
    {
      p_jornada_id: dados.jornadaId,
      p_tarefa_id: dados.tarefaId,
      p_quantidade_produzida: dados.quantidadeProduzida,
      p_termino: dados.termino,
      p_minutos_improdutivos: dados.minutosImprodutivos,
      p_motivo_improdutivo: dados.motivoImprodutivo,
      p_observacoes: dados.observacoes,
      p_membros: [...new Set(dados.membrosIds)],
      p_horarios_membros: dados.horariosMembros,
      p_concluir_op: dados.concluirOp,
      p_motivo_regularizacao: dados.motivoRegularizacao,
      p_justificativa_conclusao: dados.justificativaConclusao,
    },
  );

  if (error) {
    throw erro(error, 'Não foi possível encerrar o trabalho desta OP.');
  }

  const resultado = data as { apontamento_id: string };
  const { data: apontamento, error: readError } = await (
    supabase.from('producao_apontamentos') as any
  )
    .select('*')
    .eq('id', resultado.apontamento_id)
    .single();

  if (readError) {
    throw erro(
      readError,
      'O trabalho foi encerrado, mas o apontamento não pôde ser recarregado.',
    );
  }

  return apontamento as ProducaoApontamento;
};
