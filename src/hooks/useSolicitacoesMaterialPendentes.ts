import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';

type UseSolicitacoesMaterialPendentesOptions = {
  enabled: boolean;
};

export const useSolicitacoesMaterialPendentes = ({
  enabled,
}: UseSolicitacoesMaterialPendentesOptions) => {
  const [pendentesCount, setPendentesCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { estoqueAtivo } = useConfiguracoes();
  const previousCountRef = useRef<number | null>(null);

  const carregarPendentes = useCallback(
    async (notificarAumento: boolean) => {
      if (!enabled) {
        previousCountRef.current = null;
        setPendentesCount(0);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        let query = supabase
          .from('solicitacoes_material')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pendente');

        if (estoqueAtivo) {
          query = query.eq('estoque_id', estoqueAtivo);
        }

        const { count, error } = await query;
        if (error) throw error;

        const atual = count ?? 0;
        const anterior = previousCountRef.current;

        setPendentesCount(atual);

        if (notificarAumento && anterior !== null && atual > anterior) {
          const novas = atual - anterior;
          toast.info(
            novas === 1 ? 'Nova solicitação de material' : `${novas} novas solicitações de material`,
            {
              description: `${atual} ${atual === 1 ? 'requisição pendente' : 'requisições pendentes'} no almoxarifado atual.`,
            },
          );
        }

        previousCountRef.current = atual;
      } catch (error) {
        console.error('Erro ao carregar solicitações de material pendentes:', error);
      } finally {
        setLoading(false);
      }
    },
    [enabled, estoqueAtivo],
  );

  useEffect(() => {
    previousCountRef.current = null;

    if (!enabled) {
      setPendentesCount(0);
      setLoading(false);
      return;
    }

    void carregarPendentes(false);

    const filter = estoqueAtivo ? `estoque_id=eq.${estoqueAtivo}` : undefined;
    const channel = supabase
      .channel(`solicitacoes-material-pendentes-${estoqueAtivo ?? 'todos'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'solicitacoes_material',
          filter,
        },
        () => {
          void carregarPendentes(true);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, estoqueAtivo, carregarPendentes]);

  return {
    pendentesCount,
    loading,
    recarregar: () => carregarPendentes(false),
  };
};
