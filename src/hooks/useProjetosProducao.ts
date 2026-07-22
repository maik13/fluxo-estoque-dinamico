import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ProducaoProjeto, ProducaoProjetoStatus } from '@/types/producao';

export const useProjetosProducao = () => {
  const [projetos, setProjetos] = useState<ProducaoProjeto[]>([]);
  const [loading, setLoading] = useState(false);

  const listarProjetos = useCallback(async (status?: ProducaoProjetoStatus) => {
    setLoading(true);
    try {
      let consulta = supabase
        .from('producao_projetos')
        .select('*')
        .order('created_at', { ascending: false });

      if (status) {
        consulta = consulta.eq('status', status);
      }

      const { data, error } = await consulta;
      if (error) throw error;

      const resultado = (data ?? []) as ProducaoProjeto[];
      setProjetos(resultado);
      return resultado;
    } finally {
      setLoading(false);
    }
  }, []);

  const criarProjeto = useCallback(
    async (dados: Omit<ProducaoProjeto, 'id' | 'created_at' | 'updated_at' | 'criado_por_id'>) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('producao_projetos')
        .insert({
          ...dados,
          criado_por_id: user?.id ?? null,
        })
        .select()
        .single();

      if (error) throw error;

      const projeto = data as ProducaoProjeto;
      setProjetos((atuais) => [projeto, ...atuais]);
      return projeto;
    },
    []
  );

  const atualizarProjeto = useCallback(
    async (id: string, dados: Partial<ProducaoProjeto>) => {
      const { data, error } = await supabase
        .from('producao_projetos')
        .update(dados)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const projeto = data as ProducaoProjeto;
      setProjetos((atuais) =>
        atuais.map((item) => (item.id === id ? projeto : item))
      );
      return projeto;
    },
    []
  );

  return {
    projetos,
    loading,
    listarProjetos,
    criarProjeto,
    atualizarProjeto,
  };
};
