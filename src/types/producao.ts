import type { Json } from '@/integrations/supabase/types';

export type ProducaoLocalTipo = 'Fábrica' | 'Execução';
export type ProducaoStatus = 'lancado' | 'conferido' | 'cancelado';
export type ProducaoProcessoStatus = 'planejado' | 'em_andamento' | 'pausado' | 'bloqueado' | 'finalizado' | 'cancelado';
export type ProducaoPrioridade = 'baixa' | 'normal' | 'alta' | 'urgente';
export type ProducaoMembroOrigem = 'solicitante' | 'producao' | 'legado_pendente';
export type ProducaoOrdemStatus = 'rascunho' | 'liberada' | 'em_execucao' | 'concluida' | 'cancelada';

export interface ProducaoTarefa { id: string; nome: string; categoria: string | null; ativo: boolean; created_at: string; updated_at: string; }
export interface ProducaoProjeto {
  id: string; config_id: string | null; local_utilizacao_id: string; group_id: string | null; grupo_nome: string | null;
  nome: string; descricao: string | null; cliente: string | null; cidade: string | null; uf: string | null;
  local_execucao: string | null; endereco_execucao: string | null; data_inicio_prevista: string | null; data_fim_prevista: string | null;
  responsavel_id: string | null; responsavel_nome_snapshot: string | null; observacoes: string | null; ativo: boolean; configurado: boolean;
  criado_por_id: string | null; criado_por_nome_snapshot: string | null; atualizado_por_id: string | null; atualizado_por_nome_snapshot: string | null;
  created_at: string; updated_at: string;
}
export interface ProducaoProcessoProjetoResumo { nome: string; cidade: string | null; uf: string | null; local_utilizacao_id: string | null; }
export interface ProducaoProcesso {
  id: string; codigo: string; projeto_id: string; nome: string; descricao: string | null; produto_entregavel: string | null;
  unidade_medida: string | null; quantidade_planejada: number | null; status: ProducaoProcessoStatus; prioridade: ProducaoPrioridade;
  responsavel_id: string | null; responsavel_nome_snapshot: string | null; data_inicio_desejada: string | null; data_limite: string | null;
  data_inicio_prevista: string | null; data_fim_prevista: string | null; data_inicio_real: string | null; data_fim_real: string | null;
  grupo_cronograma: string | null; sequencia: number; capacidade_diaria: number | null; pessoas_necessarias: number | null;
  aceita_producao_proporcional: boolean; motivo_pausa: string | null; motivo_bloqueio: string | null; motivo_cancelamento: string | null;
  observacoes: string | null; criado_por_id: string | null; criado_por_nome_snapshot: string | null; atualizado_por_id: string | null;
  atualizado_por_nome_snapshot: string | null; finalizado_por_id: string | null; finalizado_por_nome_snapshot: string | null;
  finalizado_em: string | null; cancelado_por_id: string | null; cancelado_por_nome_snapshot: string | null; cancelado_em: string | null;
  created_at: string; updated_at: string; projeto?: ProducaoProcessoProjetoResumo | null;
}
export interface ProducaoProcessoEvento {
  id: string; processo_id: string; tipo_evento: string; status_anterior: ProducaoProcessoStatus | null; novo_status: ProducaoProcessoStatus | null;
  usuario_responsavel_id: string | null; nome_usuario_snapshot: string; data_hora: string; justificativa: string | null;
  dados_complementares: Json | null; valores_anteriores: Json | null; valores_posteriores: Json | null;
}

export interface ProducaoOrdemProducao {
  id: string; numero: number; processo_id: string; projeto_id: string; processo_codigo: string; processo_nome: string;
  projeto_nome: string; projeto_cidade: string | null; projeto_uf: string | null; local_tipo: ProducaoLocalTipo;
  descricao: string | null; instrucoes: string | null; produto_entregavel: string | null; unidade_medida: string | null;
  quantidade_planejada: number; quantidade_realizada: number; percentual_realizado: number;
  data_inicio_prevista: string; data_fim_prevista: string; data_inicio_real: string | null; data_fim_real: string | null;
  responsavel_id: string | null; responsavel_nome_snapshot: string | null; equipe_prevista: number | null;
  prioridade: ProducaoPrioridade; status: ProducaoOrdemStatus; motivo_cancelamento: string | null;
  criado_por_id: string | null; criado_por_nome_snapshot: string | null; created_at: string; updated_at: string;
}

export interface NovaOrdemProducao {
  processo_id: string; quantidade_planejada: number; data_inicio_prevista: string; data_fim_prevista: string;
  local_tipo: ProducaoLocalTipo; responsavel_id?: string | null; responsavel_nome?: string | null;
  equipe_prevista?: number | null; instrucoes?: string | null; descricao?: string | null; prioridade?: ProducaoPrioridade;
}

export interface ProducaoApontamento {
  id: string; ordem_producao_id: string | null; data: string; projeto_local_id: string | null; processo_id: string | null;
  tarefa_id: string; local_tipo: ProducaoLocalTipo; quantidade_produzida: number | null; inicio: string; termino: string;
  duracao_minutos: number; minutos_produtivos: number; minutos_improdutivos: number; motivo_improdutivo: string | null;
  observacoes: string | null; status: ProducaoStatus; jornada_total_equipe_minutos_snapshot: number | null;
  criado_por_id: string | null; criado_por_nome_snapshot: string | null; ultima_edicao_por_id: string | null;
  ultima_edicao_por_nome_snapshot: string | null; ultima_edicao_em: string | null; conferido_por_id: string | null;
  conferido_por_nome_snapshot: string | null; conferido_em: string | null; cancelado_por_id: string | null;
  cancelado_por_nome_snapshot: string | null; cancelado_em: string | null; motivo_cancelamento: string | null;
  created_at: string; updated_at: string;
  processo?: (Pick<ProducaoProcesso, 'id' | 'codigo' | 'nome'> & { projeto?: ProducaoProcessoProjetoResumo | null }) | null;
  ordem?: Pick<ProducaoOrdemProducao, 'id' | 'numero' | 'status' | 'quantidade_planejada' | 'quantidade_realizada' | 'percentual_realizado'> | null;
}
export interface ProducaoApontamentoMembro {
  id: string; apontamento_id: string; membro_id: string; nome_snapshot: string; valor_hora_snapshot: number | null;
  jornada_diaria_minutos_snapshot: number | null; minutos_produtivos_snapshot: number | null; minutos_improdutivos_snapshot: number | null;
  created_at: string;
}
export interface ProducaoMembro {
  id: string; nome: string; nome_snapshot: string; solicitante_id: string | null; origem: ProducaoMembroOrigem;
  apelido: string | null; funcao: string | null; valor_hora: number | null; jornada_diaria_minutos: number | null;
  ativo: boolean; created_at: string; updated_at: string;
}
export interface NovoMembroProducao {
  nome: string; apelido?: string | null; funcao?: string | null; valor_hora?: number | null;
  jornada_diaria_minutos?: number | null; ativo?: boolean;
}
export interface ProducaoApontamentoAnexo { id: string; apontamento_id: string; file_path: string; file_name: string; mime_type: 'image/jpeg' | 'image/png' | 'image/webp'; size_bytes: number | null; uploaded_by: string | null; created_at: string; }
export interface NovoAnexoProducao { apontamento_id: string; file_path: string; file_name: string; mime_type: ProducaoApontamentoAnexo['mime_type']; size_bytes?: number | null; uploaded_by?: string | null; }
export interface ProducaoMaterialProjeto { id: string; movement_id: string | null; projeto_local_id: string | null; apontamento_id: string | null; tipo: string; item_id: string | null; quantidade: number; item_snapshot: Json; observacoes_producao: string | null; created_at: string; }
export interface NovoApontamentoProducao {
  data: string; ordem_producao_id?: string | null; projeto_local_id: string | null; processo_id?: string | null; tarefa_id: string;
  local_tipo: ProducaoLocalTipo; quantidade_produzida?: number | null; inicio: string; termino: string;
  minutos_produtivos?: number | null; minutos_improdutivos?: number | null; motivo_improdutivo?: string | null;
  observacoes?: string | null; membros_ids: string[];
}
export interface FiltrosProducao { data_inicio?: string; data_fim?: string; projeto_local_id?: string; processo_id?: string; ordem_producao_id?: string; tarefa_id?: string; status?: ProducaoStatus; local_tipo?: ProducaoLocalTipo; }
export interface FiltrosProducaoGerencial extends FiltrosProducao { membro_id?: string; }
export interface DistribuicaoStatusProducao { lancado: number; conferido: number; cancelado: number; }
export interface ResumoCustosProducao {
  horas_relogio: number; horas_homem: number; minutos_produtivos: number; minutos_improdutivos: number; horas_produtivas: number;
  horas_improdutivas: number; eficiencia_percentual: number; custo_total: number | null; custo_produtivo: number | null;
  custo_improdutivo: number | null; custo_incompleto: boolean; membros_sem_valor_hora: string[];
}
export interface IndicadorProducaoPorProjeto {
  projeto_local_id: string; projeto_nome: string; total_apontamentos: number; total_minutos: number; total_horas: number;
  horas_homem: number; horas_produtivas: number; horas_improdutivas: number; eficiencia_percentual: number; custo_total: number | null;
  custo_produtivo: number | null; custo_improdutivo: number | null; custo_incompleto: boolean; quantidade_fotos: number;
  quantidade_total_produzida: number; total_membros_distintos: number; status_predominante: ProducaoStatus | null;
  distribuicao_status: DistribuicaoStatusProducao;
}
export interface IndicadorProducaoPorTarefa {
  tarefa_id: string; tarefa_nome: string; categoria: string | null; total_apontamentos: number; total_minutos: number; total_horas: number;
  horas_homem: number; horas_produtivas: number; horas_improdutivas: number; eficiencia_percentual: number; custo_total: number | null;
  custo_produtivo: number | null; custo_improdutivo: number | null; custo_incompleto: boolean; quantidade_total_produzida: number;
}
export interface IndicadorProducaoPorMembro {
  membro_id: string; membro_nome: string; total_apontamentos: number; total_minutos: number; total_horas: number; horas_produtivas: number;
  horas_improdutivas: number; eficiencia_percentual: number; custo_total: number | null; custo_produtivo: number | null;
  custo_improdutivo: number | null; custo_incompleto: boolean; valor_hora_minimo: number | null; valor_hora_maximo: number | null;
  projetos_distintos: number; tarefas_distintas: number;
}
export interface IndicadorProducaoPorLocalTipo { local_tipo: ProducaoLocalTipo; total_apontamentos: number; total_minutos: number; total_horas: number; }
export interface JornadaProducaoGerencialLinha {
  membro_id: string; membro_nome: string; data: string; jornada_prevista_minutos: number | null; minutos_apontados: number;
  minutos_produtivos: number; minutos_improdutivos: number; minutos_sem_apontamento: number | null; minutos_extras: number | null;
  eficiencia_percentual: number; ocupacao_percentual: number | null; aproveitamento_percentual: number | null;
}

export interface IndicadorProducaoMateriais {
  total_movimentacoes_vinculadas: number;
  total_saida: number;
  total_entrada: number;
  itens_distintos: number;
  quantidade_por_item: Array<{ item_id: string; item_nome: string; quantidade: number; total_movimentacoes: number }>;
  quantidade_por_tipo_movimento: Array<{ tipo: string; quantidade: number; total_movimentacoes: number }>;
}

export interface IndicadorProducaoLocalTipoDetalhado extends IndicadorProducaoPorLocalTipo {
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
  por_local_tipo: IndicadorProducaoLocalTipoDetalhado[];
  materiais: IndicadorProducaoMateriais;
}
