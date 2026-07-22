import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ProducaoProcesso, ProducaoProcessoStatus } from '@/types/producao';

export const useProcessosProducao = () => {
  const [processos, setProcessos] = useState<ProducaoProcesso[]>([]);
  const [loading, setLoading] = useState(false);

  const listarProcessos = useCallback(async (status?: ProducaoProcessoStatus) => {
    setLoading(true);
    try {
      let consulta = supabase
        .from('producao_processos')
        .select('*, projeto:producao_projetos(nome)')
        .order('created_at', { ascending: false });

      if (status) {
        consulta = consulta.eq('status', status);
      }

      const { data, error } = await consulta;
      if (error) throw error;

      const resultado = (data ?? []) as ProducaoProcesso[];
      setProcessos(resultado);
      return resultado;
    } finally {
      setLoading(false);
    }
  }, []);

  const criarProcesso = useCallback(
    async (dados: Pick<ProducaoProcesso, 'projeto_id' | 'nome' | 'descricao' | 'prioridade'>) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('producao_processos')
        .insert({
          ...dados,
          status: 'planejado',
          criado_por_id: user?.id ?? null,
        })
        .select()
        .single();

      if (error) throw error;

      const processo = data as ProducaoProcesso;
      setProcessos((atuais) => [processo, ...atuais]);
      return processo;
    },
    []
  );

  const atualizarProcesso = useCallback(
    async (id: string, dados: Partial<ProducaoProcesso>) => {
      const { data, error } = await supabase
        .from('producao_processos')
        .update(dados)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const processo = data as ProducaoProcesso;
      setProcessos((atuais) =>
        atuais.map((item) => (item.id === id ? processo : item))
      );
      return processo;
    },
    []
  );

  const transicaoProcesso = useCallback(
    async (id: string, acao: 'iniciar' | 'pausar' | 'retomar' | 'bloquear' | 'desbloquear' | 'finalizar' | 'cancelar' | 'reabrir', justificativa?: string) => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Usuário não autenticado');

      const { error } = await supabase.rpc('transicao_processo_producao', {
        p_processo_id: id,
        p_acao: acao,
        p_justificativa: justificativa || null,
      });

      if (error) throw error;

      // Recarrega os processos
      await listarProcessos();
    },
    [listarProcessos]
  );

  return {
    processos,
    loading,
    listarProcessos,
    criarProcesso,
    atualizarProcesso,
    transicaoProcesso,
  };
};
