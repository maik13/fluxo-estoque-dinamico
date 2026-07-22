import type { Json } from '@/integrations/supabase/types';

export type ProducaoLocalTipo = 'Fábrica' | 'Execução';
export type ProducaoStatus = 'lancado' | 'conferido' | 'cancelado';
export type ProducaoProjetoStatus = 'ativo' | 'concluido' | 'cancelado';
export type ProducaoProcessoStatus = 'planejado' | 'em_andamento' | 'pausado' | 'finalizado' | 'cancelado';

export interface ProducaoTarefa {
  id: string;
  nome: string;
  categoria: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProducaoProjeto {
  id: string;
  nome: string;
  descricao: string | null;
  cliente_id: string | null;
  status: ProducaoProjetoStatus;
  cidade: string | null;
  estado: string | null;
  data_inicio_prevista: string | null;
  data_fim_prevista: string | null;
  criado_por_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProducaoProcesso {
  id: string;
  projeto_id: string;
  nome: string;
  descricao: string | null;
  status: ProducaoProcessoStatus;
  prioridade: number;
  data_inicio_prevista: string | null;
  data_fim_prevista: string | null;
  data_inicio_real: string | null;
  data_fim_real: string | null;
  criado_por_id: string | null;
  atualizado_por_id: string | null;
  atualizado_por_nome_snapshot: string | null;
  finalizado_por_id: string | null;
  finalizado_por_nome_snapshot: string | null;
  finalizado_em: string | null;
  created_at: string;
  updated_at: string;
  projeto?: { nome: string } | null;
}

export interface ProducaoProcessoEvento {
  id: string;
  processo_id: string;
  tipo_evento: string;
  status_anterior: ProducaoProcessoStatus | null;
  novo_status: ProducaoProcessoStatus | null;
  usuario_responsavel_id: string | null;
  nome_usuario_snapshot: string | null;
  justificativa: string | null;
  dados_adicionais: Json | null;
  created_at: string;
}

export interface ProducaoApontamento {
  id: string;
  data: string;
  projeto_local_id: string;
  processo_id: string | null;
  tarefa_id: string;
  local_tipo: ProducaoLocalTipo;
  quantidade_produzida: number | null;
  inicio: string;
  termino: string;
  duracao_minutos: number;
  minutos_produtivos: number;
  minutos_improdutivos: number;
  motivo_improdutivo: string | null;
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
  valor_hora_snapshot: number | null;
  created_at: string;
}

export interface ProducaoMembro {
  id: string;
  nome: string;
  apelido: string | null;
  funcao: string | null;
  valor_hora: number | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface NovoMembroProducao {
  nome: string;
  apelido?: string | null;
  funcao?: string | null;
  valor_hora?: number | null;
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
  minutos_produtivos?: number | null;
  minutos_improdutivos?: number | null;
  motivo_improdutivo?: string | null;
  observacoes?: string | null;
  membros_ids: string[];
}

export interface ResumoCustosProducao {
  horas_relogio: number;
  horas_homem: number;
  minutos_produtivos: number;
  minutos_improdutivos: number;
  horas_produtivas: number;
  horas_improdutivas: number;
  eficiencia_percentual: number;
  custo_total: number | null;
  custo_produtivo: number | null;
  custo_improdutivo: number | null;
  custo_incompleto: boolean;
  membros_sem_valor_hora: string[];
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
  horas_homem: number;
  horas_produtivas: number;
  horas_improdutivas: number;
  eficiencia_percentual: number;
  custo_total: number | null;
  custo_produtivo: number | null;
  custo_improdutivo: number | null;
  custo_incompleto: boolean;
  quantidade_fotos: number;
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
  horas_homem: number;
  horas_produtivas: number;
  horas_improdutivas: number;
  eficiencia_percentual: number;
  custo_total: number | null;
  custo_produtivo: number | null;
  custo_improdutivo: number | null;
  custo_incompleto: boolean;
  quantidade_total_produzida: number;
}

export interface IndicadorProducaoPorMembro {
  membro_id: string;
  membro_nome: string;
  total_apontamentos: number;
  total_minutos: number;
  total_horas: number;
  horas_produtivas: number;
  horas_improdutivas: number;
  eficiencia_percentual: number;
  custo_total: number | null;
  custo_produtivo: number | null;
  custo_improdutivo: number | null;
  custo_incompleto: boolean;
  valor_hora_minimo: number | null;
  valor_hora_maximo: number | null;
  projetos_distintos: number;
  tarefas_distintas: number;
}

export interface IndicadorProducaoPorLocalTipo {
  local_tipo: ProducaoLocalTipo;
  total_apontamentos: number;
  total_minutos: number;
  total_horas: number;
  horas_homem: number;
  horas_produtivas: number;
  horas_improdutivas: number;
  eficiencia_percentual: number;
  custo_total: number | null;
  custo_produtivo: number | null;
  custo_improdutivo: number | null;
  custo_incompleto: boolean;
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
  horas_relogio: number;
  horas_homem: number;
  horas_produtivas: number;
  horas_improdutivas: number;
  eficiencia_percentual: number;
  custo_total_mao_obra: number | null;
  custo_produtivo_mao_obra: number | null;
  custo_improdutivo_mao_obra: number | null;
  apontamentos_custo_incompleto: number;
  membros_sem_valor_hora: string[];
  quantidade_total_produzida: number;
  media_horas_por_apontamento: number;
  apontamentos_pendentes_conferencia: number;
  por_projeto: IndicadorProducaoPorProjeto[];
  por_tarefa: IndicadorProducaoPorTarefa[];
  por_membro: IndicadorProducaoPorMembro[];
  por_local_tipo: IndicadorProducaoPorLocalTipo[];
  materiais: IndicadorProducaoMateriais;
}
