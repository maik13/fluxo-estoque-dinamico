// Tipos de dados para o sistema de estoque
// Este arquivo define a estrutura de dados que será usada em todo o sistema

export interface Item {
  id: string;
  codigoBarras: number;
  codigoAntigo?: string; // Código antigo do item (opcional)
  origem: string;
  caixaOrganizador: string;
  localizacao: string;
  nome: string;
  tipoItem: 'Insumo' | 'Ferramenta'; // Tipo do item
  especificacao: string; // Amperagem bateria, bitola, tipo de pisca, etc.
  marca: string;
  unidade: string; // metro, peça, kg, etc.
  condicao: 'Novo' | 'Usado' | 'Defeito' | 'Descarte';
  subcategoriaId?: string; // ID da subcategoria (referência)
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
  userId?: string; // ID do usuário que realizou a movimentação
  observacoes?: string;
  dataHora: string;
  localUtilizacaoId?: string; // ID do local de utilização
  localUtilizacaoNome?: string; // Nome do local de utilização
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
  created_at: string;
}

export interface TipoServicoConfig {
  id: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  created_at: string;
}

export interface SubcategoriaConfig {
  id: string;
  nome: string;
  categoria: string;
  ativo: boolean;
  created_at: string;
}