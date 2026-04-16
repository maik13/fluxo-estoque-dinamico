import { supabase } from '@/integrations/supabase/client';
import { REGRA_FERRAMENTA_UNICA_ATIVA_DESDE } from '@/config/regra-ferramenta';

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
 * ESTA LOGICA É PROSPECTIVA: Considera apenas movimentações a partir do MARCO DE IMPLANTAÇÃO.
 */
export const verificarFerramentaAlocada = async (
  itemId: string,
  estoqueId?: string | null
): Promise<{ 
  alocada: boolean; 
  saldoPendente: number; 
  localAtual?: string; 
  localAtualId?: string; // ID para validação na devolução
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
        created_at,
        local_utilizacao_id,
        locais_utilizacao:local_utilizacao_id (nome)
      `)
      .eq('item_id', itemId)
      .gte('created_at', REGRA_FERRAMENTA_UNICA_ATIVA_DESDE) // FILTRO PROSPECTIVO
      .order('data_hora', { ascending: true });

    if (estoqueId) {
      query = query.or(`estoque_id.eq.${estoqueId},estoque_id.is.null`);
    }

    const { data, error } = await query;

    if (error || !data) return { alocada: false, saldoPendente: 0 };

    let saldo = 0;
    let lastLocal = '';
    let lastLocalId = '';
    let lastData = '';

    data.forEach((mov) => {
      if (mov.tipo === 'SAIDA') {
        saldo += Number(mov.quantidade);
        const localNome = (mov.locais_utilizacao as any)?.nome || 'Local não identificado';
        lastLocal = localNome;
        lastLocalId = mov.local_utilizacao_id || '';
        lastData = mov.data_hora;
      }
      if (mov.tipo === 'ENTRADA' && mov.observacoes?.toLowerCase().includes('devolução')) {
        // Para ferramentas, a devolução "zera" a pendência mais recente
        saldo = Math.max(0, saldo - Number(mov.quantidade));
      }
    });

    return {
      alocada: saldo > 0,
      saldoPendente: saldo,
      localAtual: saldo > 0 ? lastLocal : undefined,
      localAtualId: saldo > 0 ? lastLocalId : undefined,
      ultimaSaidaEm: saldo > 0 ? lastData : undefined
    };
  } catch (err) {
    console.error('Erro ao verificar alocação prospectiva de ferramenta:', err);
    return { alocada: false, saldoPendente: 0 };
  }
};
