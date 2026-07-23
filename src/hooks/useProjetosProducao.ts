import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ProducaoProjeto, ProducaoProjetoLocal, ProducaoLocalOperacionalTipo } from '@/types/producao';

export interface ProjetoLocalOperacionalInput {
  id?: string | null;
  local_utilizacao_id?: string | null;
  nome: string;
  tipo: ProducaoLocalOperacionalTipo;
  cidade?: string | null;
  uf?: string | null;
  endereco?: string | null;
  principal?: boolean;
  ativo?: boolean;
}

export interface ProjetoProducaoInput {
  id?: string | null;
  nome: string;
  descricao?: string | null;
  cliente?: string | null;
  cidade?: string | null;
  uf?: string | null;
  local_execucao?: string | null;
  endereco_execucao?: string | null;
  responsavel_nome?: string | null;
  ativo?: boolean;
  locais: ProjetoLocalOperacionalInput[];
}

interface ProjetoRow {
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
      let projetosQuery = supabase
        .from('producao_projetos')
        .select('*')
        .order('nome', { ascending: true });
      if (somenteAtivos) projetosQuery = projetosQuery.eq('ativo', true);

      const [projetosResult, locaisResult] = await Promise.all([
        projetosQuery,
        supabase
          .from('producao_projeto_locais')
          .select('*')
          .order('principal', { ascending: false })
          .order('tipo', { ascending: true })
          .order('nome', { ascending: true }),
      ]);
      if (projetosResult.error) throw projetosResult.error;
      if (locaisResult.error) throw locaisResult.error;

      const locaisPorProjeto = new Map<string, ProducaoProjetoLocal[]>();
      ((locaisResult.data ?? []) as ProducaoProjetoLocal[]).forEach((local) => {
        const atuais = locaisPorProjeto.get(local.projeto_id) ?? [];
        atuais.push(local);
        locaisPorProjeto.set(local.projeto_id, atuais);
      });

      const resultado = ((projetosResult.data ?? []) as ProjetoRow[]).map((projeto) => ({
        id: projeto.id,
        config_id: projeto.id,
        local_utilizacao_id: projeto.local_utilizacao_id,
        group_id: null,
        grupo_nome: null,
        nome: projeto.nome,
        descricao: projeto.descricao,
        cliente: projeto.cliente,
        cidade: projeto.cidade,
        uf: projeto.uf,
        local_execucao: projeto.local_execucao,
        endereco_execucao: projeto.endereco_execucao,
        data_inicio_prevista: projeto.data_inicio_prevista,
        data_fim_prevista: projeto.data_fim_prevista,
        responsavel_id: projeto.responsavel_id,
        responsavel_nome_snapshot: projeto.responsavel_nome_snapshot,
        observacoes: projeto.observacoes,
        ativo: projeto.ativo,
        configurado: true,
        criado_por_id: projeto.criado_por_id,
        criado_por_nome_snapshot: projeto.criado_por_nome_snapshot,
        atualizado_por_id: projeto.atualizado_por_id,
        atualizado_por_nome_snapshot: projeto.atualizado_por_nome_snapshot,
        created_at: projeto.created_at,
        updated_at: projeto.updated_at,
        locais: locaisPorProjeto.get(projeto.id) ?? [],
      } satisfies ProducaoProjeto));

      setProjetos(resultado);
      return resultado;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Não foi possível carregar os projetos de produção.';
      setProjetos([]);
      setErro(mensagem);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const salvarProjeto = useCallback(async (dados: ProjetoProducaoInput) => {
    const { data: id, error } = await supabase.rpc('salvar_projeto_producao_operacional', {
      p_id: dados.id ?? null,
      p_nome: dados.nome,
      p_descricao: dados.descricao ?? null,
      p_cliente: dados.cliente ?? null,
      p_cidade_destino: dados.cidade ?? null,
      p_uf_destino: dados.uf ?? null,
      p_local_destino: dados.local_execucao ?? null,
      p_endereco_destino: dados.endereco_execucao ?? null,
      p_responsavel_nome: dados.responsavel_nome ?? null,
      p_ativo: dados.ativo ?? true,
      p_locais: dados.locais,
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
    criarProjeto: salvarProjeto,
    atualizarProjeto: async (id: string, dados: ProjetoProducaoInput) => salvarProjeto({ ...dados, id }),
  };
};
