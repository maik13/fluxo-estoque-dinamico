import { Item } from './estoque';

export interface Solicitacao {
  id: string;
  numero?: number;
  solicitante_id: string;
  solicitante_nome: string;
  status: 'pendente' | 'aprovada' | 'rejeitada';
  observacoes?: string;
  local_utilizacao?: string;
  data_solicitacao: string;
  data_aprovacao?: string;
  aprovado_por_id?: string;
  aprovado_por_nome?: string;
  aceite_separador: boolean;
  aceite_solicitante: boolean;
  created_at: string;
  updated_at: string;
}

export interface SolicitacaoItem {
  id: string;
  solicitacao_id: string;
  item_id: string;
  quantidade_solicitada: number;
  quantidade_aprovada: number;
  item_snapshot: Partial<Item>;
  created_at: string;
}

export interface SolicitacaoCompleta extends Solicitacao {
  itens: SolicitacaoItem[];
}

export interface NovoItemSolicitacao {
  item_id: string;
  quantidade_solicitada: number;
  item_snapshot: Partial<Item>;
}

export interface NovaSolicitacao {
  observacoes?: string;
  local_utilizacao?: string;
  itens: NovoItemSolicitacao[];
}