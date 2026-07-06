import * as XLSX from 'xlsx';

export interface MembroProducaoImportacao {
  nome: string;
  apelido: string | null;
  funcao: string | null;
}

export interface TarefaProducaoImportacao {
  nome: string;
  categoria: string | null;
}

export interface ResultadoLeituraCadastrosProducao {
  arquivo_nome: string;
  membros: MembroProducaoImportacao[];
  tarefas: TarefaProducaoImportacao[];
  avisos: string[];
}

const TAMANHO_MAXIMO_ARQUIVO = 5 * 1024 * 1024;

export const normalizarNomeCadastro = (valor: string) =>
  valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR');

const texto = (valor: unknown) => {
  if (valor === null || valor === undefined) return '';
  const resultado = String(valor).trim();
  return resultado === '—' ? '' : resultado;
};

const chave = (valor: string) => normalizarNomeCadastro(valor);

const valorColuna = (
  linha: Record<string, unknown>,
  nomes: string[],
) => {
  const aliases = new Set(nomes.map(chave));
  const entrada = Object.entries(linha).find(([nome]) =>
    aliases.has(chave(nome)),
  );
  return texto(entrada?.[1]);
};

const encontrarAba = (workbook: XLSX.WorkBook, nomes: string[]) => {
  const aliases = new Set(nomes.map(chave));
  const nomeEncontrado = workbook.SheetNames.find((nome) =>
    aliases.has(chave(nome)),
  );
  return nomeEncontrado ? workbook.Sheets[nomeEncontrado] : undefined;
};

const lerLinhas = (planilha: XLSX.WorkSheet | undefined) =>
  planilha
    ? XLSX.utils.sheet_to_json<Record<string, unknown>>(planilha, {
        defval: '',
        raw: false,
      })
    : [];

const linhaInativa = (linha: Record<string, unknown>) => {
  const status = normalizarNomeCadastro(
    valorColuna(linha, ['Status', 'Situação', 'Situacao']),
  );
  return status === 'inativo' || status === 'inativa';
};

export const lerCadastrosProducaoExcel = async (
  arquivo: File,
): Promise<ResultadoLeituraCadastrosProducao> => {
  if (arquivo.size <= 0) throw new Error('O arquivo selecionado está vazio.');
  if (arquivo.size > TAMANHO_MAXIMO_ARQUIVO) {
    throw new Error('A planilha deve ter no máximo 5 MB.');
  }

  const extensao = arquivo.name.split('.').pop()?.toLocaleLowerCase('pt-BR');
  if (extensao !== 'xlsx' && extensao !== 'xls') {
    throw new Error('Selecione uma planilha Excel no formato XLSX ou XLS.');
  }

  const workbook = XLSX.read(await arquivo.arrayBuffer(), {
    type: 'array',
    cellDates: true,
  });
  const abaEquipe = encontrarAba(workbook, [
    'Equipe de Produção',
    'Equipe',
    'Membros',
    'Membros da Equipe',
  ]);
  const abaTarefas = encontrarAba(workbook, [
    'Tarefas de Produção',
    'Tarefas',
  ]);

  if (!abaEquipe && !abaTarefas) {
    throw new Error(
      'A planilha precisa ter uma aba “Equipe de Produção” e/ou “Tarefas de Produção”.',
    );
  }

  const avisos: string[] = [];
  const membros: MembroProducaoImportacao[] = [];
  const tarefas: TarefaProducaoImportacao[] = [];
  const nomesMembros = new Set<string>();
  const nomesTarefas = new Set<string>();

  lerLinhas(abaEquipe).forEach((linha, indice) => {
    const nome = valorColuna(linha, ['Nome', 'Membro']);
    if (!nome) {
      avisos.push(`Equipe, linha ${indice + 2}: nome vazio; linha ignorada.`);
      return;
    }
    if (linhaInativa(linha)) {
      avisos.push(
        `Equipe, linha ${indice + 2}: “${nome}” está inativo e foi ignorado.`,
      );
      return;
    }

    const nomeNormalizado = normalizarNomeCadastro(nome);
    if (nomesMembros.has(nomeNormalizado)) {
      avisos.push(
        `Equipe, linha ${indice + 2}: “${nome}” está duplicado na planilha.`,
      );
      return;
    }
    nomesMembros.add(nomeNormalizado);
    membros.push({
      nome,
      apelido: valorColuna(linha, ['Apelido']) || null,
      funcao: valorColuna(linha, ['Função', 'Funcao', 'Cargo']) || null,
    });
  });

  lerLinhas(abaTarefas).forEach((linha, indice) => {
    const nome = valorColuna(linha, ['Nome', 'Tarefa']);
    if (!nome) {
      avisos.push(`Tarefas, linha ${indice + 2}: nome vazio; linha ignorada.`);
      return;
    }
    if (linhaInativa(linha)) {
      avisos.push(
        `Tarefas, linha ${indice + 2}: “${nome}” está inativa e foi ignorada.`,
      );
      return;
    }

    const nomeNormalizado = normalizarNomeCadastro(nome);
    if (nomesTarefas.has(nomeNormalizado)) {
      avisos.push(
        `Tarefas, linha ${indice + 2}: “${nome}” está duplicada na planilha.`,
      );
      return;
    }
    nomesTarefas.add(nomeNormalizado);
    tarefas.push({
      nome,
      categoria: valorColuna(linha, ['Categoria']) || null,
    });
  });

  if (membros.length === 0 && tarefas.length === 0) {
    throw new Error('Nenhum cadastro ativo e válido foi encontrado na planilha.');
  }

  return {
    arquivo_nome: arquivo.name,
    membros,
    tarefas,
    avisos,
  };
};
