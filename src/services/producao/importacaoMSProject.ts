import { supabase } from '@/integrations/supabase/client';

/** Alimenta somente OPs exibidas pelo Gantt existente; não cria agenda paralela. */
export interface AtividadeMSProject {
  /** Identificador imutável da tarefa no arquivo .mpp; não é o EDT. */
  taskUid: string;
  edt: string;
  codigoPeca: string;
  nomePecaProject: string;
  projetoId: string;
  projetoNomeCompleto: string;
  etapa: 1 | 2 | 3 | 4 | 5;
  atividade: string;
  /** Grupo original da atividade no Project; usado ao cadastrar a tarefa no mesmo lote transacional. */
  categoriaAtividade: string;
  inicio: string;
  termino: string;
  duracaoHoras: number | null;
  quantidadePlanejada: number | null;
  /** Opcional: quando ausente, a RPC reutiliza ou cria a tarefa pelo nome no mesmo commit. */
  tarefaId?: string;
  equipePrevista: number | null;
  localTipo: 'Fábrica' | 'Execução';
}

export interface CadastroAtividadeMSP { nome: string; categoria: string; }
export interface ResultadoCadastroAtividadesMSP {
  criadas: Array<{ id: string; nome: string }>;
  reutilizadas: Array<{ id: string; nome: string }>;
  /** Nome normalizado da atividade -> id de producao_tarefas. */
  tarefaIdsPorNome: Record<string, string>;
}
export interface AcaoImportacaoMSP {
  origem: AtividadeMSProject;
  acao: 'manter_existente' | 'criar' | 'bloquear';
  motivo: string;
  etapaId?: string;
  opId?: string;
}
export interface SimulacaoImportacaoMSP {
  total: number;
  criar: number;
  manterExistente: number;
  bloqueadas: number;
  bloqueios: string[];
}

const str = (s: string) => s.trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toLowerCase();
const dataValida = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const etapaNome = (n: number) => `Etapa ${n}`;
const chaveOrigem = (v: AtividadeMSProject) => `MSP-v24 | Task UID ${v.taskUid.trim()} | EDT ${v.edt.trim()} | ${v.codigoPeca.trim()}`;
const chaveOrigemLegada = (v: AtividadeMSProject) => `MSP-v24 | EDT ${v.edt.trim()} | ${v.codigoPeca.trim()}`;
type RpcError = { message: string };
type RpcCall = (nome: string, argumentos: Record<string, unknown>) => Promise<{ data: unknown; error: RpcError | null }>;
const rpc = supabase.rpc as unknown as RpcCall;

/** Cadastra somente tarefas ausentes e devolve os IDs para preencher o lote. */
export async function cadastrarAtividadesProject(atividades: CadastroAtividadeMSP[]): Promise<ResultadoCadastroAtividadesMSP> {
  const { data: cadastradas, error } = await supabase.from('producao_tarefas').select('id,nome,ativo');
  if (error) throw new Error(`Não foi possível consultar tarefas existentes: ${error.message}`);

  const tarefaIdsPorNome: Record<string, string> = {};
  for (const tarefa of cadastradas ?? []) if (tarefa.ativo) tarefaIdsPorNome[str(tarefa.nome)] = tarefa.id;

  const criadas: ResultadoCadastroAtividadesMSP['criadas'] = [];
  const reutilizadas: ResultadoCadastroAtividadesMSP['reutilizadas'] = [];
  for (const atividade of atividades) {
    const nome = atividade.nome.trim();
    const categoria = atividade.categoria.trim();
    if (!nome || !categoria) throw new Error('Nome e categoria são obrigatórios para cadastrar atividades.');
    const chave = str(nome);
    const existente = tarefaIdsPorNome[chave];
    if (existente) { reutilizadas.push({ id: existente, nome }); continue; }

    const { data: id, error: erroCriacao } = await rpc(
      'criar_tarefa_producao', { p_nome: nome, p_categoria: categoria },
    );
    if (erroCriacao || typeof id !== 'string' || !id) throw new Error(`Falha ao cadastrar ${nome}: ${erroCriacao?.message ?? 'a RPC não retornou o identificador'}`);
    const tarefaId = id;
    tarefaIdsPorNome[chave] = tarefaId;
    criadas.push({ id: tarefaId, nome });
  }
  return { criadas, reutilizadas, tarefaIdsPorNome };
}

/** Resume a prévia para o Gantt, sem gravar dados. */
export function resumirSimulacaoImportacao(acoes: AcaoImportacaoMSP[]): SimulacaoImportacaoMSP {
  const bloqueios = acoes.filter(({ acao }) => acao === 'bloquear').map(({ motivo }) => motivo);
  return {
    total: acoes.length,
    criar: acoes.filter(({ acao }) => acao === 'criar').length,
    manterExistente: acoes.filter(({ acao }) => acao === 'manter_existente').length,
    bloqueadas: bloqueios.length,
    bloqueios: [...new Set(bloqueios)],
  };
}

/** Correspondência estrita: Task UID é a identidade; EDT é somente referência visual. */
export async function prepararConciliacaoProject(atividades: AtividadeMSProject[]): Promise<AcaoImportacaoMSP[]> {
  const ids = [...new Set(atividades.map(({ projetoId }) => projetoId).filter(Boolean))];
  if (!ids.length) return [];
  const [{ data: projetos, error: erroProjetos }, { data: etapas, error: erroEtapas }, { data: ops, error: erroOps }, { data: apontamentos, error: erroAPs }, { data: tarefas, error: erroTarefas }] = await Promise.all([
    supabase.from('producao_projetos').select('id,nome').in('id', ids),
    supabase.from('producao_processos').select('id,projeto_id,nome').in('projeto_id', ids),
    supabase.from('producao_ordens_producao').select('id,projeto_id,processo_id,tarefa_id,tarefa_nome_snapshot,descricao,instrucoes,status').in('projeto_id', ids),
    supabase.from('producao_apontamentos').select('id,ordem_producao_id').not('ordem_producao_id', 'is', null),
    supabase.from('producao_tarefas').select('id,nome,ativo'),
  ]);
  if (erroProjetos || erroEtapas || erroOps || erroAPs || erroTarefas) throw new Error('Não foi possível consultar projetos, etapas, tarefas, OPs e APs para a conciliação.');

  const resultado: AcaoImportacaoMSP[] = [];
  const taskUids = new Set<string>();
  for (const origem of atividades) {
    const base: AcaoImportacaoMSP = { origem, acao: 'bloquear', motivo: '' };
    const chaveTask = `${origem.projetoId}:${origem.taskUid.trim()}`;
    const projeto = projetos?.find(({ id }) => id === origem.projetoId);
    const etapa = etapas?.find((item) => item.projeto_id === origem.projetoId && str(item.nome) === str(etapaNome(origem.etapa)));
    if (!origem.taskUid.trim() || !/^[0-9]+$/.test(origem.taskUid.trim())) base.motivo = 'Task UID original do MS Project ausente ou inválido';
    else if (taskUids.has(chaveTask)) base.motivo = 'Task UID duplicado no lote para o mesmo projeto';
    else if (!projeto || projeto.nome.trim() !== origem.projetoNomeCompleto.trim()) base.motivo = 'Código e nome completo do projeto não conferem com o cadastro';
    else if (!etapa) base.motivo = 'Etapa ainda não cadastrada no projeto';
    else if (origem.tarefaId && !tarefas?.some((tarefa) => tarefa.id === origem.tarefaId && tarefa.ativo && str(tarefa.nome) === str(origem.atividade))) base.motivo = 'Identificação da atividade divergente do cadastro ativo';
    else if (!origem.atividade.trim() || !origem.categoriaAtividade.trim() || !origem.edt.trim() || !origem.codigoPeca.trim()) base.motivo = 'Identificação da atividade incompleta';
    else if (!dataValida(origem.inicio) || !dataValida(origem.termino) || origem.termino < origem.inicio) base.motivo = 'Datas originais inválidas';
    else if (!(origem.quantidadePlanejada != null && origem.quantidadePlanejada > 0) || !(origem.duracaoHoras != null && origem.duracaoHoras > 0) || !(origem.equipePrevista != null && origem.equipePrevista > 0)) base.motivo = 'Quantidade física, duração ou equipe sem valores confirmados';
    else {
      base.etapaId = etapa.id;
      const opExistente = ops?.find((op) => op.projeto_id === origem.projetoId && (op.instrucoes ?? '').startsWith(`${chaveOrigem(origem)} |`));
      const legado = ops?.find((op) => op.projeto_id === origem.projetoId && (op.instrucoes ?? '').startsWith(`${chaveOrigemLegada(origem)} |`));
      if (opExistente) {
        base.acao = 'manter_existente'; base.opId = opExistente.id; base.motivo = 'Task UID original já vinculada à OP';
      } else if (legado) {
        base.motivo = 'OP MSP legada sem Task UID; exigir conciliação manual para preservar histórico';
      } else {
        const candidatos = ops?.filter((op) => op.projeto_id === origem.projetoId && ((origem.tarefaId && op.tarefa_id === origem.tarefaId) || str(op.tarefa_nome_snapshot ?? op.descricao ?? '') === str(origem.atividade))) ?? [];
        const comApontamento = candidatos.some((op) => apontamentos?.some((apontamento) => apontamento.ordem_producao_id === op.id));
        if (candidatos.length) base.motivo = comApontamento ? 'OP correlata com APs existentes; preservar execução antes de qualquer associação' : 'OP correlata encontrada; conferir equivalência de escopo antes de criar';
        else { base.acao = 'criar'; base.motivo = 'Task UID sem OP correspondente'; }
      }
    }
    taskUids.add(chaveTask);
    resultado.push(base);
  }
  return resultado;
}

/** Executa todas as novas OPs em uma única RPC transacional. */
export async function executarImportacaoProject(acoes: AcaoImportacaoMSP[], confirmar: boolean) {
  if (!confirmar) throw new Error('A importação exige confirmação explícita do responsável pela Produção.');
  const bloqueadas = acoes.filter(({ acao }) => acao === 'bloquear');
  if (bloqueadas.length) throw new Error(`Há ${bloqueadas.length} correspondências pendentes. Importação não executada.`);
  const novas = acoes.filter(({ acao }) => acao === 'criar');
  if (!novas.length) return { criadas: 0, mantidas: acoes.filter(({ acao }) => acao === 'manter_existente').length };
  if (novas.some(({ etapaId }) => !etapaId)) throw new Error('Simulação incompleta: a etapa validada não foi preservada para a execução.');

  const p_atividades = novas.map(({ origem, etapaId }) => ({
    task_uid: origem.taskUid.trim(), edt: origem.edt.trim(), codigo_peca: origem.codigoPeca.trim(),
    projeto_id: origem.projetoId, nome_completo_sistema: origem.projetoNomeCompleto.trim(), etapa: origem.etapa,
    etapa_id: etapaId, nome_atividade: origem.atividade.trim(), categoria_atividade: origem.categoriaAtividade.trim(), inicio: origem.inicio,
    termino: origem.termino, quantidade_planejada: origem.quantidadePlanejada, duracao_horas: origem.duracaoHoras,
    equipe_prevista: origem.equipePrevista, local_tipo: origem.localTipo,
  }));
  const { data, error } = await rpc('importar_ops_msproject_v1', { p_atividades });
  if (error) throw new Error(`Falha atômica ao importar lote do MS Project: ${error.message}`);
  if (!data || typeof data !== 'object' || !('criadas' in data) || !('mantidas' in data)) throw new Error('A importação não retornou o resumo do lote.');
  return data as { criadas: number; mantidas: number };
}
