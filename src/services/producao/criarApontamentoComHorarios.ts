import { supabase } from '@/integrations/supabase/client';
import { calcularDuracaoProducao } from '@/hooks/useProducao';
import type { NovoApontamentoProducao, ProducaoApontamento } from '@/types/producao';
import { formatarErroSupabase } from '@/utils/supabaseError';

export const criarApontamentoComHorarios = async (
  dados: NovoApontamentoProducao,
): Promise<ProducaoApontamento> => {
  const duracao = calcularDuracaoProducao(dados.inicio, dados.termino);
  const minutosImprodutivos = Number(dados.minutos_improdutivos ?? 0);
  const minutosProdutivos = dados.minutos_produtivos ?? duracao - minutosImprodutivos;

  if (
    minutosProdutivos < 0 ||
    minutosImprodutivos < 0 ||
    minutosProdutivos + minutosImprodutivos !== duracao
  ) {
    throw new Error('A soma dos tempos deve ser igual à duração do apontamento.');
  }

  const { data: id, error } = await (supabase.rpc as any)(
    'criar_apontamento_producao_com_horarios',
    {
      p_data: dados.data,
      p_ordem_producao_id: dados.ordem_producao_id ?? null,
      p_processo_id: dados.processo_id ?? null,
      p_projeto_local_id: dados.projeto_local_id ?? null,
      p_tarefa_id: dados.tarefa_id,
      p_local_tipo: dados.local_tipo,
      p_quantidade_produzida: dados.quantidade_produzida ?? null,
      p_inicio: dados.inicio,
      p_termino: dados.termino,
      p_duracao_minutos: duracao,
      p_minutos_produtivos: minutosProdutivos,
      p_minutos_improdutivos: minutosImprodutivos,
      p_motivo_improdutivo: dados.motivo_improdutivo ?? null,
      p_observacoes: dados.observacoes?.trim() || null,
      p_membros: [...new Set(dados.membros_ids)],
      p_horarios_membros: dados.horarios_membros ?? [],
    },
  );

  if (error) {
    throw new Error(
      formatarErroSupabase(
        error,
        'Não foi possível salvar os horários individuais da equipe.',
      ),
    );
  }

  const { data: apontamento, error: readError } = await (
    supabase.from('producao_apontamentos') as any
  )
    .select('*')
    .eq('id', id)
    .single();

  if (readError) {
    throw new Error(
      formatarErroSupabase(
        readError,
        'O apontamento foi salvo, mas não pôde ser recarregado.',
      ),
    );
  }

  return apontamento as ProducaoApontamento;
};
