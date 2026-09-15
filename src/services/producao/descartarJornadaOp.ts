import { supabase } from '@/integrations/supabase/client';
import { formatarErroSupabase } from '@/utils/supabaseError';

export const descartarJornadaOp = async (
  jornadaId: string,
  motivo: string,
): Promise<void> => {
  const { error } = await (supabase.rpc as any)('descartar_jornada_op_v1', {
    p_jornada_id: jornadaId,
    p_motivo: motivo.trim(),
  });

  if (error) {
    throw new Error(
      formatarErroSupabase(error, 'Não foi possível descartar este apontamento aberto.'),
    );
  }
};
