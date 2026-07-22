import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ProducaoProjeto } from '@/types/producao';

export interface ProjetoProducaoInput {
  nome: string;
  descricao?: string | null;
  cliente?: string | null;
  cidade?: string | null;
  uf?: string | null;
  local_execucao?: string | null;
  endereco_execucao?: string | null;
  ativo?: boolean;
}

export const useProjetosProducao = () => {
  const [projetos, setProjetos] = useState<ProducaoProjeto[]>([]);
  const [loading, setLoading] = useState(false);

  const listarProjetos = useCallback(async (somenteAtivos = false) => {
    setLoading(true);
    try {
      let consulta = supabase
        .from('producao_projetos')
        .select('*')
        .order('created_at', { ascending: false });

      if (somenteAtivos) consulta = consulta.eq('ativo', true);

      const { data, error } = await consulta;
      if (error) throw error;
      const resultado = (data ?? []) as ProducaoProjeto[];
      setProjetos(resultado);
      return resultado;
    } finally {
      setLoading(false);
    }
  }, []);

  const criarProjeto = useCallback(async (dados: ProjetoProducaoInput) => {
    const { data: id, error } = await supabase.rpc('criar_projeto_producao', {
      p_nome: dados.nome,
      p_descricao: dados.descricao ?? null,
      p_cliente: dados.cliente ?? null,
      p_cidade: dados.cidade ?? null,
      p_uf: dados.uf ?? null,
      p_local_execucao: dados.local_execucao ?? null,
      p_endereco_execucao: dados.endereco_execucao ?? null,
    });
    if (error) throw error;

    const { data, error: readError } = await supabase
      .from('producao_projetos')
      .select('*')
      .eq('id', id)
      .single();
    if (readError) throw readError;

    const projeto = data as ProducaoProjeto;
    setProjetos((atuais) => [projeto, ...atuais]);
    return projeto;
  }, []);

  const atualizarProjeto = useCallback(
    async (id: string, dados: ProjetoProducaoInput) => {
      const { error } = await supabase.rpc('editar_projeto_producao', {
        p_id: id,
        p_nome: dados.nome,
        p_descricao: dados.descricao ?? null,
        p_cliente: dados.cliente ?? null,
        p_cidade: dados.cidade ?? null,
        p_uf: dados.uf ?? null,
        p_local_execucao: dados.local_execucao ?? null,
        p_endereco_execucao: dados.endereco_execucao ?? null,
        p_ativo: dados.ativo ?? true,
      });
      if (error) throw error;

      const { data, error: readError } = await supabase
        .from('producao_projetos')
        .select('*')
        .eq('id', id)
        .single();
      if (readError) throw readError;

      const projeto = data as ProducaoProjeto;
      setProjetos((atuais) =>
        atuais.map((item) => (item.id === id ? projeto : item)),
      );
      return projeto;
    },
    [],
  );

  return { projetos, loading, listarProjetos, criarProjeto, atualizarProjeto };
};
