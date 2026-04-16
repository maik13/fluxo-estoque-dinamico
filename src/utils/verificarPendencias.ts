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
/**
 * Verifica especificamente se uma ferramenta (item unitário) está alocada.
 * Retorna detalhes do local atual se estiver alocada.
 */
export const verificarFerramentaAlocada = async (
  itemId: string,
  estoqueId?: string | null
): Promise<{ 
  alocada: boolean; 
  saldoPendente: number; 
  localAtual?: string; 
  ultimaSaidaEm?: string 
}> => {
  try {
    let query = supabase
      .from('movements')
      .select(`
        tipo, 
        quantidade, 
        observacoes, 
        data_hora,
        locais_utilizacao:local_utilizacao_id (nome)
      `)
      .eq('item_id', itemId)
      .order('data_hora', { ascending: true });

    if (estoqueId) {
      query = query.or(`estoque_id.eq.${estoqueId},estoque_id.is.null`);
    }

    const { data, error } = await query;

    if (error || !data) return { alocada: false, saldoPendente: 0 };

    let saldo = 0;
    let lastLocal = '';
    let lastData = '';

    data.forEach((mov) => {
      if (mov.tipo === 'SAIDA') {
        saldo += Number(mov.quantidade);
        // Pegar o nome do local se disponível no join
        const localNome = (mov.locais_utilizacao as any)?.nome || 'Local não identificado';
        lastLocal = localNome;
        lastData = mov.data_hora;
      }
      if (mov.tipo === 'ENTRADA' && mov.observacoes?.toLowerCase().includes('devolução')) {
        saldo = Math.max(0, saldo - Number(mov.quantidade));
      }
    });

    return {
      alocada: saldo > 0,
      saldoPendente: saldo,
      localAtual: saldo > 0 ? lastLocal : undefined,
      ultimaSaidaEm: saldo > 0 ? lastData : undefined
    };
  } catch (err) {
    console.error('Erro ao verificar alocação de ferramenta:', err);
    return { alocada: false, saldoPendente: 0 };
  }
};
