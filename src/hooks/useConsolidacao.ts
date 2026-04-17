import { useMemo } from 'react';
import { Movimentacao, LocalUtilizacaoConfig, ProjectGroupConfig } from '@/types/estoque';

export interface ItemAgrupado {
  key: string;
  itemId: string;
  itemSnapshot: any;
  localUtilizacaoId: string;
  localUtilizacaoNome: string;
  projetoGrupoNome: string;
  totalSaida: number;
  totalDevolvido: number;
  pendente: number;
  ultimaSaida: string;
  destinatario?: string;
  solicitanteNome?: string;
  solicitacaoId?: string;
  statusItem: 'pendente' | 'parcial' | 'devolvido';
}

export interface GrupoAgrupado {
  id: string;
  nome: string;
  totalSaida: number;
  totalDevolvido: number;
  saldo: number;
  status: 'Pendente' | 'Parcial' | 'Devolvido';
  quantidadeItens: number;
}

export interface PainelKPIs {
  totalPendente: number;
  totalEmCampo: number;
  totalDevolvido: number;
  gruposComPendencia: number;
}

export interface ConsolidacaoFiltros {
  dataInicio?: Date;
  dataFim?: Date;
  tipoItem?: string;
  grupoId?: string;
  localId?: string; // Novo filtro por Projeto/Local específico
}

export const useConsolidacao = (
  movimentacoes: Movimentacao[],
  locaisConfig: LocalUtilizacaoConfig[],
  gruposProjeto: ProjectGroupConfig[],
  tipoAgrupamento: 'projeto' | 'grupo',
  filtros?: ConsolidacaoFiltros
) => {
  // Helper para verificar se uma movimentação é devolução
  const isDevolucao = (mov: Movimentacao) => {
    const porObservacao = mov.tipo === 'ENTRADA' && 
           mov.observacoes?.toLowerCase().includes('devolução');
    const porTipoOperacao = mov.tipo === 'ENTRADA' && 
           (mov.solicitacaoTipoOperacao === 'devolucao' || mov.solicitacaoTipoOperacao === 'devolucao_estoque');
    return porObservacao || porTipoOperacao;
  };

  const dadosConsolidados = useMemo(() => {
    // 1. Filtros de base (Data e Tipo de Item)
    const movsFiltradas = movimentacoes.filter(mov => {
      // Filtro de Data (se fornecido)
      if (filtros?.dataInicio || filtros?.dataFim) {
        const dataMov = new Date(mov.dataHora);
        if (filtros.dataInicio && dataMov < filtros.dataInicio) return false;
        if (filtros.dataFim && dataMov > filtros.dataFim) return false;
      }
      
      // Filtro de Tipo de Item (se fornecido)
      if (filtros?.tipoItem && filtros.tipoItem !== 'todos') {
        const tipoNoSnapshot = mov.itemSnapshot?.tipoItem;
        // Verifica tanto tipoItem quanto categoria (se houver no snapshot)
        if (tipoNoSnapshot !== filtros.tipoItem) return false;
      }

      // Filtro de Projeto/Local específico (se fornecido)
      if (filtros?.localId && filtros.localId !== 'todos') {
        if (mov.localUtilizacaoId !== filtros.localId) return false;
      }

      return true;
    });

    // 2. Mapas de lookup para performance O(1)
    const locaisMapLookup = new Map(locaisConfig.map(l => [l.id, l]));
    const gruposMapLookup = new Map(gruposProjeto.map(g => [g.id, g]));

    const getGroupingData = (localId: string | null, localNome: string | null) => {
      if (tipoAgrupamento === 'projeto') {
        return {
          id: localId || 'sem-local',
          name: localNome || 'Sem local'
        };
      } else {
        const local = localId ? locaisMapLookup.get(localId) : null;
        const grupoId = local?.group_id || 'sem-grupo';
        const grupo = gruposMapLookup.get(grupoId);
        return {
          id: grupoId,
          name: grupo?.nome || 'Sem Grupo'
        };
      }
    };

    // 3. Agregação por Item + (Projeto ou Grupo)
    const itensMap = new Map<string, ItemAgrupado>();

    movsFiltradas.forEach(mov => {
      if (mov.tipo === 'SAIDA') {
        const itemId = mov.itemId || 'sem-item';
        const { id: groupingId, name: groupingName } = getGroupingData(mov.localUtilizacaoId || null, mov.localUtilizacaoNome || null);
        
        // Filtro de Grupo específico (se fornecido)
        if (filtros?.grupoId && filtros.grupoId !== 'todos' && groupingId !== filtros.grupoId) return;

        const key = `${itemId}_${groupingId}`;
        const existing = itensMap.get(key);

        if (existing) {
          existing.totalSaida += mov.quantidade;
          if (new Date(mov.dataHora) > new Date(existing.ultimaSaida)) {
            existing.ultimaSaida = mov.dataHora;
            existing.destinatario = mov.destinatario;
            existing.solicitacaoId = mov.solicitacaoId;
            existing.solicitanteNome = mov.solicitanteNome;
          }
        } else {
          itensMap.set(key, {
            key,
            itemId,
            itemSnapshot: mov.itemSnapshot,
            localUtilizacaoId: groupingId,
            localUtilizacaoNome: groupingName,
            projetoGrupoNome: '', // Calculado no final
            totalSaida: mov.quantidade,
            totalDevolvido: 0,
            pendente: 0,
            ultimaSaida: mov.dataHora,
            destinatario: mov.destinatario,
            solicitanteNome: mov.solicitanteNome,
            solicitacaoId: mov.solicitacaoId,
            statusItem: 'pendente'
          });
        }
      }
    });

    // Subtrair devoluções
    movsFiltradas.forEach(mov => {
      if (isDevolucao(mov)) {
        const itemId = mov.itemId || 'sem-item';
        const { id: groupingId } = getGroupingData(mov.localUtilizacaoId || null, mov.localUtilizacaoNome || null);
        
        const key = `${itemId}_${groupingId}`;
        const existing = itensMap.get(key);
        if (existing) {
          existing.totalDevolvido += mov.quantidade;
        }
      }
    });

    // 4. Agregação por Grupo (Totalizadores do Painel)
    const gruposStatsMap = new Map<string, GrupoAgrupado>();

    const itensProcessados = Array.from(itensMap.values()).map(item => {
      // Completar projetoGrupoNome se estiver no modo projeto
      let projetoGrupoNome = '-';
      let grupoIdFinal = item.localUtilizacaoId;

      if (tipoAgrupamento === 'projeto') {
        const local = locaisMapLookup.get(item.localUtilizacaoId);
        grupoIdFinal = local?.group_id || 'sem-grupo';
        const grupo = gruposMapLookup.get(grupoIdFinal);
        projetoGrupoNome = grupo?.nome || '-';
      } else {
        projetoGrupoNome = item.localUtilizacaoNome;
      }

      const pendente = Math.max(0, item.totalSaida - item.totalDevolvido);
      const statusItem: 'pendente' | 'parcial' | 'devolvido' = 
        pendente <= 0 ? 'devolvido' : (item.totalDevolvido > 0 ? 'parcial' : 'pendente');

      const itemFinal = { ...item, projetoGrupoNome, pendente, statusItem };

      // Acumular para o resumo de grupos
      const gId = tipoAgrupamento === 'grupo' ? item.localUtilizacaoId : grupoIdFinal;
      const gNome = tipoAgrupamento === 'grupo' ? item.localUtilizacaoNome : projetoGrupoNome;
      
      const gStats = gruposStatsMap.get(gId) || {
        id: gId,
        nome: gNome === '-' ? 'Sem Grupo' : gNome,
        totalSaida: 0,
        totalDevolvido: 0,
        saldo: 0,
        status: 'Devolvido',
        quantidadeItens: 0
      };

      gStats.totalSaida += item.totalSaida;
      gStats.totalDevolvido += item.totalDevolvido;
      gStats.saldo += pendente;
      gStats.quantidadeItens += 1;
      
      if (gStats.saldo > 0) {
        gStats.status = gStats.totalDevolvido > 0 ? 'Parcial' : 'Pendente';
      } else {
        gStats.status = 'Devolvido';
      }

      gruposStatsMap.set(gId, gStats);
      return itemFinal;
    });

    // Sorting final
    const itensFinal = itensProcessados.sort((a, b) => 
      new Date(b.ultimaSaida).getTime() - new Date(a.ultimaSaida).getTime()
    );

    const gruposFinal = Array.from(gruposStatsMap.values()).sort((a, b) => b.saldo - a.saldo);

    // 5. KPIs
    const kpis: PainelKPIs = {
      totalPendente: gruposFinal.reduce((sum, g) => sum + g.saldo, 0),
      totalEmCampo: gruposFinal.reduce((sum, g) => sum + g.totalSaida, 0),
      totalDevolvido: gruposFinal.reduce((sum, g) => sum + g.totalDevolvido, 0),
      gruposComPendencia: gruposFinal.filter(g => g.saldo > 0).length
    };

    return {
      itensAgrupados: itensFinal,
      gruposAgrupados: gruposFinal,
      kpis
    };
  }, [movimentacoes, locaisConfig, gruposProjeto, tipoAgrupamento, filtros]);

  return dadosConsolidados;
};
