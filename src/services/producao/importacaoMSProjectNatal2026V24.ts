import { loteImportacaoMSProjectNatal2026V24 } from '@/data/importacao-msproject-natal-2026-v24';
import { supabase } from '@/integrations/supabase/client';
import { notificarOrdensProducaoAlteradas } from '@/hooks/useOrdensProducao';

/**
 * Atividades cuja correspondência com uma OP já existente é apenas por
 * semelhança textual. Elas não entram no lote automático: uma OP genérica de
 * "Pintura" ou "Montagem" não prova que represente esta atividade específica
 * do Project. Todas têm apontamentos associados e exigem conciliação humana.
 */
export const taskUidsBloqueadosPorConciliacaoMSProjectNatal2026V24 = new Set([
  '7344', '7345', '7346', '7350', '7354', '7355', '7356',
  '7833', '7834', '7835', '7843', '7844', '7845',
]);

const loteImportavelMSProjectNatal2026V24 = loteImportacaoMSProjectNatal2026V24.filter(
  (atividade) => !taskUidsBloqueadosPorConciliacaoMSProjectNatal2026V24.has(atividade.taskUid),
);

export const resumoImportacaoMSProjectNatal2026V24 = {
  analisadas: loteImportacaoMSProjectNatal2026V24.length,
  aptas: loteImportavelMSProjectNatal2026V24.length,
  bloqueadasPorConciliacao: taskUidsBloqueadosPorConciliacaoMSProjectNatal2026V24.size,
  porEtapa: { etapa2: 122, etapa3: 42, etapa4: 76, etapa5: 39 },
} as const;

export interface ResultadoImportacaoMSProjectNatal2026V24 {
  criadas: number;
  mantidas: number;
  etapas_criadas: number;
  tarefas_criadas: number;
}

/**
 * A própria RPC exige uma sessão autenticada e permissão de Produção. O lote
 * completo é enviado uma única vez; o banco confirma ou reverte tudo.
 */
export async function importarMSProjectNatal2026V24(): Promise<ResultadoImportacaoMSProjectNatal2026V24> {
  const p_atividades = loteImportavelMSProjectNatal2026V24.map((atividade) => ({
    task_uid: atividade.taskUid,
    task_uid_peca: atividade.taskUidPeca,
    edt: atividade.edt,
    codigo_peca: atividade.codigoPeca,
    nome_peca_project: atividade.nomePecaProject,
    projeto_nome_completo: atividade.projetoNomeCompleto,
    etapa: atividade.etapa,
    atividade: atividade.atividade,
    categoria_atividade: atividade.categoriaAtividade,
    inicio: atividade.inicio,
    termino: atividade.termino,
    duracao_horas: atividade.duracaoHoras,
    duracao_horas_original: atividade.duracaoHorasOriginal,
    percentual_concluido_msp: atividade.percentualConcluidoMSP,
    local_tipo: atividade.localTipo,
  }));

  const { data, error } = await (supabase.rpc as any)(
    'importar_ops_reais_msproject_natal_v24',
    { p_atividades },
  );
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('A importação não retornou o resultado esperado.');
  notificarOrdensProducaoAlteradas();
  return data as ResultadoImportacaoMSProjectNatal2026V24;
}
