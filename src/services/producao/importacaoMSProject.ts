import { supabase } from '@/integrations/supabase/client';

/**
 * Serviço de conciliação do cronograma do Project com o cadastro atual.
 * Não cria Gantt nem altera a estrutura de telas. A importação deve ser acionada
 * explicitamente por uma sessão autenticada com permissão de Produção.
 *
 * Política: sem correspondência exata de projeto/etapa e sem quantidade física
 * conhecida, não se grava uma OP. Nunca deduzir quantidade de horas.
 */
export interface AtividadeMSProject {
  edt: string;
  codigoPeca: string;
  nomePecaProject: string;
  projetoId: string;
  projetoNomeCompleto: string;
  etapa: 1 | 2 | 3 | 4 | 5;
  atividade: string;
  inicio: string;
  termino: string;
  duracaoHoras: number;
  quantidadePlanejada: number;
  tarefaId: string;
  equipePrevista: number;
  localTipo: 'Fábrica' | 'Execução';
}
export interface AcaoImportacaoMSP {
  origem: AtividadeMSProject;
  acao: 'manter_existente' | 'criar' | 'bloquear';
  motivo: string;
  opId?: string;
}
const str = (s: string) => s.trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toLowerCase();
const dataValida = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v+'T00:00:00Z'));
const etapaNome = (n: number) => 'Etapa '+n;
const chaveOrigem = (v: AtividadeMSProject) => 'MSP-v24 | EDT '+v.edt+' | '+v.codigoPeca;

/**
 * Resolve correspondências sem fuzzy match. Project código/nome e projeto interno
 * são identificadores diferentes; a equivalência é explícita no projetoId.
 */
export async function prepararConciliacaoProject(atividades: AtividadeMSProject[]): Promise<AcaoImportacaoMSP[]> {
  const ids = [...new Set(atividades.map(a => a.projetoId))];
  if (!ids.length) return [];
  const [{data: projetos,error:erroProjetos},{data: etapas,error:erroEtapas},{data: ops,error:erroOps}] = await Promise.all([
    supabase.from('producao_projetos').select('id,nome').in('id',ids),
    supabase.from('producao_processos').select('id,projeto_id,nome').in('projeto_id',ids),
    supabase.from('producao_ordens_producao').select('id,projeto_id,processo_id,tarefa_nome_snapshot,descricao,instrucoes,status').in('projeto_id',ids),
  ]);
  if (erroProjetos || erroEtapas || erroOps) throw new Error('Não foi possível consultar projetos, etapas e OPs para a conciliação.');
  const resultado: AcaoImportacaoMSP[]=[];
  const chaves = new Set<string>();
  for (const a of atividades) {
    const base: AcaoImportacaoMSP={origem:a,acao:'bloquear',motivo:''};
    const projeto = projetos?.find(p => p.id===a.projetoId);
    const etapa = etapas?.find(e => e.projeto_id===a.projetoId && str(e.nome)===str(etapaNome(a.etapa)));
    if (!projeto || projeto.nome.trim()!==a.projetoNomeCompleto.trim()) base.motivo='Código e nome completo do projeto não conferem com o cadastro';
    else if (!etapa) base.motivo='Etapa ainda não cadastrada no projeto';
    else if (!a.tarefaId) base.motivo='Atividade não identificada no cadastro de tarefas';
    else if (!a.atividade.trim() || !a.edt.trim() || !a.codigoPeca.trim()) base.motivo='Identificação da atividade incompleta';
    else if (!dataValida(a.inicio) || !dataValida(a.termino) || a.termino<a.inicio) base.motivo='Datas inválidas';
    else if (!(a.quantidadePlanejada>0) || !(a.duracaoHoras>0) || !(a.equipePrevista>0)) base.motivo='Quantidade física, duração ou equipe sem valores confirmados';
    else {
      const opExistente = ops?.find(o => o.projeto_id===a.projetoId &&
        (o.instrucoes||'').includes(chaveOrigem(a)));
      if (opExistente) {base.acao='manter_existente';base.opId=opExistente.id;base.motivo='Atividade original já vinculada à OP';}
      else {
        // Similaridade de nome não permite criação automática: uma OP em execução
        // pode conter a atividade inteira ou parte dela, inclusive seus APs.
        const candidatos=ops?.filter(o=>o.projeto_id===a.projetoId &&
          o.processo_id===etapa.id && str(o.tarefa_nome_snapshot||o.descricao||'')===str(a.atividade))||[];
        if (candidatos.length) base.motivo='OP com atividade homônima já existe; conciliar APs sem duplicar';
        else if (chaves.has(a.projetoId+':'+a.edt)) base.motivo='EDT duplicado no lote';
        else {base.acao='criar';base.motivo='Atividade sem OP correspondente por EDT nem nome exato';}
      }
    }
    chaves.add(a.projetoId+':'+a.edt);
    resultado.push(base);
  }
  return resultado;
}

/**
 * A execução só aceita um lote integralmente conciliado. O RPC já existente
 * executa autorização por auth.uid(), validação de tarefas e integração PCP.
 * Bloqueios impedem gravar parcialmente uma programação ambígua.
 */
export async function executarImportacaoProject(acoes: AcaoImportacaoMSP[], confirmar: boolean) {
  if (!confirmar) throw new Error('A importação exige confirmação explícita do responsável pela Produção.');
  const bloqueadas=acoes.filter(a=>a.acao==='bloquear');
  if (bloqueadas.length) throw new Error('Há '+bloqueadas.length+' correspondências pendentes. Importação não executada.');
  const criadas: string[]=[];
  for (const {origem:a,acao} of acoes) {
    if (acao!=='criar') continue;
    const {data:etapa,error:erroEtapa}=await supabase.from('producao_processos')
      .select('id').eq('projeto_id',a.projetoId).eq('nome',etapaNome(a.etapa)).single();
    if (erroEtapa || !etapa) throw new Error('Etapa '+a.etapa+' não encontrada para '+a.projetoNomeCompleto);
    const {data,error}=await (supabase.rpc as any)('criar_ordem_producao_planejada_v1',{
      p_processo_id: etapa.id,p_tarefa_id:a.tarefaId,p_quantidade_planejada:a.quantidadePlanejada,
      p_local_tipo:a.localTipo,p_duracao_estimada_horas:a.duracaoHoras,
      p_equipe_prevista:a.equipePrevista,p_data_inicio_prevista:a.inicio,p_data_fim_prevista:a.termino,
      p_responsavel_id:null,p_responsavel_nome:null,
      p_instrucoes:chaveOrigem(a)+' | '+a.atividade+' | '+a.nomePecaProject,
      p_descricao:a.atividade,p_prioridade:'normal',
    });
    if (error) throw new Error('Falha ao cadastrar '+a.edt+': '+error.message+' ('+criadas.length+' OPs criadas antes da falha).');
    criadas.push(String(data));
  }
  return {criadas,existentes:acoes.filter(a=>a.acao==='manter_existente').length};
}
