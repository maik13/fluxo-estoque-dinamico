// Tipos de dados para o sistema de estoque
// Este arquivo define a estrutura de dados que será usada em todo o sistema

export interface Item {
  id: string;
  codigoBarras: number;
  origem: string;
  caixaOrganizador: string;
  localizacao: string;
  responsavel: string;
  nome: string;
  tipoItem: 'Insumo' | 'Ferramenta'; // Tipo do item
  metragem?: number; // Para cabos
  peso?: number;
  comprimentoLixa?: number;
  polaridadeDisjuntor?: string;
  especificacao: string; // Amperagem bateria, bitola, tipo de pisca, etc.
  marca: string;
  quantidade: number;
  unidade: string; // metro, peça, kg, etc.
  condicao: 'Novo' | 'Usado' | 'Defeito' | 'Descarte';
  categoria: string;
  subcategoria: string;
  subcategoriaId?: string; // ID da subcategoria (referência)
  subDestino: string; // Estoque eterno/múltiplos estoques
  tipoServico: string;
  dataCriacao: string;
  quantidadeMinima?: number; // Para alertas de estoque baixo
  ncm?: string; // NCM - Nomenclatura Comum do Mercosul
  valor?: number; // Valor unitário do item
}

export interface Movimentacao {
  id: string;
  itemId: string;
  tipo: 'ENTRADA' | 'SAIDA' | 'CADASTRO';
  quantidade: number;
  quantidadeAnterior: number;
  quantidadeAtual: number;
  responsavel: string; // Mantido temporariamente para retrocompatibilidade
  userId?: string; // ID do usuário que realizou a movimentação
  observacoes?: string;
  local_utilizacao?: string;
  dataHora: string;
  // Dados do item no momento da movimentação (para histórico)
  itemSnapshot: Partial<Item>;
}

export interface EstoqueItem extends Item {
  ultimaMovimentacao?: Movimentacao;
  estoqueAtual: number;
}

export type TipoMovimentacao = 'ENTRADA' | 'SAIDA' | 'CADASTRO';

// Interfaces para configurações pré-cadastradas
export interface EstoqueConfig {
  id: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  dataCriacao: string;
}

export interface TipoServicoConfig {
  id: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  dataCriacao: string;
}

export interface SubcategoriaConfig {
  id: string;
  nome: string;
  categoria: string;
  ativo: boolean;
  dataCriacao: string;
}