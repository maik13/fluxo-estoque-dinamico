export interface PaginaSaldos<T> {
  data: T[] | null;
  error: unknown;
  count?: number | null;
}

// Fetch every balance before publishing the inventory. A partial page is not zero stock.
export async function carregarSaldosCompletos<T extends { item_id: string }>(
  buscarPagina: (inicio: number, fim: number) => PromiseLike<PaginaSaldos<T>>,
): Promise<T[]> {
  const tamanhoPagina = 500;
  const saldos: T[] = [];
  const ids = new Set<string>();
  let totalEsperado: number | null = null;

  for (;;) {
    const inicio = saldos.length;
    const { data, error, count } = await buscarPagina(inicio, inicio + tamanhoPagina - 1);
    if (error) throw error;
    if (count != null) {
      if (totalEsperado != null && count !== totalEsperado) {
        throw new Error('A posição do estoque mudou durante a consulta. Atualize novamente.');
      }
      totalEsperado = count;
    }
    const pagina = data ?? [];
    for (const saldo of pagina) {
      if (ids.has(saldo.item_id)) {
        throw new Error('A consulta de saldos retornou itens repetidos. Atualize novamente.');
      }
      ids.add(saldo.item_id);
      saldos.push(saldo);
    }

    if (totalEsperado != null) {
      if (saldos.length === totalEsperado) return saldos;
      if (saldos.length > totalEsperado || pagina.length === 0) {
        throw new Error('Não foi possível carregar a posição completa do estoque.');
      }
    } else if (pagina.length < tamanhoPagina) {
      return saldos;
    }
  }
}
