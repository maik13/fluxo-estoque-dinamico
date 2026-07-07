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
  membro_id: string;
  nome_snapshot: string;
  created_at: string;
}

export interface ProducaoMembro {
  id: string;
  nome: string;
  apelido: string | null;
  funcao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface NovoMembroProducao {
  nome: string;
  apelido?: string | null;
  funcao?: string | null;
}

export interface ProducaoApontamentoAnexo {
  id: string;
  apontamento_id: string;
  file_path: string;
  file_name: string;
  mime_type: 'image/jpeg' | 'image/png' | 'image/webp';
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface NovoAnexoProducao {
  apontamento_id: string;
  file_path: string;
  file_name: string;
  mime_type: ProducaoApontamentoAnexo['mime_type'];
  size_bytes?: number | null;
  uploaded_by?: string | null;
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

export interface FiltrosProducaoGerencial extends FiltrosProducao {
  membro_id?: string;
}

export interface DistribuicaoStatusProducao {
  lancado: number;
  conferido: number;
  cancelado: number;
}

export interface IndicadorProducaoPorProjeto {
  projeto_local_id: string;
  projeto_nome: string;
  total_apontamentos: number;
  total_minutos: number;
  total_horas: number;
  quantidade_total_produzida: number;
  total_membros_distintos: number;
  status_predominante: ProducaoStatus | null;
  distribuicao_status: DistribuicaoStatusProducao;
}

export interface IndicadorProducaoPorTarefa {
  tarefa_id: string;
  tarefa_nome: string;
  categoria: string | null;
  total_apontamentos: number;
  total_minutos: number;
  total_horas: number;
  quantidade_total_produzida: number;
}

export interface IndicadorProducaoPorMembro {
  membro_id: string;
  membro_nome: string;
  total_apontamentos: number;
  total_minutos: number;
  total_horas: number;
  projetos_distintos: number;
  tarefas_distintas: number;
}

export interface IndicadorProducaoPorLocalTipo {
  local_tipo: ProducaoLocalTipo;
  total_apontamentos: number;
  total_minutos: number;
  total_horas: number;
  quantidade_total_produzida: number;
}

export interface IndicadorQuantidadeMaterialPorItem {
  item_id: string;
  item_nome: string;
  quantidade: number;
  total_movimentacoes: number;
}

export interface IndicadorQuantidadeMaterialPorTipo {
  tipo: string;
  quantidade: number;
  total_movimentacoes: number;
}

export interface IndicadorProducaoMateriais {
  total_movimentacoes_vinculadas: number;
  total_saida: number;
  total_entrada: number;
  itens_distintos: number;
  quantidade_por_item: IndicadorQuantidadeMaterialPorItem[];
  quantidade_por_tipo_movimento: IndicadorQuantidadeMaterialPorTipo[];
}

export interface IndicadoresProducaoGerencial {
  total_apontamentos: number;
  total_apontamentos_lancados: number;
  total_apontamentos_conferidos: number;
  total_apontamentos_cancelados: number;
  total_horas: number;
  total_minutos: number;
  quantidade_total_produzida: number;
  media_horas_por_apontamento: number;
  apontamentos_pendentes_conferencia: number;
  por_projeto: IndicadorProducaoPorProjeto[];
  por_tarefa: IndicadorProducaoPorTarefa[];
  por_membro: IndicadorProducaoPorMembro[];
  por_local_tipo: IndicadorProducaoPorLocalTipo[];
  materiais: IndicadorProducaoMateriais;
}
