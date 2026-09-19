import { supabase } from '@/integrations/supabase/client';
import type { ConsumoTintaInput } from '@/types/producao';
import { formatarErroSupabase } from '@/utils/supabaseError';

const erro = (value: unknown, fallback: string) =>
  new Error(formatarErroSupabase(value, fallback));

export const registrarConsumosTintaOp = async (
  ordemProducaoId: string,
  apontamentoId: string | null,
  consumos: ConsumoTintaInput[],
): Promise<void> => {
  if (consumos.length === 0) return;

  const { error } = await (supabase.rpc as any)('registrar_consumos_tinta_op_v1', {
    p_ordem_producao_id: ordemProducaoId,
    p_apontamento_id: apontamentoId,
    p_consumos: consumos,
  });

  if (error) {
    throw erro(error, 'Não foi possível registrar o consumo de tinta.');
  }
};
