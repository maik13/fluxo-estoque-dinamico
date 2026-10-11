export type TarefaMSProjectNormalizada = {
  uid_origem: number;
  uid_pai_origem: number | null;
  nivel_estrutura: number;
  caminho_estrutura: string[];
  nome: string;
  referencia_msproject: string | null;
  cidade_msproject: string | null;
  grupo_origem: string | null;
  inicio_planejado_original: string;
  fim_planejado_original: string;
  duracao_minutos_origem: number | null;
  marco: boolean;
  percentual_concluido_origem: number;
  inicio_real_origem: string | null;
  fim_real_origem: string | null;
  predecessoras_origem: unknown[];
  etapa_sugerida: 1 | 2 | 3 | 4 | 5 | null;
  justificativa_etapa_sugerida: string | null;
};

export type ArquivoMSProjectNormalizado = {
  schema_version: 1;
  arquivo_nome: string;
  versao_origem?: string | null;
  fuso_horario_origem?: string | null;
  inicio_planejado_original: string | null;
  fim_planejado_original: string | null;
  tarefas: TarefaMSProjectNormalizada[];
};

const dataValida = (valor: unknown): valor is string =>
  typeof valor === 'string' && !Number.isNaN(Date.parse(valor));

const textoOuNulo = (valor: unknown) =>
  typeof valor === 'string' && valor.trim() ? valor.trim() : null;

const inteiroOuNulo = (valor: unknown) =>
  typeof valor === 'number' && Number.isInteger(valor) ? valor : null;

const tarefaValida = (valor: unknown, indice: number): TarefaMSProjectNormalizada => {
  if (!valor || typeof valor !== 'object') {
    throw new Error(`Tarefa ${indice + 1} inválida.`);
  }

  const tarefa = valor as Record<string, unknown>;
  const uid = inteiroOuNulo(tarefa.uid_origem);
  const nivel = inteiroOuNulo(tarefa.nivel_estrutura);
  const inicio = tarefa.inicio_planejado_original;
  const fim = tarefa.fim_planejado_original;

  if (uid === null || uid < 1) throw new Error(`Tarefa ${indice + 1} sem UID válido.`);
  if (nivel === null || nivel < 0) throw new Error(`Tarefa ${uid} sem nível de estrutura válido.`);
  if (!textoOuNulo(tarefa.nome)) throw new Error(`Tarefa ${uid} sem nome.`);
  if (!dataValida(inicio) || !dataValida(fim) || Date.parse(fim) < Date.parse(inicio)) {
    throw new Error(`Tarefa ${uid} com período planejado inválido.`);
  }

  const etapa = inteiroOuNulo(tarefa.etapa_sugerida);
  if (etapa !== null && ![1, 2, 3, 4, 5].includes(etapa)) {
    throw new Error(`Tarefa ${uid} com etapa sugerida inválida.`);
  }

  return {
    uid_origem: uid,
    uid_pai_origem: inteiroOuNulo(tarefa.uid_pai_origem),
    nivel_estrutura: nivel,
    caminho_estrutura: Array.isArray(tarefa.caminho_estrutura)
      ? tarefa.caminho_estrutura.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
      : [],
    nome: textoOuNulo(tarefa.nome) as string,
    referencia_msproject: textoOuNulo(tarefa.referencia_msproject),
    cidade_msproject: textoOuNulo(tarefa.cidade_msproject),
    grupo_origem: textoOuNulo(tarefa.grupo_origem),
    inicio_planejado_original: inicio,
    fim_planejado_original: fim,
    duracao_minutos_origem: inteiroOuNulo(tarefa.duracao_minutos_origem),
    marco: tarefa.marco === true,
    percentual_concluido_origem:
      typeof tarefa.percentual_concluido_origem === 'number' && tarefa.percentual_concluido_origem >= 0 && tarefa.percentual_concluido_origem <= 100
        ? tarefa.percentual_concluido_origem
        : 0,
    inicio_real_origem: dataValida(tarefa.inicio_real_origem) ? tarefa.inicio_real_origem : null,
    fim_real_origem: dataValida(tarefa.fim_real_origem) ? tarefa.fim_real_origem : null,
    predecessoras_origem: Array.isArray(tarefa.predecessoras_origem) ? tarefa.predecessoras_origem : [],
    etapa_sugerida: etapa as 1 | 2 | 3 | 4 | 5 | null,
    justificativa_etapa_sugerida: textoOuNulo(tarefa.justificativa_etapa_sugerida),
  };
};

export const lerArquivoMSProjectNormalizado = async (arquivo: File): Promise<ArquivoMSProjectNormalizado> => {
  let bruto: unknown;
  try {
    bruto = JSON.parse(await arquivo.text());
  } catch {
    throw new Error('O arquivo de pré-importação do MS Project não é um JSON válido.');
  }

  if (!bruto || typeof bruto !== 'object') throw new Error('Estrutura de pré-importação inválida.');
  const documento = bruto as Record<string, unknown>;
  if (documento.schema_version !== 1) {
    throw new Error('Versão de pré-importação não suportada. Gere o arquivo a partir do extrator do Project.');
  }
  if (!Array.isArray(documento.tarefas) || documento.tarefas.length === 0) {
    throw new Error('O arquivo não contém tarefas para conciliar.');
  }

  const tarefas = documento.tarefas.map(tarefaValida);
  const uids = new Set<number>();
  tarefas.forEach((tarefa) => {
    if (uids.has(tarefa.uid_origem)) throw new Error(`UID ${tarefa.uid_origem} duplicado no arquivo.`);
    uids.add(tarefa.uid_origem);
  });

  const inicio = dataValida(documento.inicio_planejado_original)
    ? documento.inicio_planejado_original
    : null;
  const fim = dataValida(documento.fim_planejado_original)
    ? documento.fim_planejado_original
    : null;

  return {
    schema_version: 1,
    arquivo_nome: textoOuNulo(documento.arquivo_nome) ?? arquivo.name,
    versao_origem: textoOuNulo(documento.versao_origem),
    fuso_horario_origem: textoOuNulo(documento.fuso_horario_origem) ?? 'America/Sao_Paulo',
    inicio_planejado_original: inicio,
    fim_planejado_original: fim,
    tarefas,
  };
};

export const calcularHashSha256 = async (arquivo: File) => {
  const digest = await crypto.subtle.digest('SHA-256', await arquivo.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};
