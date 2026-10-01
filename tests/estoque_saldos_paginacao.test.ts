import { describe, expect, it } from 'vitest';
import { carregarSaldosCompletos } from '../src/services/estoque/carregarSaldosCompletos';

const saldos = Array.from({ length: 2339 }, (_, n) => ({
  item_id: String(n).padStart(4, '0'), saldo_atual: 1,
}));

describe('posição completa do estoque', () => {
  it('preserva saldos após o limite de 1000 itens, incluindo o último código', async () => {
    const resultado = await carregarSaldosCompletos(async (inicio, fim) => ({
      data: saldos.slice(inicio, Math.min(fim + 1, inicio + 1000)),
      error: null, count: saldos.length,
    }));
    expect(resultado).toHaveLength(2339);
    expect(resultado[2124].saldo_atual).toBe(1);
    expect(resultado[2338].saldo_atual).toBe(1);
  });

  it('não publica uma posição parcial quando uma página falha', async () => {
    await expect(carregarSaldosCompletos(async (inicio, fim) => ({
      data: inicio === 0 ? saldos.slice(inicio, fim + 1) : null,
      error: inicio === 0 ? null : new Error('falha na segunda página'),
      count: saldos.length,
    }))).rejects.toThrow('falha na segunda página');
  });

  it('continua carregando quando o servidor entrega menos que o tamanho pedido', async () => {
    const resultado = await carregarSaldosCompletos(async (inicio) => ({
      data: saldos.slice(inicio, inicio + 100), error: null, count: saldos.length,
    }));
    expect(resultado).toHaveLength(2339);
  });

  it('rejeita paginação repetida e consulta incompleta em vez de converter ausência em zero', async () => {
    await expect(carregarSaldosCompletos(async () => ({
      data: saldos.slice(0, 500), error: null, count: saldos.length,
    }))).rejects.toThrow('itens repetidos');
    await expect(carregarSaldosCompletos(async (inicio) => ({
      data: inicio === 0 ? saldos.slice(0, 500) : [],
      error: null, count: saldos.length,
    }))).rejects.toThrow('posição completa');
  });
});
