import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type {
  DistribuicaoStatusProducao,
  FiltrosProducaoGerencial,
  IndicadoresProducaoGerencial,
  IndicadorProducaoMateriais,
  IndicadorProducaoPorLocalTipo,
  IndicadorProducaoPorMembro,
  IndicadorProducaoPorProjeto,
  IndicadorProducaoPorTarefa,
  ProducaoLocalTipo,
  ProducaoStatus,
} from '@/types/producao';

type ApontamentoRow =
  Database['public']['Tables']['producao_apontamentos']['Row'];
type ApontamentoMembroRow =
  Database['public']['Tables']['producao_apontamento_membros']['Row'];
type MembroRow = Database['public']['Tables']['producao_membros']['Row'];
type TarefaRow = Database['public']['Tables']['producao_tarefas']['Row'];
type MaterialRow =
  Database['public']['Tables']['producao_materiais_projeto']['Row'];
type LocalRow = Database['public']['Tables']['locais_utilizacao']['Row'];

const FILTROS_INICIAIS: FiltrosProducaoGerencial = {};

const distribuicaoVazia = (): DistribuicaoStatusProducao => ({
  lancado: 0,
  conferido: 0,
  cancelado: 0,
});

const dadosIniciais = (): IndicadoresProducaoGerencial => ({
  total_apontamentos: 0,
  total_apontamentos_lancados: 0,
  total_apontamentos_conferidos: 0,
  total_apontamentos_cancelados: 0,
  total_horas: 0,
  total_minutos: 0,
  quantidade_total_produzida: 0,
  media_horas_por_apontamento: 0,
  apontamentos_pendentes_conferencia: 0,
  por_projeto: [],
  por_tarefa: [],
  por_membro: [],
  por_local_tipo: [
    {
      local_tipo: 'Fábrica',
      total_apontamentos: 0,
      total_minutos: 0,
      total_horas: 0,
      quantidade_total_produzida: 0,
    },
    {
      local_tipo: 'Execução',
      total_apontamentos: 0,
      total_minutos: 0,
      total_horas: 0,
      quantidade_total_produzida: 0,
    },
  ],
  materiais: {
    total_movimentacoes_vinculadas: 0,
    total_saida: 0,
    total_entrada: 0,
    itens_distintos: 0,
    quantidade_por_item: [],
    quantidade_por_tipo_movimento: [],
  },
});

const minutosParaHoras = (minutos: number) =>
  Number((minutos / 60).toFixed(2));

const quantidadeProduzida = (apontamento: ApontamentoRow) =>
  apontamento.quantidade_produzida ?? 0;

const statusValido = (status: string): status is ProducaoStatus =>
  status === 'lancado' || status === 'conferido' || status === 'cancelado';

const somarStatus = (
  distribuicao: DistribuicaoStatusProducao,
  status: string,
) => {
  if (statusValido(status)) distribuicao[status] += 1;
};

const statusPredominante = (
  distribuicao: DistribuicaoStatusProducao,
): ProducaoStatus | null => {
  const entradas = Object.entries(distribuicao) as [
    ProducaoStatus,
    number,
  ][];
  const maior = entradas.reduce<
    [ProducaoStatus, number] | null
  >(
    (atual, entrada) =>
      !atual || entrada[1] > atual[1] ? entrada : atual,
    null,
  );

  return maior && maior[1] > 0 ? maior[0] : null;
};

const nomeItemSnapshot = (snapshot: MaterialRow['item_snapshot']) => {
  if (
    snapshot &&
    typeof snapshot === 'object' &&
    !Array.isArray(snapshot) &&
    typeof snapshot.nome === 'string' &&
    snapshot.nome.trim()
  ) {
    return snapshot.nome;
  }

  return null;
};

const consolidarMateriais = (
  materiais: MaterialRow[],
): IndicadorProducaoMateriais => {
  const porItem = new Map<
    string,
    { item_nome: string; quantidade: number; total_movimentacoes: number }
  >();
  const porTipo = new Map<
    string,
    { quantidade: number; total_movimentacoes: number }
  >();
  let totalSaida = 0;
  let totalEntrada = 0;

  materiais.forEach((material) => {
    const quantidade = material.quantidade ?? 0;
    const tipo = material.tipo || 'Não informado';
    const tipoNormalizado = tipo.trim().toLocaleUpperCase('pt-BR');
    const itemAtual = porItem.get(material.item_id) ?? {
      item_nome: nomeItemSnapshot(material.item_snapshot) ?? material.item_id,
      quantidade: 0,
      total_movimentacoes: 0,
    };
    itemAtual.quantidade += quantidade;
    itemAtual.total_movimentacoes += 1;
    porItem.set(material.item_id, itemAtual);

    const tipoAtual = porTipo.get(tipo) ?? {
      quantidade: 0,
      total_movimentacoes: 0,
    };
    tipoAtual.quantidade += quantidade;
    tipoAtual.total_movimentacoes += 1;
    porTipo.set(tipo, tipoAtual);

    if (tipoNormalizado === 'SAIDA' || tipoNormalizado === 'SAÍDA') {
      totalSaida += quantidade;
    }
    if (tipoNormalizado === 'ENTRADA') {
      totalEntrada += quantidade;
    }
  });

  return {
    total_movimentacoes_vinculadas: materiais.length,
    total_saida: totalSaida,
    total_entrada: totalEntrada,
    itens_distintos: porItem.size,
    quantidade_por_item: [...porItem.entries()]
      .map(([item_id, valor]) => ({ item_id, ...valor }))
      .sort((a, b) => b.quantidade - a.quantidade),
    quantidade_por_tipo_movimento: [...porTipo.entries()]
      .map(([tipo, valor]) => ({ tipo, ...valor }))
      .sort((a, b) => b.quantidade - a.quantidade),
  };
};

const consolidarIndicadores = ({
  apontamentos,
  vinculosMembros,
  membros,
  tarefas,
  locais,
  materiais,
}: {
  apontamentos: ApontamentoRow[];
  vinculosMembros: ApontamentoMembroRow[];
  membros: MembroRow[];
  tarefas: TarefaRow[];
  locais: LocalRow[];
  materiais: MaterialRow[];
}): IndicadoresProducaoGerencial => {
  const produtivos = apontamentos.filter(
    (apontamento) => apontamento.status !== 'cancelado',
  );
  const idsProdutivos = new Set(produtivos.map((item) => item.id));
  const vinculosProdutivos = vinculosMembros.filter((vinculo) =>
    idsProdutivos.has(vinculo.apontamento_id),
  );
  const apontamentosPorId = new Map(
    produtivos.map((apontamento) => [apontamento.id, apontamento]),
  );
  const locaisPorId = new Map(locais.map((local) => [local.id, local.nome]));
  const tarefasPorId = new Map(tarefas.map((tarefa) => [tarefa.id, tarefa]));
  const membrosPorId = new Map(membros.map((membro) => [membro.id, membro]));
  const membrosPorApontamento = new Map<string, Set<string>>();

  vinculosProdutivos.forEach((vinculo) => {
    const ids = membrosPorApontamento.get(vinculo.apontamento_id) ?? new Set();
    ids.add(vinculo.membro_id);
    membrosPorApontamento.set(vinculo.apontamento_id, ids);
  });

  const totalLancados = apontamentos.filter(
    (item) => item.status === 'lancado',
  ).length;
  const totalConferidos = apontamentos.filter(
    (item) => item.status === 'conferido',
  ).length;
  const totalCancelados = apontamentos.filter(
    (item) => item.status === 'cancelado',
  ).length;
  const totalMinutos = produtivos.reduce(
    (soma, item) => soma + item.duracao_minutos,
    0,
  );
  const quantidadeTotal = produtivos.reduce(
    (soma, item) => soma + quantidadeProduzida(item),
    0,
  );

  const projetos = new Map<
    string,
    {
      total_apontamentos: number;
      total_minutos: number;
      quantidade_total_produzida: number;
      membros: Set<string>;
      distribuicao_status: DistribuicaoStatusProducao;
    }
  >();

  apontamentos.forEach((apontamento) => {
    const atual = projetos.get(apontamento.projeto_local_id) ?? {
      total_apontamentos: 0,
      total_minutos: 0,
      quantidade_total_produzida: 0,
      membros: new Set<string>(),
      distribuicao_status: distribuicaoVazia(),
    };
    somarStatus(atual.distribuicao_status, apontamento.status);

    if (apontamento.status !== 'cancelado') {
      atual.total_apontamentos += 1;
      atual.total_minutos += apontamento.duracao_minutos;
      atual.quantidade_total_produzida += quantidadeProduzida(apontamento);
      membrosPorApontamento
        .get(apontamento.id)
        ?.forEach((membroId) => atual.membros.add(membroId));
    }
    projetos.set(apontamento.projeto_local_id, atual);
  });

  const porProjeto: IndicadorProducaoPorProjeto[] = [...projetos.entries()]
    .map(([projeto_local_id, valor]) => ({
      projeto_local_id,
      projeto_nome: locaisPorId.get(projeto_local_id) ?? 'Projeto não encontrado',
      total_apontamentos: valor.total_apontamentos,
      total_minutos: valor.total_minutos,
      total_horas: minutosParaHoras(valor.total_minutos),
      quantidade_total_produzida: valor.quantidade_total_produzida,
      total_membros_distintos: valor.membros.size,
      status_predominante: statusPredominante(valor.distribuicao_status),
      distribuicao_status: valor.distribuicao_status,
    }))
    .sort((a, b) => b.total_minutos - a.total_minutos);

  const tarefasConsolidadas = new Map<
    string,
    {
      total_apontamentos: number;
      total_minutos: number;
      quantidade_total_produzida: number;
    }
  >();
  produtivos.forEach((apontamento) => {
    const atual = tarefasConsolidadas.get(apontamento.tarefa_id) ?? {
      total_apontamentos: 0,
      total_minutos: 0,
      quantidade_total_produzida: 0,
    };
    atual.total_apontamentos += 1;
    atual.total_minutos += apontamento.duracao_minutos;
    atual.quantidade_total_produzida += quantidadeProduzida(apontamento);
    tarefasConsolidadas.set(apontamento.tarefa_id, atual);
  });

  const porTarefa: IndicadorProducaoPorTarefa[] = [
    ...tarefasConsolidadas.entries(),
  ]
    .map(([tarefa_id, valor]) => {
      const tarefa = tarefasPorId.get(tarefa_id);
      return {
        tarefa_id,
        tarefa_nome: tarefa?.nome ?? 'Tarefa não encontrada',
        categoria: tarefa?.categoria ?? null,
        total_apontamentos: valor.total_apontamentos,
        total_minutos: valor.total_minutos,
        total_horas: minutosParaHoras(valor.total_minutos),
        quantidade_total_produzida: valor.quantidade_total_produzida,
      };
    })
    .sort((a, b) => b.total_minutos - a.total_minutos);

  const membrosConsolidados = new Map<
    string,
    {
      nome_snapshot: string;
      apontamentos: Set<string>;
      total_minutos: number;
      projetos: Set<string>;
      tarefas: Set<string>;
    }
  >();
  vinculosProdutivos.forEach((vinculo) => {
    const apontamento = apontamentosPorId.get(vinculo.apontamento_id);
    if (!apontamento) return;

    const atual = membrosConsolidados.get(vinculo.membro_id) ?? {
      nome_snapshot: vinculo.nome_snapshot,
      apontamentos: new Set<string>(),
      total_minutos: 0,
      projetos: new Set<string>(),
      tarefas: new Set<string>(),
    };

    if (!atual.apontamentos.has(apontamento.id)) {
      atual.apontamentos.add(apontamento.id);
      atual.total_minutos += apontamento.duracao_minutos;
      atual.projetos.add(apontamento.projeto_local_id);
      atual.tarefas.add(apontamento.tarefa_id);
    }
    membrosConsolidados.set(vinculo.membro_id, atual);
  });

  const porMembro: IndicadorProducaoPorMembro[] = [
    ...membrosConsolidados.entries(),
  ]
    .map(([membro_id, valor]) => ({
      membro_id,
      membro_nome:
        membrosPorId.get(membro_id)?.nome ?? valor.nome_snapshot,
      total_apontamentos: valor.apontamentos.size,
      total_minutos: valor.total_minutos,
      total_horas: minutosParaHoras(valor.total_minutos),
      projetos_distintos: valor.projetos.size,
      tarefas_distintas: valor.tarefas.size,
    }))
    .sort((a, b) => b.total_minutos - a.total_minutos);

  const porLocalTipo: IndicadorProducaoPorLocalTipo[] = (
    ['Fábrica', 'Execução'] as ProducaoLocalTipo[]
  ).map((local_tipo) => {
    const registros = produtivos.filter(
      (apontamento) => apontamento.local_tipo === local_tipo,
    );
    const minutos = registros.reduce(
      (soma, apontamento) => soma + apontamento.duracao_minutos,
      0,
    );
    return {
      local_tipo,
      total_apontamentos: registros.length,
      total_minutos: minutos,
      total_horas: minutosParaHoras(minutos),
      quantidade_total_produzida: registros.reduce(
        (soma, apontamento) => soma + quantidadeProduzida(apontamento),
        0,
      ),
    };
  });

  return {
    total_apontamentos: apontamentos.length,
    total_apontamentos_lancados: totalLancados,
    total_apontamentos_conferidos: totalConferidos,
    total_apontamentos_cancelados: totalCancelados,
    total_horas: minutosParaHoras(totalMinutos),
    total_minutos: totalMinutos,
    quantidade_total_produzida: quantidadeTotal,
    media_horas_por_apontamento:
      produtivos.length > 0
        ? minutosParaHoras(totalMinutos / produtivos.length)
        : 0,
    apontamentos_pendentes_conferencia: totalLancados,
    por_projeto: porProjeto,
    por_tarefa: porTarefa,
    por_membro: porMembro,
    por_local_tipo: porLocalTipo,
    materiais: consolidarMateriais(materiais),
  };
};

export const useProducaoGerencial = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] =
    useState<FiltrosProducaoGerencial>(FILTROS_INICIAIS);
  const [dadosConsolidados, setDadosConsolidados] =
    useState<IndicadoresProducaoGerencial>(dadosIniciais);

  const carregarIndicadores = useCallback(
    async (novosFiltros: FiltrosProducaoGerencial = {}) => {
      setLoading(true);
      setError(null);
      setFiltros(novosFiltros);

      try {
        let consultaApontamentos = supabase
          .from('producao_apontamentos')
          .select('*');
        let consultaMateriais = supabase
          .from('producao_materiais_projeto')
          .select('*');
        // O snapshot satélite já contém os dados necessários dos materiais.
        // public.movements não é consultada nem alterada por este hook.

        if (novosFiltros.data_inicio) {
          consultaApontamentos = consultaApontamentos.gte(
            'data',
            novosFiltros.data_inicio,
          );
        }
        if (novosFiltros.data_fim) {
          consultaApontamentos = consultaApontamentos.lte(
            'data',
            novosFiltros.data_fim,
          );
        }
        if (novosFiltros.projeto_local_id) {
          consultaApontamentos = consultaApontamentos.eq(
            'projeto_local_id',
            novosFiltros.projeto_local_id,
          );
          consultaMateriais = consultaMateriais.eq(
            'projeto_local_id',
            novosFiltros.projeto_local_id,
          );
        }
        if (novosFiltros.tarefa_id) {
          consultaApontamentos = consultaApontamentos.eq(
            'tarefa_id',
            novosFiltros.tarefa_id,
          );
        }
        if (novosFiltros.status) {
          consultaApontamentos = consultaApontamentos.eq(
            'status',
            novosFiltros.status,
          );
        }
        if (novosFiltros.local_tipo) {
          consultaApontamentos = consultaApontamentos.eq(
            'local_tipo',
            novosFiltros.local_tipo,
          );
        }

        const [
          apontamentosResult,
          vinculosResult,
          membrosResult,
          tarefasResult,
          materiaisResult,
          locaisResult,
        ] = await Promise.all([
          consultaApontamentos,
          supabase.from('producao_apontamento_membros').select('*'),
          supabase.from('producao_membros').select('*'),
          supabase.from('producao_tarefas').select('*'),
          consultaMateriais,
          supabase.from('locais_utilizacao').select('*'),
        ]);

        const erroConsulta =
          apontamentosResult.error ??
          vinculosResult.error ??
          membrosResult.error ??
          tarefasResult.error ??
          materiaisResult.error ??
          locaisResult.error;
        if (erroConsulta) throw erroConsulta;

        const todosVinculos = vinculosResult.data ?? [];
        let apontamentos = apontamentosResult.data ?? [];
        if (novosFiltros.membro_id) {
          const idsDoMembro = new Set(
            todosVinculos
              .filter(
                (vinculo) => vinculo.membro_id === novosFiltros.membro_id,
              )
              .map((vinculo) => vinculo.apontamento_id),
          );
          apontamentos = apontamentos.filter((apontamento) =>
            idsDoMembro.has(apontamento.id),
          );
        }

        const idsApontamentos = new Set(
          apontamentos.map((apontamento) => apontamento.id),
        );
        const vinculosMembros = todosVinculos.filter((vinculo) =>
          idsApontamentos.has(vinculo.apontamento_id),
        );
        const filtraPorDadosDoApontamento = Boolean(
          novosFiltros.data_inicio ||
            novosFiltros.data_fim ||
            novosFiltros.tarefa_id ||
            novosFiltros.membro_id ||
            novosFiltros.status ||
            novosFiltros.local_tipo,
        );
        const materiais = (materiaisResult.data ?? []).filter(
          (material) =>
            !filtraPorDadosDoApontamento ||
            (material.apontamento_id !== null &&
              idsApontamentos.has(material.apontamento_id)),
        );

        const consolidados = consolidarIndicadores({
          apontamentos,
          vinculosMembros,
          membros: membrosResult.data ?? [],
          tarefas: tarefasResult.data ?? [],
          materiais,
          locais: locaisResult.data ?? [],
        });
        setDadosConsolidados(consolidados);
        return consolidados;
      } catch (erro) {
        const mensagem =
          erro instanceof Error
            ? erro.message
            : 'Não foi possível carregar os indicadores da Produção.';
        setError(mensagem);
        throw erro;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    loading,
    error,
    filtros,
    dadosConsolidados,
    carregarIndicadores,
  };
};
