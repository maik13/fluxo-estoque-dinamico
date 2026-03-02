import { supabase } from '@/integrations/supabase/client';

/**
 * Verifica se um item possui devoluções pendentes (saídas sem devolução correspondente).
 * Retorna o saldo pendente (saídas - devoluções com "devolução" nas observações).
 */
export const verificarDevolucaoPendente = async (
  itemId: string,
  estoqueId?: string | null
): Promise<{ pendente: boolean; saldoPendente: number }> => {
  try {
    // Buscar todas as movimentações do item
    let query = supabase
      .from('movements')
      .select('tipo, quantidade, observacoes')
      .eq('item_id', itemId);

    if (estoqueId) {
      query = query.or(`estoque_id.eq.${estoqueId},estoque_id.is.null`);
    }

    const { data, error } = await query;

    if (error || !data) return { pendente: false, saldoPendente: 0 };

    let totalSaidas = 0;
    let totalDevolucoes = 0;

    data.forEach((mov) => {
      if (mov.tipo === 'SAIDA') {
        totalSaidas += Number(mov.quantidade);
      }
      if (mov.tipo === 'ENTRADA' && mov.observacoes?.toLowerCase().includes('devolução')) {
        totalDevolucoes += Number(mov.quantidade);
      }
    });

    const saldoPendente = totalSaidas - totalDevolucoes;
    return { pendente: saldoPendente > 0, saldoPendente: Math.max(0, saldoPendente) };
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
