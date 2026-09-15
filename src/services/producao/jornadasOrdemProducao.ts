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
  tarefa_id: string | null;
  membros_ids: string[];
  horarios_membros_rascunho: HorarioMembroApontamento[];
  termino_rascunho: string | null;
  quantidade_produzida_rascunho: number | null;
  minutos_improdutivos_rascunho: number | null;
  motivo_improdutivo_rascunho: string | null;
  observacoes_rascunho: string | null;
  motivo_regularizacao_rascunho: string | null;
  justificativa_conclusao_rascunho: string | null;
  contexto_atualizado_em: string | null;
}

export interface ContextoFechamentoJornadaOp {
  jornadaId: string;
  ordemProducaoId: string;
  iniciadoEm: string;
  concluirOp: boolean;
  tarefaId: string | null;
  membrosIds: string[];
  horariosMembros: HorarioMembroApontamento[];
  terminoRascunho: string | null;
  quantidadeProduzidaRascunho: number | null;
  minutosImprodutivosRascunho: number | null;
  motivoImprodutivoRascunho: string | null;
  observacoesRascunho: string | null;
  motivoRegularizacaoRascunho: string | null;
  justificativaConclusaoRascunho: string | null;
  responsavelId?: string | null;
  responsavelNome?: string | null;
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

export interface SalvarContextoJornadaOpInput {
  jornadaId: string;
  tarefaId: string | null;
  membrosIds: string[];
  horariosMembros: HorarioMembroApontamento[];
  termino: string | null;
  quantidadeProduzida: number | null;
  minutosImprodutivos: number;
  motivoImprodutivo: string | null;
  observacoes: string | null;
  motivoRegularizacao: string | null;
  justificativaConclusao: string | null;
}

export interface AjustarInicioJornadaOpInput {
  jornadaId: string;
  data: string;
  inicio: string;
  motivo: string;
}

export interface AjusteInicioJornadaOpResultado {
  jornadaId: string;
  iniciadoEm: string;
  iniciadoEmOriginal: string;
  data: string;
  inicio: string;
  ajustadoEm: string;
  retroativo: boolean;
}

const erro = (value: unknown, fallback: string) =>
  new Error(formatarErroSupabase(value, fallback));

const normalizarJornada = (item: any): JornadaOpAberta => ({
  id: String(item.id),
  ordem_producao_id: String(item.ordem_producao_id),
  iniciado_em: String(item.iniciado_em),
  iniciado_por_id: item.iniciado_por_id ?? null,
  iniciado_por_nome_snapshot: item.iniciado_por_nome_snapshot ?? null,
  pendente_dia_anterior: Boolean(item.pendente_dia_anterior),
  tarefa_id: item.tarefa_id ?? null,
  membros_ids: Array.isArray(item.membros_ids) ? item.membros_ids : [],
  horarios_membros_rascunho: Array.isArray(item.horarios_membros_rascunho)
    ? item.horarios_membros_rascunho
    : [],
  termino_rascunho: item.termino_rascunho ?? null,
  quantidade_produzida_rascunho:
    item.quantidade_produzida_rascunho == null
      ? null
      : Number(item.quantidade_produzida_rascunho),
  minutos_improdutivos_rascunho:
    item.minutos_improdutivos_rascunho == null
      ? null
      : Number(item.minutos_improdutivos_rascunho),
  motivo_improdutivo_rascunho: item.motivo_improdutivo_rascunho ?? null,
  observacoes_rascunho: item.observacoes_rascunho ?? null,
  motivo_regularizacao_rascunho: item.motivo_regularizacao_rascunho ?? null,
  justificativa_conclusao_rascunho: item.justificativa_conclusao_rascunho ?? null,
  contexto_atualizado_em: item.contexto_atualizado_em ?? null,
});

export const listarJornadasOpAbertas = async (): Promise<JornadaOpAberta[]> => {
  const { data, error } = await (supabase.rpc as any)(
    'listar_jornadas_op_abertas_v1',
  );

  if (error) {
    throw erro(error, 'Não foi possível carregar os apontamentos em aberto das OPs.');
  }

  return (data ?? []).map(normalizarJornada);
};

export const obterJornadaOpAberta = async (
  jornadaId: string,
): Promise<JornadaOpAberta | null> => {
  const jornadas = await listarJornadasOpAbertas();
  return jornadas.find((jornada) => jornada.id === jornadaId) ?? null;
};

export const contextoFechamentoJornada = (
  jornada: JornadaOpAberta,
  concluirOp: boolean,
  responsavelId?: string | null,
  responsavelNome?: string | null,
): ContextoFechamentoJornadaOp => ({
  jornadaId: jornada.id,
  ordemProducaoId: jornada.ordem_producao_id,
  iniciadoEm: jornada.iniciado_em,
  concluirOp,
  tarefaId: jornada.tarefa_id,
  membrosIds: jornada.membros_ids,
  horariosMembros: jornada.horarios_membros_rascunho,
  terminoRascunho: jornada.termino_rascunho,
  quantidadeProduzidaRascunho: jornada.quantidade_produzida_rascunho,
  minutosImprodutivosRascunho: jornada.minutos_improdutivos_rascunho,
  motivoImprodutivoRascunho: jornada.motivo_improdutivo_rascunho,
  observacoesRascunho: jornada.observacoes_rascunho,
  motivoRegularizacaoRascunho: jornada.motivo_regularizacao_rascunho,
  justificativaConclusaoRascunho: jornada.justificativa_conclusao_rascunho,
  responsavelId: responsavelId ?? null,
  responsavelNome: responsavelNome ?? null,
});

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
    tarefa_id: null,
    membros_ids: [],
    horarios_membros_rascunho: [],
    termino_rascunho: null,
    quantidade_produzida_rascunho: null,
    minutos_improdutivos_rascunho: null,
    motivo_improdutivo_rascunho: null,
    observacoes_rascunho: null,
    motivo_regularizacao_rascunho: null,
    justificativa_conclusao_rascunho: null,
    contexto_atualizado_em: null,
  };
};

export const salvarContextoJornadaOp = async (
  dados: SalvarContextoJornadaOpInput,
): Promise<void> => {
  const { error } = await (supabase.rpc as any)(
    'salvar_contexto_jornada_op_v1',
    {
      p_jornada_id: dados.jornadaId,
      p_tarefa_id: dados.tarefaId,
      p_membros: [...new Set(dados.membrosIds)],
      p_horarios_membros: dados.horariosMembros,
      p_termino: dados.termino,
      p_quantidade_produzida: dados.quantidadeProduzida,
      p_minutos_improdutivos: dados.minutosImprodutivos,
      p_motivo_improdutivo: dados.motivoImprodutivo,
      p_observacoes: dados.observacoes,
      p_motivo_regularizacao: dados.motivoRegularizacao,
      p_justificativa_conclusao: dados.justificativaConclusao,
    },
  );

  if (error) {
    throw erro(error, 'Não foi possível preservar o rascunho desta jornada.');
  }
};

export const ajustarInicioJornadaOp = async (
  dados: AjustarInicioJornadaOpInput,
): Promise<AjusteInicioJornadaOpResultado> => {
  const { data, error } = await (supabase.rpc as any)(
    'ajustar_inicio_jornada_op_v1',
    {
      p_jornada_id: dados.jornadaId,
      p_nova_data: dados.data,
      p_novo_inicio: dados.inicio,
      p_motivo: dados.motivo,
    },
  );

  if (error) {
    throw erro(error, 'Não foi possível ajustar o horário real de início.');
  }

  const resultado = data as {
    jornada_id: string;
    iniciado_em: string;
    iniciado_em_original: string;
    data: string;
    inicio: string;
    ajustado_em: string;
    retroativo: boolean;
  };

  return {
    jornadaId: String(resultado.jornada_id),
    iniciadoEm: String(resultado.iniciado_em),
    iniciadoEmOriginal: String(resultado.iniciado_em_original),
    data: String(resultado.data),
    inicio: String(resultado.inicio).slice(0, 5),
    ajustadoEm: String(resultado.ajustado_em),
    retroativo: Boolean(resultado.retroativo),
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
