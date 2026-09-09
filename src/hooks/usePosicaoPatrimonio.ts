import { useMemo } from 'react';
import { EstoqueItem } from '@/types/estoque';
import { AlocacaoEstoqueContado, useEstoqueContado } from '@/hooks/useEstoqueContado';

/**
 * Camada somente leitura.
 * Não altera movimentações, não recalcula saldo operacional e não escreve no banco.
 * Reutiliza a lógica de alocação já existente (Estoque Contado) para ferramentas.
 */
export type SituacaoPosicao =
  | 'No almoxarifado'
  | 'Em uso/projeto'
  | 'Parcialmente em uso'
  | 'Em estoque'
  | 'Sem saldo'
  | 'Divergência de estoque';

export type StatusPreco = 'Com preço' | 'Sem preço';

export interface LinhaPosicaoPatrimonio {
  item: EstoqueItem;
  codigo: number;
  tipo: string;
  nome: string;
  marca: string;
  especificacao: string;
  categoria: string;
  subcategoria: string;
  condicao: string;
  unidade: string;
  ativo: boolean;
  quantidadeAlmoxarifado: number;
  quantidadeAlocada: number;
  quantidadeConsiderada: number;
  situacao: SituacaoPosicao;
  projetoLocalUso: string;
  valorUnitario: number | null;
  valorTotal: number | null;
  statusPreco: StatusPreco;
  divergencia: boolean;
  ehFerramenta: boolean;
}

export interface TotaisPosicaoPatrimonio {
  itensConsiderados: number;
  quantidadeFisicaAlmoxarifado: number;
  ferramentasEmUso: number;
  quantidadePatrimonialFerramentas: number;
  quantidadeInsumosEstoque: number;
  itensPrecificados: number;
  itensSemPreco: number;
  valorAlmoxarifadoConhecido: number;
  valorFerramentasAlocadasConhecido: number;
  valorPatrimonialFerramentasConhecido: number;
  valorTotalConhecido: number;
  itensComDivergencia: number;
}

export const temPrecoValido = (item: EstoqueItem): boolean =>
  typeof item.valor === 'number' && Number.isFinite(item.valor) && item.valor > 0;

interface ContextoLinha {
  categoria?: string;
  subcategoria?: string;
}

export const montarLinhaPosicao = (
  item: EstoqueItem,
  alocacao: AlocacaoEstoqueContado | undefined,
  contexto: ContextoLinha = {}
): LinhaPosicaoPatrimonio => {
  const ehFerramenta = item.tipoItem === 'Ferramenta';
  const quantidadeAlmoxarifado = Number(item.estoqueAtual) || 0;
  const quantidadeAlocada = ehFerramenta ? Number(alocacao?.saldoPendente || 0) : 0;
  const almoxarifadoPositivo = Math.max(0, quantidadeAlmoxarifado);

  const quantidadeConsiderada = ehFerramenta
    ? almoxarifadoPositivo + quantidadeAlocada
    : quantidadeAlmoxarifado;

  const divergencia = quantidadeAlmoxarifado < 0;

  let situacao: SituacaoPosicao;
  if (divergencia) {
    situacao = 'Divergência de estoque';
  } else if (ehFerramenta) {
    if (quantidadeAlocada > 0 && almoxarifadoPositivo > 0) situacao = 'Parcialmente em uso';
    else if (quantidadeAlocada > 0) situacao = 'Em uso/projeto';
    else if (almoxarifadoPositivo > 0) situacao = 'No almoxarifado';
    else situacao = 'Sem saldo';
  } else {
    situacao = quantidadeAlmoxarifado > 0 ? 'Em estoque' : 'Sem saldo';
  }

  const precificado = temPrecoValido(item);
  const valorUnitario = precificado ? (item.valor as number) : null;
  const quantidadeParaValor = Math.max(0, quantidadeConsiderada);
  const valorTotal = valorUnitario !== null ? valorUnitario * quantidadeParaValor : null;

  return {
    item,
    codigo: item.codigoBarras,
    tipo: item.tipoItem || '-',
    nome: item.nome || '-',
    marca: item.marca || '-',
    especificacao: item.especificacao || '-',
    categoria: contexto.categoria || '-',
    subcategoria: contexto.subcategoria || '-',
    condicao: item.condicao || '-',
    unidade: item.unidade || '-',
    ativo: item.ativo !== false,
    quantidadeAlmoxarifado,
    quantidadeAlocada,
    quantidadeConsiderada,
    situacao,
    projetoLocalUso: quantidadeAlocada > 0 ? (alocacao?.localAtual || 'Local não identificado') : '-',
    valorUnitario,
    valorTotal,
    statusPreco: precificado ? 'Com preço' : 'Sem preço',
    divergencia,
    ehFerramenta,
  };
};

export const calcularTotaisPosicao = (linhas: LinhaPosicaoPatrimonio[]): TotaisPosicaoPatrimonio => {
  const totais: TotaisPosicaoPatrimonio = {
    itensConsiderados: linhas.length,
    quantidadeFisicaAlmoxarifado: 0,
    ferramentasEmUso: 0,
    quantidadePatrimonialFerramentas: 0,
    quantidadeInsumosEstoque: 0,
    itensPrecificados: 0,
    itensSemPreco: 0,
    valorAlmoxarifadoConhecido: 0,
    valorFerramentasAlocadasConhecido: 0,
    valorPatrimonialFerramentasConhecido: 0,
    valorTotalConhecido: 0,
    itensComDivergencia: 0,
  };

  linhas.forEach((linha) => {
    const almoxPositivo = Math.max(0, linha.quantidadeAlmoxarifado);
    totais.quantidadeFisicaAlmoxarifado += almoxPositivo;

    if (linha.divergencia) totais.itensComDivergencia += 1;

    if (linha.ehFerramenta) {
      totais.ferramentasEmUso += linha.quantidadeAlocada;
      totais.quantidadePatrimonialFerramentas += Math.max(0, linha.quantidadeConsiderada);
    } else if (linha.item.tipoItem === 'Insumo') {
      totais.quantidadeInsumosEstoque += almoxPositivo;
    }

    if (linha.valorUnitario === null) {
      totais.itensSemPreco += 1;
      return;
    }

    totais.itensPrecificados += 1;
    totais.valorAlmoxarifadoConhecido += linha.valorUnitario * almoxPositivo;
    totais.valorTotalConhecido += linha.valorTotal || 0;

    if (linha.ehFerramenta) {
      const valorAlocado = linha.valorUnitario * linha.quantidadeAlocada;
      totais.valorFerramentasAlocadasConhecido += valorAlocado;
      totais.valorPatrimonialFerramentasConhecido += linha.valorTotal || 0;
    }
  });

  return totais;
};

interface UsePosicaoPatrimonioOptions {
  itens: EstoqueItem[];
  estoqueId?: string | null;
  ativo?: boolean;
  obterCategoriaDoItem?: (item: EstoqueItem) => ContextoLinha;
}

export const usePosicaoPatrimonio = ({
  itens,
  estoqueId,
  ativo = true,
  obterCategoriaDoItem,
}: UsePosicaoPatrimonioOptions) => {
  const { alocacoes, carregando } = useEstoqueContado({ itens, estoqueId, ativo });

  const linhas = useMemo(
    () =>
      itens.map((item) =>
        montarLinhaPosicao(item, alocacoes[item.id], obterCategoriaDoItem?.(item) ?? {})
      ),
    [itens, alocacoes, obterCategoriaDoItem]
  );

  const totais = useMemo(() => calcularTotaisPosicao(linhas), [linhas]);

  return { linhas, totais, carregando, alocacoes };
};
