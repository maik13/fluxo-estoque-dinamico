import * as XLSX from 'xlsx';
import type { LocalUtilizacaoConfig } from '@/hooks/useConfiguracoes';
import type {
  IndicadoresProducaoGerencial,
  ProducaoApontamento,
  ProducaoApontamentoMembro,
  ProducaoMaterialProjeto,
  ProducaoMembro,
  ProducaoStatus,
  ProducaoTarefa,
} from '@/types/producao';

type MembrosPorApontamento = Record<string, ProducaoApontamentoMembro[]>;

export type MaterialProducaoExportavel = ProducaoMaterialProjeto & {
  projeto_nome?: string;
};

const statusLabel: Record<ProducaoStatus, string> = {
  lancado: 'Lançado',
  conferido: 'Conferido',
  cancelado: 'Cancelado',
};

const dataArquivo = () => new Date().toISOString().slice(0, 10);

const objetoSnapshot = (snapshot: ProducaoMaterialProjeto['item_snapshot']) =>
  snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
    ? snapshot
    : {};

const nomeItem = (material: ProducaoMaterialProjeto) => {
  const snapshot = objetoSnapshot(material.item_snapshot);
  const nome = snapshot.nome ?? snapshot.name;
  return typeof nome === 'string' && nome.trim() ? nome : material.item_id;
};

const formatarDataHora = (valor: string) =>
  new Date(valor).toLocaleString('pt-BR');

const criarPlanilha = (
  linhas: Record<string, string | number | null>[],
  cabecalhos: string[],
  larguras: number[],
) => {
  const planilha =
    linhas.length > 0
      ? XLSX.utils.json_to_sheet(linhas, { header: cabecalhos })
      : XLSX.utils.aoa_to_sheet([cabecalhos]);
  planilha['!cols'] = larguras.map((wch) => ({ wch }));
  return planilha;
};

const adicionarInformacoes = (
  workbook: XLSX.WorkBook,
  nomeRelatorio: string,
  filtrosDescricao: string,
  observacao: string,
) => {
  const planilha = XLSX.utils.aoa_to_sheet([
    ['Nome do relatório', nomeRelatorio],
    ['Data/hora de geração', new Date().toLocaleString('pt-BR')],
    ['Filtros aplicados', filtrosDescricao || 'Sem filtros'],
    ['Observação', observacao],
  ]);
  planilha['!cols'] = [{ wch: 24 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(workbook, planilha, 'Informações');
};

export const exportarBIProducaoExcel = (
  dados: IndicadoresProducaoGerencial,
  filtrosDescricao: string,
) => {
  const workbook = XLSX.utils.book_new();
  const resumo = [
    {
      'Total de apontamentos': dados.total_apontamentos,
      'Apontamentos lançados': dados.total_apontamentos_lancados,
      'Apontamentos conferidos': dados.total_apontamentos_conferidos,
      'Apontamentos cancelados': dados.total_apontamentos_cancelados,
      'Total de minutos': dados.total_minutos,
      'Total de horas': dados.total_horas,
      'Quantidade produzida': dados.quantidade_total_produzida,
      'Média de horas por apontamento': dados.media_horas_por_apontamento,
      'Pendentes de conferência': dados.apontamentos_pendentes_conferencia,
    },
  ];
  XLSX.utils.book_append_sheet(
    workbook,
    criarPlanilha(resumo, Object.keys(resumo[0]), [
      22, 22, 24, 23, 18, 16, 22, 31, 25,
    ]),
    'Resumo',
  );

  const porProjeto = dados.por_projeto.map((item) => ({
    'Projeto/local': item.projeto_nome,
    Apontamentos: item.total_apontamentos,
    Minutos: item.total_minutos,
    Horas: item.total_horas,
    'Quantidade produzida': item.quantidade_total_produzida,
    'Membros distintos': item.total_membros_distintos,
    'Status predominante': item.status_predominante
      ? statusLabel[item.status_predominante]
      : '—',
    Lançados: item.distribuicao_status.lancado,
    Conferidos: item.distribuicao_status.conferido,
    Cancelados: item.distribuicao_status.cancelado,
  }));
  XLSX.utils.book_append_sheet(
    workbook,
    criarPlanilha(
      porProjeto,
      [
        'Projeto/local',
        'Apontamentos',
        'Minutos',
        'Horas',
        'Quantidade produzida',
        'Membros distintos',
        'Status predominante',
        'Lançados',
        'Conferidos',
        'Cancelados',
      ],
      [34, 15, 14, 14, 22, 19, 22, 13, 13, 13],
    ),
    'Produção por Projeto',
  );

  const porTarefa = dados.por_tarefa.map((item) => ({
    Tarefa: item.tarefa_nome,
    Categoria: item.categoria ?? '—',
    Apontamentos: item.total_apontamentos,
    Minutos: item.total_minutos,
    Horas: item.total_horas,
    'Quantidade produzida': item.quantidade_total_produzida,
  }));
  XLSX.utils.book_append_sheet(
    workbook,
    criarPlanilha(
      porTarefa,
      [
        'Tarefa',
        'Categoria',
        'Apontamentos',
        'Minutos',
        'Horas',
        'Quantidade produzida',
      ],
      [36, 24, 15, 14, 14, 22],
    ),
    'Produção por Tarefa',
  );

  const porMembro = dados.por_membro.map((item) => ({
    Membro: item.membro_nome,
    Apontamentos: item.total_apontamentos,
    Minutos: item.total_minutos,
    Horas: item.total_horas,
    'Projetos distintos': item.projetos_distintos,
    'Tarefas distintas': item.tarefas_distintas,
  }));
  XLSX.utils.book_append_sheet(
    workbook,
    criarPlanilha(
      porMembro,
      [
        'Membro',
        'Apontamentos',
        'Minutos',
        'Horas',
        'Projetos distintos',
        'Tarefas distintas',
      ],
      [34, 15, 14, 14, 19, 18],
    ),
    'Produção por Membro',
  );

  const porLocal = dados.por_local_tipo.map((item) => ({
    'Local de execução': item.local_tipo,
    Apontamentos: item.total_apontamentos,
    Minutos: item.total_minutos,
    Horas: item.total_horas,
    'Quantidade produzida': item.quantidade_total_produzida,
  }));
  XLSX.utils.book_append_sheet(
    workbook,
    criarPlanilha(
      porLocal,
      [
        'Local de execução',
        'Apontamentos',
        'Minutos',
        'Horas',
        'Quantidade produzida',
      ],
      [24, 15, 14, 14, 22],
    ),
    'Produção por Local de Execução',
  );

  const materiaisItem = dados.materiais.quantidade_por_item.map((item) => ({
    Item: item.item_nome,
    Quantidade: item.quantidade,
    'Movimentações vinculadas': item.total_movimentacoes,
  }));
  XLSX.utils.book_append_sheet(
    workbook,
    criarPlanilha(
      materiaisItem,
      ['Item', 'Quantidade', 'Movimentações vinculadas'],
      [44, 16, 26],
    ),
    'Materiais por Item',
  );

  const materiaisTipo = dados.materiais.quantidade_por_tipo_movimento.map(
    (item) => ({
      'Tipo de movimento': item.tipo,
      Quantidade: item.quantidade,
      'Movimentações vinculadas': item.total_movimentacoes,
    }),
  );
  XLSX.utils.book_append_sheet(
    workbook,
    criarPlanilha(
      materiaisTipo,
      ['Tipo de movimento', 'Quantidade', 'Movimentações vinculadas'],
      [28, 16, 26],
    ),
    'Materiais por Tipo',
  );

  adicionarInformacoes(
    workbook,
    'BI de Produção',
    filtrosDescricao,
    'Relatório de Produção. Esta exportação não movimenta estoque.',
  );
  XLSX.writeFile(workbook, `bi-producao-${dataArquivo()}.xlsx`);
};

export const exportarApontamentosProducaoExcel = (
  apontamentos: ProducaoApontamento[],
  tarefas: ProducaoTarefa[],
  locais: LocalUtilizacaoConfig[],
  membros: MembrosPorApontamento,
  filtrosDescricao: string,
) => {
  const tarefasPorId = new Map(tarefas.map((item) => [item.id, item.nome]));
  const locaisPorId = new Map(locais.map((item) => [item.id, item.nome]));
  const linhas = apontamentos.map((item) => ({
    Data: new Date(`${item.data}T12:00:00`).toLocaleDateString('pt-BR'),
    'Projeto/local':
      locaisPorId.get(item.projeto_local_id) ?? item.projeto_local_id,
    Tarefa: tarefasPorId.get(item.tarefa_id) ?? item.tarefa_id,
    'Local de execução': item.local_tipo,
    Início: item.inicio.slice(0, 5),
    Término: item.termino.slice(0, 5),
    'Duração em minutos': item.duracao_minutos,
    'Duração em horas': Number((item.duracao_minutos / 60).toFixed(2)),
    'Quantidade produzida': item.quantidade_produzida ?? 0,
    Membros:
      membros[item.id]?.map((membro) => membro.nome_snapshot).join(', ') || '—',
    Status: statusLabel[item.status],
    Observações: item.observacoes ?? '—',
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    criarPlanilha(
      linhas,
      [
        'Data',
        'Projeto/local',
        'Tarefa',
        'Local de execução',
        'Início',
        'Término',
        'Duração em minutos',
        'Duração em horas',
        'Quantidade produzida',
        'Membros',
        'Status',
        'Observações',
      ],
      [14, 34, 34, 20, 10, 10, 20, 18, 22, 42, 14, 50],
    ),
    'Apontamentos',
  );
  adicionarInformacoes(
    workbook,
    'Histórico de Apontamentos de Produção',
    filtrosDescricao,
    'Relatório de Produção. Esta exportação não movimenta estoque.',
  );
  XLSX.writeFile(
    workbook,
    `apontamentos-producao-${dataArquivo()}.xlsx`,
  );
};

export const exportarMateriaisProducaoExcel = (
  materiais: MaterialProducaoExportavel[],
  filtrosDescricao: string,
) => {
  const linhas = materiais.map((material) => ({
    'Projeto/local': material.projeto_nome ?? material.projeto_local_id,
    'Movimento oficial vinculado': material.movement_id,
    'Tipo de movimento': material.tipo,
    Item: nomeItem(material),
    Quantidade: material.quantidade,
    'Observações de produção': material.observacoes_producao ?? '—',
    'Data de vínculo': formatarDataHora(material.created_at),
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    criarPlanilha(
      linhas,
      [
        'Projeto/local',
        'Movimento oficial vinculado',
        'Tipo de movimento',
        'Item',
        'Quantidade',
        'Observações de produção',
        'Data de vínculo',
      ],
      [34, 38, 22, 44, 16, 50, 22],
    ),
    'Materiais da Produção',
  );
  adicionarInformacoes(
    workbook,
    'Materiais Vinculados à Produção',
    filtrosDescricao,
    'Materiais exibidos aqui são referências a movimentações oficiais já existentes. Esta exportação não altera estoque.',
  );
  XLSX.writeFile(workbook, `materiais-producao-${dataArquivo()}.xlsx`);
};

export const exportarCadastrosProducaoExcel = (
  membros: ProducaoMembro[],
  tarefas: ProducaoTarefa[],
) => {
  const workbook = XLSX.utils.book_new();
  const equipe = membros.map((membro) => ({
    Nome: membro.nome,
    Apelido: membro.apelido ?? '—',
    Função: membro.funcao ?? '—',
    Status: membro.ativo ? 'Ativo' : 'Inativo',
    'Criado em': formatarDataHora(membro.created_at),
  }));
  XLSX.utils.book_append_sheet(
    workbook,
    criarPlanilha(
      equipe,
      ['Nome', 'Apelido', 'Função', 'Status', 'Criado em'],
      [36, 24, 28, 14, 22],
    ),
    'Equipe de Produção',
  );

  const tarefasExportadas = tarefas.map((tarefa) => ({
    Nome: tarefa.nome,
    Categoria: tarefa.categoria ?? '—',
    Status: tarefa.ativo ? 'Ativa' : 'Inativa',
    'Criado em': formatarDataHora(tarefa.created_at),
  }));
  XLSX.utils.book_append_sheet(
    workbook,
    criarPlanilha(
      tarefasExportadas,
      ['Nome', 'Categoria', 'Status', 'Criado em'],
      [40, 28, 14, 22],
    ),
    'Tarefas de Produção',
  );
  adicionarInformacoes(
    workbook,
    'Cadastros da Produção',
    'Cadastros completos',
    'Relatório de Produção. Esta exportação não movimenta estoque.',
  );
  XLSX.writeFile(workbook, `cadastros-producao-${dataArquivo()}.xlsx`);
};

export const imprimirSecaoProducao = (elementoId: string) => {
  const elemento = document.getElementById(elementoId);
  if (!elemento) {
    window.print();
    return;
  }

  const limpar = () => {
    document.body.classList.remove('imprimir-producao');
    elemento.removeAttribute('data-producao-print-ativa');
  };

  document.body.classList.add('imprimir-producao');
  elemento.setAttribute('data-producao-print-ativa', 'true');
  window.addEventListener('afterprint', limpar, { once: true });
  window.print();
  limpar();
};
