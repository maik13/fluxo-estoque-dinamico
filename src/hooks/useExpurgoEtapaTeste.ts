import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatarErroSupabase } from '@/utils/supabaseError';

export interface ResumoExpurgoEtapaTeste {
  processo_id: string;
  codigo: string;
  nome: string;
  status: string;
  total_ops: number;
  total_apontamentos: number;
  total_apontamentos_conferidos: number;
  total_anexos: number;
  total_materiais_etapa: number;
  total_materiais_op: number;
  total_solicitacoes_material: number;
  total_retiradas: number;
  total_materiais_oficiais: number;
  pode_expurgar: boolean;
  motivo_bloqueio: string | null;
}

export const useExpurgoEtapaTeste = () => {
  const obterResumoExpurgo = useCallback(async (processoId: string) => {
    const { data, error } = await (supabase.rpc as any)(
      'obter_resumo_expurgo_etapa_teste',
      { p_processo_id: processoId },
    );

    if (error) {
      throw new Error(
        formatarErroSupabase(
          error,
          'Não foi possível verificar se a Etapa pode ser expurgada.',
        ),
      );
    }

    const resumo = (data?.[0] ?? null) as ResumoExpurgoEtapaTeste | null;
    if (!resumo) {
      throw new Error(
        'Etapa não encontrada ou usuário sem permissão administrativa.',
      );
    }

    return resumo;
  }, []);

  const expurgarEtapaTeste = useCallback(
    async (
      processoId: string,
      codigoConfirmacao: string,
      confirmacaoExpurgo: string,
      justificativa: string,
    ) => {
      const { error } = await (supabase.rpc as any)(
        'expurgar_etapa_producao_teste',
        {
          p_processo_id: processoId,
          p_codigo_confirmacao: codigoConfirmacao,
          p_confirmacao_expurgo: confirmacaoExpurgo,
          p_justificativa: justificativa,
        },
      );

      if (error) {
        throw new Error(
          formatarErroSupabase(
            error,
            'Não foi possível expurgar a Etapa de teste.',
          ),
        );
      }
    },
    [],
  );

  return {
    obterResumoExpurgo,
    expurgarEtapaTeste,
  };
};
