import { Movimentacao } from '@/types/estoque';

export function normalizarMovimentacaoTexto(texto?: string | null): string {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Verifica se uma movimentação é considerada uma "Saída para acerto"
 * de acordo com as regras de negócio:
 * 1. Deve ser do tipo SAIDA.
 * 2. Não possui destino (Projeto/Local de Utilização).
 * 3. OU possui a palavra "acerto" nas observações ou no tipo de operação.
 */
export function isAcertoDeEstoque(mov: Movimentacao | any): boolean {
  if (mov?.tipo !== 'SAIDA') return false;

  // Se tem a palavra "acerto" nas observações ou no tipo de operação
  const obs = normalizarMovimentacaoTexto(mov.observacoes);
  const tipoOp = normalizarMovimentacaoTexto(mov.tipoOperacaoNome);
  const dest = normalizarMovimentacaoTexto(mov.destinatario);

  if (obs.includes('acerto') || tipoOp.includes('acerto') || dest.includes('acerto')) {
    return true;
  }

  return false;
}

export function isEntradaParaAcerto(mov: Movimentacao | any): boolean {
  if (mov?.tipo !== 'ENTRADA') return false;

  const obs = normalizarMovimentacaoTexto(mov.observacoes);
  const tipoOp = normalizarMovimentacaoTexto(mov.tipoOperacaoNome);

  return obs.includes('acerto') || tipoOp.includes('acerto');
}
