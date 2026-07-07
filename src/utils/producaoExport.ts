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
  lancado: 'Pendente',
  conferido: 'Registrado',
  cancelado: 'Cancelado',
};

const valorOuIncompleto = (valor: number | null | undefined) =>
  valor === null || valor === undefined ? 'Custo incompleto' : valor;

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
      'Apontamentos pendentes': dados.total_apontamentos_lancados,
      'Apontamentos registrados': dados.total_apontamentos_conferidos,
      'Apontamentos cancelados': dados.total_apontamentos_cancelados,
      'Total de minutos': dados.total_minutos,
      'Horas-relógio': dados.horas_relogio,
      'Horas-homem': dados.horas_homem,
      'Horas produtivas': dados.horas_produtivas,
      'Horas improdutivas': dados.horas_improdutivas,
      Eficiência: `${dados.eficiencia_percentual}%`,
      'Custo total mão de obra': valorOuIncompleto(dados.custo_total_mao_obra),
      'Custo produtivo mão de obra': valorOuIncompleto(
        dados.custo_produtivo_mao_obra,
      ),
      'Custo improdutivo mão de obra': valorOuIncompleto(
        dados.custo_improdutivo_mao_obra,
      ),
      'Apontamentos com custo incompleto':
        dados.apontamentos_custo_incompleto,
      'Membros sem valor/hora': dados.membros_sem_valor_hora.join(', ') || '—',
      'Quantidade produzida': dados.quantidade_total_produzida,
      'Média de horas por apontamento': dados.media_horas_por_apontamento,
      'Pendentes de registro': dados.apontamentos_pendentes_conferencia,
    },
  ];
  XLSX.utils.book_append_sheet(
    workbook,
    criarPlanilha(resumo, Object.keys(resumo[0]), [
      22, 22, 24, 23, 18, 16, 16, 18, 20, 18, 24, 24, 26, 34, 22, 31, 25,
    ]),
    'Resumo',
  );

  const porProjeto = dados.por_projeto.map((item) => ({
    'Projeto/local': item.projeto_nome,
    Apontamentos: item.total_apontamentos,
    Minutos: item.total_minutos,
    Horas: item.total_horas,
    'Horas-homem': item.horas_homem,
    'Horas produtivas': item.horas_produtivas,
    'Horas improdutivas': item.horas_improdutivas,
    Eficiência: `${item.eficiencia_percentual}%`,
    'Custo total': valorOuIncompleto(item.custo_total),
    'Custo produtivo': valorOuIncompleto(item.custo_produtivo),
    'Custo improdutivo': valorOuIncompleto(item.custo_improdutivo),
    'Custo incompleto': item.custo_incompleto ? 'Sim' : 'Não',
    'Quantidade de fotos': item.quantidade_fotos,
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
        'Horas-homem',
        'Horas produtivas',
        'Horas improdutivas',
        'Eficiência',
        'Custo total',
        'Custo produtivo',
        'Custo improdutivo',
        'Custo incompleto',
        'Quantidade de fotos',
        'Quantidade produzida',
        'Membros distintos',
        'Status predominante',
        'Lançados',
        'Conferidos',
        'Cancelados',
      ],
      [34, 15, 14, 14, 16, 18, 20, 14, 18, 18, 20, 18, 22, 19, 22, 13, 13, 13],
    ),
    'Produção por Projeto',
  );

  const porTarefa = dados.por_tarefa.map((item) => ({
    Tarefa: item.tarefa_nome,
    Categoria: item.categoria ?? '—',
    Apontamentos: item.total_apontamentos,
    Minutos: item.total_minutos,
    Horas: item.total_horas,
    'Horas-homem': item.horas_homem,
    'Horas produtivas': item.horas_produtivas,
    'Horas improdutivas': item.horas_improdutivas,
    Eficiência: `${item.eficiencia_percentual}%`,
    'Custo total': valorOuIncompleto(item.custo_total),
    'Custo produtivo': valorOuIncompleto(item.custo_produtivo),
    'Custo improdutivo': valorOuIncompleto(item.custo_improdutivo),
    'Custo incompleto': item.custo_incompleto ? 'Sim' : 'Não',
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
        'Horas-homem',
        'Horas produtivas',
        'Horas improdutivas',
        'Eficiência',
        'Custo total',
        'Custo produtivo',
        'Custo improdutivo',
        'Custo incompleto',
        'Quantidade produzida',
      ],
      [36, 24, 15, 14, 14, 16, 18, 20, 14, 18, 18, 20, 22],
    ),
    'Produção por Tarefa',
  );

  const porMembro = dados.por_membro.map((item) => ({
    Membro: item.membro_nome,
    Apontamentos: item.total_apontamentos,
    Minutos: item.total_minutos,
    Horas: item.total_horas,
    'Horas produtivas': item.horas_produtivas,
    'Horas improdutivas': item.horas_improdutivas,
    Eficiência: `${item.eficiencia_percentual}%`,
    'Custo total': valorOuIncompleto(item.custo_total),
    'Custo produtivo': valorOuIncompleto(item.custo_produtivo),
    'Custo improdutivo': valorOuIncompleto(item.custo_improdutivo),
    'Custo incompleto': item.custo_incompleto ? 'Sim' : 'Não',
    'Valor/hora mínimo': item.valor_hora_minimo ?? '—',
    'Valor/hora máximo': item.valor_hora_maximo ?? '—',
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
        'Horas produtivas',
        'Horas improdutivas',
        'Eficiência',
        'Custo total',
        'Custo produtivo',
        'Custo improdutivo',
        'Custo incompleto',
        'Valor/hora mínimo',
        'Valor/hora máximo',
        'Projetos distintos',
        'Tarefas distintas',
      ],
      [34, 15, 14, 14, 18, 20, 14, 18, 18, 20, 18, 18, 18, 19, 18],
    ),
    'Produção por Membro',
  );

  const porLocal = dados.por_local_tipo.map((item) => ({
    'Local de execução': item.local_tipo,
    Apontamentos: item.total_apontamentos,
    Minutos: item.total_minutos,
    Horas: item.total_horas,
    'Horas-homem': item.horas_homem,
    'Horas produtivas': item.horas_produtivas,
    'Horas improdutivas': item.horas_improdutivas,
    Eficiência: `${item.eficiencia_percentual}%`,
    'Custo total': valorOuIncompleto(item.custo_total),
    'Custo produtivo': valorOuIncompleto(item.custo_produtivo),
    'Custo improdutivo': valorOuIncompleto(item.custo_improdutivo),
    'Custo incompleto': item.custo_incompleto ? 'Sim' : 'Não',
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
        'Horas-homem',
        'Horas produtivas',
        'Horas improdutivas',
        'Eficiência',
        'Custo total',
        'Custo produtivo',
        'Custo improdutivo',
        'Custo incompleto',
        'Quantidade produzida',
      ],
      [24, 15, 14, 14, 16, 18, 20, 14, 18, 18, 20, 22],
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
  fotosPorApontamento: Record<string, number> = {},
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
    'Minutos produtivos': item.minutos_produtivos,
    'Minutos improdutivos': item.minutos_improdutivos,
    Eficiência: `${item.duracao_minutos > 0 ? ((item.minutos_produtivos / item.duracao_minutos) * 100).toFixed(1) : '0'}%`,
    'Motivo da perda': item.motivo_improdutivo ?? '—',
    'Quantidade de fotos': fotosPorApontamento[item.id] ?? 0,
    'Quantidade produzida': item.quantidade_produzida ?? 0,
    Membros:
      membros[item.id]?.map((membro) => membro.nome_snapshot).join(', ') || '—',
    'Valores/hora históricos':
      membros[item.id]
        ?.map((membro) =>
          membro.valor_hora_snapshot === null
            ? `${membro.nome_snapshot}: não informado`
            : `${membro.nome_snapshot}: ${membro.valor_hora_snapshot}`,
        )
        .join(' | ') || '—',
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
        'Minutos produtivos',
        'Minutos improdutivos',
        'Eficiência',
        'Motivo da perda',
        'Quantidade de fotos',
        'Quantidade produzida',
        'Membros',
        'Valores/hora históricos',
        'Status',
        'Observações',
      ],
      [14, 34, 34, 20, 10, 10, 20, 18, 20, 22, 14, 36, 20, 22, 42, 50, 14, 50],
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
    'Valor da hora': membro.valor_hora ?? '—',
    Status: membro.ativo ? 'Ativo' : 'Inativo',
    'Criado em': formatarDataHora(membro.created_at),
  }));
  XLSX.utils.book_append_sheet(
    workbook,
    criarPlanilha(
      equipe,
      ['Nome', 'Apelido', 'Função', 'Valor da hora', 'Status', 'Criado em'],
      [36, 24, 28, 18, 14, 22],
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
