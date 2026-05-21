import { Movimentacao } from '@/types/estoque';

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
  const obs = mov.observacoes?.toLowerCase() || '';
  const tipoOp = mov.tipoOperacaoNome?.toLowerCase() || '';
  const dest = mov.destinatario?.toLowerCase() || '';

  if (obs.includes('acerto') || tipoOp.includes('acerto') || dest.includes('acerto')) {
    return true;
  }

  return false;
}
