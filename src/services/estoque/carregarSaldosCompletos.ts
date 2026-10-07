export interface PaginaSaldos<T> {
  data: T[] | null;
  error: unknown;
  count?: number | null;
}

// Fetch every balance before publishing the inventory. A partial page is not zero stock.
export async function carregarSaldosCompletos<T extends { item_id: string }>(
  buscarPagina: (inicio: number, fim: number) => PromiseLike<PaginaSaldos<T>>,
): Promise<T[]> {
  // A leitura do saldo é paginada porque a API limita o tamanho da resposta.
  // Uma movimentação pode ocorrer entre duas páginas; nesse caso recomeçamos
  // silenciosamente a leitura para publicar somente uma posição consistente.
  const tamanhoPagina = 1000;
  const maxTentativas = 3;
  let ultimoErro: unknown;

  for (let tentativa = 0; tentativa < maxTentativas; tentativa += 1) {
    const saldos: T[] = [];
    const ids = new Set<string>();
    let totalEsperado: number | null = null;
    let leituraMudou = false;

    for (;;) {
      const inicio = saldos.length;
      const { data, error, count } = await buscarPagina(inicio, inicio + tamanhoPagina - 1);
      if (error) throw error;
      if (count != null) {
        if (totalEsperado != null && count !== totalEsperado) {
          leituraMudou = true;
          break;
        }
        totalEsperado = count;
      }
      const pagina = data ?? [];
      for (const saldo of pagina) {
        if (ids.has(saldo.item_id)) {
          leituraMudou = true;
          break;
        }
        ids.add(saldo.item_id);
        saldos.push(saldo);
      }
      if (leituraMudou) break;

      if (totalEsperado != null) {
        if (saldos.length === totalEsperado) return saldos;
        if (saldos.length > totalEsperado || pagina.length === 0) {
          throw new Error('Não foi possível carregar a posição completa do estoque.');
        }
      } else if (pagina.length < tamanhoPagina) {
        return saldos;
      }
    }

    ultimoErro = new Error('A posição do estoque mudou durante a consulta.');
  }

  throw ultimoErro;
}
