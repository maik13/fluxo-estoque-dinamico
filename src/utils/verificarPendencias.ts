import { supabase } from '@/integrations/supabase/client';

/**
 * Verifica se um item possui devoluções pendentes (saídas sem devolução correspondente).
 * Calcula o saldo cronologicamente, nunca permitindo que fique negativo,
 * para evitar que devoluções históricas "extras" mascarem pendências atuais.
 */
export const verificarDevolucaoPendente = async (
  itemId: string,
  estoqueId?: string | null
): Promise<{ pendente: boolean; saldoPendente: number }> => {
  try {
    let query = supabase
      .from('movements')
      .select('tipo, quantidade, observacoes, created_at')
      .eq('item_id', itemId)
      .order('created_at', { ascending: true });

    if (estoqueId) {
      query = query.or(`estoque_id.eq.${estoqueId},estoque_id.is.null`);
    }

    const { data, error } = await query;

    if (error || !data) return { pendente: false, saldoPendente: 0 };

    // Calcular saldo cronologicamente, nunca permitindo negativo
    let saldo = 0;
    data.forEach((mov) => {
      if (mov.tipo === 'SAIDA') {
        saldo += Number(mov.quantidade);
      }
      if (mov.tipo === 'ENTRADA' && mov.observacoes?.toLowerCase().includes('devolução')) {
        saldo = Math.max(0, saldo - Number(mov.quantidade));
      }
    });

    return { pendente: saldo > 0, saldoPendente: saldo };
  } catch {
    return { pendente: false, saldoPendente: 0 };
  }
};

/**
 * Verifica se um item possui saídas registradas (para validar devoluções).
 * Retorna true se houve pelo menos uma saída.
 */
export const verificarSaidaExistente = async (
  itemId: string,
  estoqueId?: string | null
): Promise<{ possuiSaida: boolean; totalSaidas: number }> => {
  try {
    let query = supabase
      .from('movements')
      .select('quantidade')
      .eq('item_id', itemId)
      .eq('tipo', 'SAIDA');

    if (estoqueId) {
      query = query.or(`estoque_id.eq.${estoqueId},estoque_id.is.null`);
    }

    const { data, error } = await query;

    if (error || !data) return { possuiSaida: false, totalSaidas: 0 };

    const total = data.reduce((acc, mov) => acc + Number(mov.quantidade), 0);
    return { possuiSaida: total > 0, totalSaidas: total };
  } catch {
    return { possuiSaida: false, totalSaidas: 0 };
  }
};
