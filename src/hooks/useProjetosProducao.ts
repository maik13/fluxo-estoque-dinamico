import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ProducaoProjeto } from '@/types/producao';

export interface ProjetoProducaoInput {
  local_utilizacao_id: string;
  descricao?: string | null;
  cliente?: string | null;
  cidade?: string | null;
  uf?: string | null;
  local_execucao?: string | null;
  endereco_execucao?: string | null;
  responsavel_id?: string | null;
  responsavel_nome?: string | null;
  ativo?: boolean;
}

interface LocalRow {
  id: string;
  nome: string;
  ativo: boolean;
  group_id: string | null;
  created_at: string;
}

interface GrupoRow {
  id: string;
  nome: string;
}

interface ConfigRow {
  id: string;
  local_utilizacao_id: string | null;
  nome: string;
  descricao: string | null;
  cliente: string | null;
  cidade: string | null;
  uf: string | null;
  local_execucao: string | null;
  endereco_execucao: string | null;
  data_inicio_prevista: string | null;
  data_fim_prevista: string | null;
  responsavel_id: string | null;
  responsavel_nome_snapshot: string | null;
  observacoes: string | null;
  ativo: boolean;
  criado_por_id: string | null;
  criado_por_nome_snapshot: string | null;
  atualizado_por_id: string | null;
  atualizado_por_nome_snapshot: string | null;
  created_at: string;
  updated_at: string;
}

export const useProjetosProducao = () => {
  const [projetos, setProjetos] = useState<ProducaoProjeto[]>([]);
  const [loading, setLoading] = useState(false);

  const listarProjetos = useCallback(async (somenteAtivos = false) => {
    setLoading(true);
    try {
      let locaisQuery = supabase
        .from('locais_utilizacao')
        .select('id,nome,ativo,group_id,created_at')
        .order('nome', { ascending: true });
      if (somenteAtivos) locaisQuery = locaisQuery.eq('ativo', true);

      const [locaisResult, gruposResult, configsResult] = await Promise.all([
        locaisQuery,
        supabase.from('project_groups').select('id,nome').eq('ativo', true),
        supabase.from('producao_projetos').select('*'),
      ]);

      if (locaisResult.error) throw locaisResult.error;
      if (gruposResult.error) throw gruposResult.error;
      if (configsResult.error) throw configsResult.error;

      const grupos = new Map(
        ((gruposResult.data ?? []) as GrupoRow[]).map((grupo) => [grupo.id, grupo.nome]),
      );
      const configs = new Map(
        ((configsResult.data ?? []) as ConfigRow[])
          .filter((config) => config.local_utilizacao_id)
          .map((config) => [config.local_utilizacao_id as string, config]),
      );

      const resultado = ((locaisResult.data ?? []) as LocalRow[]).map((local) => {
        const config = configs.get(local.id);
        return {
          id: local.id,
          config_id: config?.id ?? null,
          local_utilizacao_id: local.id,
          group_id: local.group_id,
          grupo_nome: local.group_id ? grupos.get(local.group_id) ?? null : null,
          nome: local.nome,
          descricao: config?.descricao ?? null,
          cliente: config?.cliente ?? null,
          cidade: config?.cidade ?? null,
          uf: config?.uf ?? null,
          local_execucao: config?.local_execucao ?? local.nome,
          endereco_execucao: config?.endereco_execucao ?? null,
          data_inicio_prevista: config?.data_inicio_prevista ?? null,
          data_fim_prevista: config?.data_fim_prevista ?? null,
          responsavel_id: config?.responsavel_id ?? null,
          responsavel_nome_snapshot: config?.responsavel_nome_snapshot ?? null,
          observacoes: config?.observacoes ?? null,
          ativo: local.ativo && (config?.ativo ?? true),
          configurado: Boolean(config),
          criado_por_id: config?.criado_por_id ?? null,
          criado_por_nome_snapshot: config?.criado_por_nome_snapshot ?? null,
          atualizado_por_id: config?.atualizado_por_id ?? null,
          atualizado_por_nome_snapshot: config?.atualizado_por_nome_snapshot ?? null,
          created_at: config?.created_at ?? local.created_at,
          updated_at: config?.updated_at ?? local.created_at,
        } satisfies ProducaoProjeto;
      });

      setProjetos(resultado);
      return resultado;
    } finally {
      setLoading(false);
    }
  }, []);

  const salvarConfiguracao = useCallback(async (dados: ProjetoProducaoInput) => {
    const { data: id, error } = await supabase.rpc('configurar_projeto_producao', {
      p_local_utilizacao_id: dados.local_utilizacao_id,
      p_descricao: dados.descricao ?? null,
      p_cliente: dados.cliente ?? null,
      p_cidade: dados.cidade ?? null,
      p_uf: dados.uf ?? null,
      p_local_execucao: dados.local_execucao ?? null,
      p_endereco_execucao: dados.endereco_execucao ?? null,
      p_responsavel_id: dados.responsavel_id ?? null,
      p_responsavel_nome: dados.responsavel_nome ?? null,
      p_ativo: dados.ativo ?? true,
    });
    if (error) throw error;
    await listarProjetos();
    return id as string;
  }, [listarProjetos]);

  return {
    projetos,
    loading,
    listarProjetos,
    criarProjeto: salvarConfiguracao,
    atualizarProjeto: async (_id: string, dados: ProjetoProducaoInput) => salvarConfiguracao(dados),
  };
};
