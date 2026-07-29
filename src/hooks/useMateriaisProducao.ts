import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatarErroSupabase } from '@/utils/supabaseError';

export interface MaterialItemSnapshot {
  id?: string;
  nome?: string;
  codigoBarras?: number | string;
  marca?: string | null;
  unidade?: string;
  especificacao?: string | null;
  fotoUrl?: string | null;
  tipoItem?: string | null;
}

export interface MaterialEtapaProducao {
  id: string;
  processo_id: string;
  item_id: string;
  quantidade_planejada: number;
  unidade_snapshot: string;
  item_snapshot: MaterialItemSnapshot;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaterialOrdemProducao {
  id: string;
  ordem_producao_id: string;
  processo_material_id: string | null;
  item_id: string;
  quantidade_planejada: number;
  quantidade_solicitada: number;
  unidade_snapshot: string;
  item_snapshot: MaterialItemSnapshot;
  observacoes: string | null;
  solicitacao_material_id: string | null;
  solicitacao_material_item_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaterialEtapaInput {
  item_id: string;
  quantidade: number;
  observacoes?: string | null;
}

export interface SolicitacaoMaterialOPResumo {
  id: string;
  numero: number;
  status: string;
  created_at: string;
  data_limite_separacao: string | null;
  data_necessidade: string | null;
}

export interface MateriaisOrdemResultado {
  materiais: MaterialOrdemProducao[];
  solicitacao: SolicitacaoMaterialOPResumo | null;
}

const erro = (value: unknown, fallback: string) =>
  new Error(formatarErroSupabase(value, fallback));

const normalizarMaterialEtapa = (item: any): MaterialEtapaProducao => ({
  ...item,
  quantidade_planejada: Number(item.quantidade_planejada ?? 0),
  item_snapshot: (item.item_snapshot ?? {}) as MaterialItemSnapshot,
});

const normalizarMaterialOrdem = (item: any): MaterialOrdemProducao => ({
  ...item,
  quantidade_planejada: Number(item.quantidade_planejada ?? 0),
  quantidade_solicitada: Number(item.quantidade_solicitada ?? 0),
  item_snapshot: (item.item_snapshot ?? {}) as MaterialItemSnapshot,
});

export const useMateriaisProducao = () => {
  const listarMateriaisEtapa = useCallback(async (processoId: string) => {
    const { data, error } = await (supabase.from as any)('producao_etapa_materiais')
      .select('*')
      .eq('processo_id', processoId)
      .order('created_at', { ascending: true });

    if (error) {
      throw erro(error, 'Não foi possível carregar o PCP de materiais da Etapa.');
    }

    return (data ?? []).map(normalizarMaterialEtapa) as MaterialEtapaProducao[];
  }, []);

  const salvarMateriaisEtapa = useCallback(async (
    processoId: string,
    materiais: MaterialEtapaInput[],
  ) => {
    const { error } = await (supabase.rpc as any)('salvar_materiais_etapa_producao', {
      p_processo_id: processoId,
      p_materiais: materiais,
    });

    if (error) {
      throw erro(error, 'Não foi possível salvar o PCP de materiais da Etapa.');
    }

    return listarMateriaisEtapa(processoId);
  }, [listarMateriaisEtapa]);

  const listarMateriaisOrdem = useCallback(async (
    ordemProducaoId: string,
  ): Promise<MateriaisOrdemResultado> => {
    const { data, error } = await (supabase.from as any)('producao_ordem_materiais')
      .select('*')
      .eq('ordem_producao_id', ordemProducaoId)
      .order('created_at', { ascending: true });

    if (error) {
      throw erro(error, 'Não foi possível carregar os materiais da Ordem de Produção.');
    }

    const materiais = (data ?? []).map(normalizarMaterialOrdem) as MaterialOrdemProducao[];

    const { data: solicitacaoData, error: solicitacaoError } = await (supabase.from as any)('solicitacoes_material')
      .select('id,numero,status,created_at,data_limite_separacao,data_necessidade')
      .eq('ordem_producao_id', ordemProducaoId)
      .neq('status', 'rejeitada')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (solicitacaoError) {
      throw erro(solicitacaoError, 'Não foi possível consultar a Solicitação de Material da OP.');
    }

    return {
      materiais,
      solicitacao: solicitacaoData
        ? {
            ...solicitacaoData,
            numero: Number(solicitacaoData.numero),
          } as SolicitacaoMaterialOPResumo
        : null,
    };
  }, []);

  const incorporarMateriaisPCP = useCallback(async (
    ordemProducaoId: string,
  ) => {
    const { data, error } = await (supabase.rpc as any)('incorporar_materiais_pcp_op', {
      p_ordem_producao_id: ordemProducaoId,
    });

    if (error) {
      throw erro(error, 'Não foi possível incorporar o PCP à Ordem de Produção.');
    }

    const quantidade = Number(data ?? 0);
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      throw new Error('A incorporação foi processada, mas nenhum material foi identificado.');
    }

    return quantidade;
  }, []);

  const gerarSolicitacaoMaterial = useCallback(async (
    ordemProducaoId: string,
    estoqueId: string,
  ) => {
    const { data, error } = await (supabase.rpc as any)('gerar_solicitacao_material_op', {
      p_ordem_producao_id: ordemProducaoId,
      p_estoque_id: estoqueId,
    });

    if (error) {
      throw erro(error, 'Não foi possível gerar a Solicitação de Material da OP.');
    }

    const registro = Array.isArray(data) ? data[0] : data;
    if (!registro?.solicitacao_id) {
      throw new Error('A solicitação foi processada, mas não pôde ser identificada.');
    }

    return {
      id: String(registro.solicitacao_id),
      numero: Number(registro.numero),
      status: String(registro.status ?? 'pendente'),
      created_at: String(registro.created_at),
      data_limite_separacao: registro.data_limite_separacao
        ? String(registro.data_limite_separacao)
        : null,
      data_necessidade: null,
      ja_existia: Boolean(registro.ja_existia),
    };
  }, []);

  return {
    listarMateriaisEtapa,
    salvarMateriaisEtapa,
    listarMateriaisOrdem,
    incorporarMateriaisPCP,
    gerarSolicitacaoMaterial,
  };
};
