import type { Json } from '@/integrations/supabase/types';

export type ProducaoLocalTipo = 'Fábrica' | 'Execução';
export type ProducaoStatus = 'lancado' | 'conferido' | 'cancelado';

export interface ProducaoTarefa {
  id: string;
  nome: string;
  categoria: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProducaoApontamento {
  id: string;
  data: string;
  projeto_local_id: string;
  tarefa_id: string;
  local_tipo: ProducaoLocalTipo;
  quantidade_produzida: number | null;
  inicio: string;
  termino: string;
  duracao_minutos: number;
  observacoes: string | null;
  status: ProducaoStatus;
  criado_por_id: string | null;
  conferido_por_id: string | null;
  conferido_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProducaoApontamentoMembro {
  id: string;
  apontamento_id: string;
  solicitante_id: string;
  nome_snapshot: string;
  created_at: string;
}

export interface ProducaoMaterialProjeto {
  id: string;
  movement_id: string;
  projeto_local_id: string;
  apontamento_id: string | null;
  tipo: string;
  item_id: string;
  quantidade: number;
  item_snapshot: Json;
  observacoes_producao: string | null;
  created_at: string;
}

export interface NovoApontamentoProducao {
  data: string;
  projeto_local_id: string;
  tarefa_id: string;
  local_tipo: ProducaoLocalTipo;
  quantidade_produzida?: number | null;
  inicio: string;
  termino: string;
  observacoes?: string | null;
  membros_ids: string[];
}

export interface FiltrosProducao {
  data_inicio?: string;
  data_fim?: string;
  projeto_local_id?: string;
  tarefa_id?: string;
  status?: ProducaoStatus;
  local_tipo?: ProducaoLocalTipo;
}
