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

export interface LocalDisponivelProducao {
  id: string;
  nome: string;
  group_id: string | null;
  grupo_nome: string | null;
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
  const [erro, setErro] = useState<string | null>(null);

  const listarProjetos = useCallback(async (somenteAtivos = false) => {
    setLoading(true);
    setErro(null);

    try {
      let configsQuery = supabase
        .from('producao_projetos')
        .select('*')
        .order('nome', { ascending: true });

      if (somenteAtivos) configsQuery = configsQuery.eq('ativo', true);

      const configsResult = await configsQuery;
      if (configsResult.error) throw configsResult.error;

      const configs = (configsResult.data ?? []) as ConfigRow[];
      const localIds = configs
        .map((config) => config.local_utilizacao_id)
        .filter((id): id is string => Boolean(id));

      const [locaisResult, gruposResult] = await Promise.all([
        localIds.length > 0
          ? supabase
              .from('locais_utilizacao')
              .select('id,nome,ativo,group_id,created_at')
              .in('id', localIds)
          : Promise.resolve({ data: [], error: null }),
        supabase.from('project_groups').select('id,nome').eq('ativo', true),
      ]);

      if (locaisResult.error) {
        console.warn('Não foi possível complementar os projetos com os locais originais:', locaisResult.error);
      }
      if (gruposResult.error) {
        console.warn('Não foi possível carregar os grupos dos projetos:', gruposResult.error);
      }

      const locais = new Map(
        ((locaisResult.data ?? []) as LocalRow[]).map((local) => [local.id, local]),
      );
      const grupos = new Map(
        ((gruposResult.data ?? []) as GrupoRow[]).map((grupo) => [grupo.id, grupo.nome]),
      );

      // A aba Produção exibe somente os projetos efetivamente adicionados em
      // producao_projetos. Os demais locais do aplicativo ficam disponíveis
      // apenas no formulário "Adicionar Projeto".
      const resultado = configs
        .filter((config) => Boolean(config.local_utilizacao_id))
        .map((config) => {
          const localId = config.local_utilizacao_id as string;
          const local = locais.get(localId);

          return {
            id: localId,
            config_id: config.id,
            local_utilizacao_id: localId,
            group_id: local?.group_id ?? null,
            grupo_nome: local?.group_id ? grupos.get(local.group_id) ?? null : null,
            nome: config.nome || local?.nome || 'Projeto sem nome',
            descricao: config.descricao,
            cliente: config.cliente,
            cidade: config.cidade,
            uf: config.uf,
            local_execucao: config.local_execucao,
            endereco_execucao: config.endereco_execucao,
            data_inicio_prevista: config.data_inicio_prevista,
            data_fim_prevista: config.data_fim_prevista,
            responsavel_id: config.responsavel_id,
            responsavel_nome_snapshot: config.responsavel_nome_snapshot,
            observacoes: config.observacoes,
            ativo: config.ativo && (local?.ativo ?? true),
            configurado: true,
            criado_por_id: config.criado_por_id,
            criado_por_nome_snapshot: config.criado_por_nome_snapshot,
            atualizado_por_id: config.atualizado_por_id,
            atualizado_por_nome_snapshot: config.atualizado_por_nome_snapshot,
            created_at: config.created_at,
            updated_at: config.updated_at,
          } satisfies ProducaoProjeto;
        });

      setProjetos(resultado);
      return resultado;
    } catch (error) {
      const mensagem = error instanceof Error
        ? error.message
        : 'Não foi possível carregar os projetos adicionados à Produção.';
      setProjetos([]);
      setErro(mensagem);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const listarLocaisDisponiveis = useCallback(async () => {
    const [locaisResult, gruposResult, configsResult] = await Promise.all([
      supabase
        .from('locais_utilizacao')
        .select('id,nome,ativo,group_id,created_at')
        .eq('ativo', true)
        .order('nome', { ascending: true }),
      supabase.from('project_groups').select('id,nome').eq('ativo', true),
      supabase.from('producao_projetos').select('local_utilizacao_id'),
    ]);

    if (locaisResult.error) throw locaisResult.error;
    if (configsResult.error) throw configsResult.error;
    if (gruposResult.error) {
      console.warn('Não foi possível carregar os grupos dos locais:', gruposResult.error);
    }

    const configurados = new Set(
      ((configsResult.data ?? []) as Array<{ local_utilizacao_id: string | null }>)
        .map((item) => item.local_utilizacao_id)
        .filter((id): id is string => Boolean(id)),
    );
    const grupos = new Map(
      ((gruposResult.data ?? []) as GrupoRow[]).map((grupo) => [grupo.id, grupo.nome]),
    );

    return ((locaisResult.data ?? []) as LocalRow[])
      .filter((local) => !configurados.has(local.id))
      .map((local) => ({
        id: local.id,
        nome: local.nome,
        group_id: local.group_id,
        grupo_nome: local.group_id ? grupos.get(local.group_id) ?? null : null,
      } satisfies LocalDisponivelProducao));
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
    erro,
    listarProjetos,
    listarLocaisDisponiveis,
    criarProjeto: salvarConfiguracao,
    atualizarProjeto: async (_id: string, dados: ProjetoProducaoInput) => salvarConfiguracao(dados),
  };
};
