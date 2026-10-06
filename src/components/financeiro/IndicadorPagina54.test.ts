import { describe, expect, it } from 'vitest';
import { temOrigemPagina54 } from './IndicadorPagina54';

describe('temOrigemPagina54', () => {
  it.each([
    { origem_tipo: 'pagina54' },
    { pagina54_integracao_id: 'integracao-1' },
    { planilha_linha: 322 },
    { pagina54_sync_status: 'sincronizado' },
    { origem_planilha: true },
  ])('identifica cada regra de origem Página54: %o', (dados) => {
    expect(temOrigemPagina54(dados)).toBe(true);
  });

  it('não sinaliza um registro manual do sistema', () => {
    expect(temOrigemPagina54({ origem_tipo: 'manual', origem_planilha: false })).toBe(false);
  });
});