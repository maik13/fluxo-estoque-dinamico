import { useEffect, useMemo, useState } from 'react';
import { EstoqueItem } from '@/types/estoque';
import { supabase } from '@/integrations/supabase/client';
import { REGRA_FERRAMENTA_UNICA_ATIVA_DESDE } from '@/config/regra-ferramenta';

export interface AlocacaoEstoqueContado {
  alocada: boolean;
  saldoPendente: number;
  localAtual?: string;
}

export type StatusEstoqueContado = 'No almoxarifado' | 'Em uso/projeto' | 'Sem saldo';

export interface LinhaEstoqueContado {
  item: EstoqueItem;
  codigo: number;
  marca: string;
  especificacao: string;
  localizacaoAlmox: string;
  status: StatusEstoqueContado;
  projetoLocalUso: string;
  saldo: string;
}

export interface TotaisEstoqueContado {
  codigosCadastrados: number;
  noAlmoxarifado: number;
  emUsoProjeto: number;
  semSaldo: number;
}

export interface GrupoClassificacaoEstoqueContado {
  classificacao: string;
  totais: TotaisEstoqueContado;
  linhas: LinhaEstoqueContado[];
}

export interface GrupoItemEstoqueContado {
  nome: string;
  totais: TotaisEstoqueContado;
  classificacoes: GrupoClassificacaoEstoqueContado[];
}

export interface DadosEstoqueContado {
  totais: TotaisEstoqueContado;
  grupos: GrupoItemEstoqueContado[];
}

const totaisVazios = (): TotaisEstoqueContado => ({
  codigosCadastrados: 0,
  noAlmoxarifado: 0,
  emUsoProjeto: 0,
  semSaldo: 0,
});

const somarStatus = (totais: TotaisEstoqueContado, status: StatusEstoqueContado) => {
  totais.codigosCadastrados += 1;

  if (status === 'Em uso/projeto') {
    totais.emUsoProjeto += 1;
    return;
  }

  if (status === 'No almoxarifado') {
    totais.noAlmoxarifado += 1;
    return;
  }

  totais.semSaldo += 1;
};

export const formatarClassificacaoContada = (item: EstoqueItem): string => {
  const partes = [
    item.especificacao,
    item.marca,
    item.unidade,
    item.condicao,
  ].filter((valor) => String(valor || '').trim().length > 0);

  return partes.length > 0 ? partes.join(' • ') : 'Sem classificação definida';
};

export const obterLinhaEstoqueContado = (
  item: EstoqueItem,
  alocacao?: AlocacaoEstoqueContado
): LinhaEstoqueContado => {
  const localizacaoAlmox = [item.localizacao, item.caixaOrganizador]
    .filter((valor) => String(valor || '').trim().length > 0)
    .join(' - ') || '-';

  if (alocacao?.alocada) {
    return {
      item,
      codigo: item.codigoBarras,
      marca: item.marca || '-',
      especificacao: item.especificacao || '-',
      localizacaoAlmox,
      status: 'Em uso/projeto',
      projetoLocalUso: alocacao.localAtual || 'Local não identificado',
      saldo: `Pendente: ${alocacao.saldoPendente}`,
    };
  }

  if (item.estoqueAtual > 0) {
    return {
      item,
      codigo: item.codigoBarras,
      marca: item.marca || '-',
      especificacao: item.especificacao || '-',
      localizacaoAlmox,
      status: 'No almoxarifado',
      projetoLocalUso: '-',
      saldo: String(item.estoqueAtual),
    };
  }

  return {
    item,
    codigo: item.codigoBarras,
    marca: item.marca || '-',
    especificacao: item.especificacao || '-',
    localizacaoAlmox,
    status: 'Sem saldo',
    projetoLocalUso: '-',
    saldo: '0',
  };
};

export const calcularEstoqueContado = (
  itens: EstoqueItem[],
  alocacoes: Record<string, AlocacaoEstoqueContado>
): DadosEstoqueContado => {
  const totais = totaisVazios();
  const gruposPorNome = new Map<string, Map<string, LinhaEstoqueContado[]>>();

  [...itens]
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
    .forEach((item) => {
      const nome = item.nome || 'Sem Nome';
      const classificacao = formatarClassificacaoContada(item);
      const linha = obterLinhaEstoqueContado(item, alocacoes[item.id]);

      somarStatus(totais, linha.status);

      if (!gruposPorNome.has(nome)) {
        gruposPorNome.set(nome, new Map());
      }

      const grupoClassificacao = gruposPorNome.get(nome)!;
      if (!grupoClassificacao.has(classificacao)) {
        grupoClassificacao.set(classificacao, []);
      }

      grupoClassificacao.get(classificacao)!.push(linha);
    });

  const grupos = Array.from(gruposPorNome.entries()).map(([nome, classificacoesMap]) => {
    const totaisGrupo = totaisVazios();
    const classificacoes = Array.from(classificacoesMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([classificacao, linhas]) => {
        const totaisClassificacao = totaisVazios();
        const linhasOrdenadas = [...linhas].sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));

        linhasOrdenadas.forEach((linha) => {
          somarStatus(totaisClassificacao, linha.status);
          somarStatus(totaisGrupo, linha.status);
        });

        return {
          classificacao,
          totais: totaisClassificacao,
          linhas: linhasOrdenadas,
        };
      });

    return {
      nome,
      totais: totaisGrupo,
      classificacoes,
    };
  });

  return { totais, grupos };
};

interface UseEstoqueContadoOptions {
  itens: EstoqueItem[];
  estoqueId?: string | null;
  ativo?: boolean;
}

type MovimentoAlocacao = {
  item_id: string;
  tipo: string;
  quantidade: number;
  observacoes: string | null;
  data_hora: string;
  local_utilizacao_id: string | null;
  locais_utilizacao?: { nome: string | null } | null;
};

const tamanhoLoteConsulta = 80;

const dividirEmLotes = <T,>(itens: T[], tamanho: number) => {
  const lotes: T[][] = [];

  for (let indice = 0; indice < itens.length; indice += tamanho) {
    lotes.push(itens.slice(indice, indice + tamanho));
  }

  return lotes;
};

const buscarAlocacoesEmLote = async (
  itens: EstoqueItem[],
  estoqueId?: string | null
): Promise<Record<string, AlocacaoEstoqueContado>> => {
  const resultado: Record<string, AlocacaoEstoqueContado> = {};
  const ids = itens.map((item) => item.id);

  ids.forEach((id) => {
    resultado[id] = { alocada: false, saldoPendente: 0 };
  });

  const consultas = dividirEmLotes(ids, tamanhoLoteConsulta).map(async (idsDoLote) => {
    let query = supabase
      .from('movements')
      .select(`
        item_id,
        tipo,
        quantidade,
        observacoes,
        data_hora,
        created_at,
        local_utilizacao_id,
        locais_utilizacao:local_utilizacao_id (nome)
      `)
      .in('item_id', idsDoLote)
      .gte('created_at', REGRA_FERRAMENTA_UNICA_ATIVA_DESDE)
      .order('data_hora', { ascending: true });

    if (estoqueId) {
      query = query.or(`estoque_id.eq.${estoqueId},estoque_id.is.null`);
    }

    const { data, error } = await query;

    if (error || !data) {
      return [] as MovimentoAlocacao[];
    }

    return data as MovimentoAlocacao[];
  });

  const movimentos = (await Promise.all(consultas)).flat();
  const movimentosPorItem = new Map<string, MovimentoAlocacao[]>();

  movimentos.forEach((movimento) => {
    if (!movimentosPorItem.has(movimento.item_id)) {
      movimentosPorItem.set(movimento.item_id, []);
    }

    movimentosPorItem.get(movimento.item_id)!.push(movimento);
  });

  movimentosPorItem.forEach((movimentosDoItem, itemId) => {
    let saldo = 0;
    let ultimoLocal = '';

    movimentosDoItem
      .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())
      .forEach((movimento) => {
        if (movimento.tipo === 'SAIDA') {
          saldo += Number(movimento.quantidade);
          ultimoLocal = movimento.locais_utilizacao?.nome || 'Local não identificado';
        }

        if (movimento.tipo === 'ENTRADA' && movimento.observacoes?.toLowerCase().includes('devolução')) {
          saldo = Math.max(0, saldo - Number(movimento.quantidade));
        }
      });

    resultado[itemId] = {
      alocada: saldo > 0,
      saldoPendente: saldo,
      localAtual: saldo > 0 ? ultimoLocal : undefined,
    };
  });

  return resultado;
};

export const useEstoqueContado = ({
  itens,
  estoqueId,
  ativo = true,
}: UseEstoqueContadoOptions) => {
  const [alocacoes, setAlocacoes] = useState<Record<string, AlocacaoEstoqueContado>>({});
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    let montado = true;

    const buscarAlocacoes = async () => {
      const itensSemAlocacao = itens.filter((item) => !alocacoes[item.id]);

      if (!ativo || itensSemAlocacao.length === 0) {
        setCarregando(false);
        return;
      }

      setCarregando(true);
      const novasAlocacoes = await buscarAlocacoesEmLote(itensSemAlocacao, estoqueId);

      if (montado) {
        setAlocacoes((anteriores) => ({ ...anteriores, ...novasAlocacoes }));
        setCarregando(false);
      }
    };

    buscarAlocacoes();

    return () => {
      montado = false;
    };
  }, [ativo, itens, estoqueId, alocacoes]);

  const dados = useMemo(() => calcularEstoqueContado(itens, alocacoes), [itens, alocacoes]);

  return {
    alocacoes,
    carregando,
    grupos: dados.grupos,
    totais: dados.totais,
    dados,
  };
};
