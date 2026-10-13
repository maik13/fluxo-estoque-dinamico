import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type Options = {
  enabled: boolean;
};

export const useSolicitacoesCotacaoPendentes = ({ enabled }: Options) => {
  const [pendentesCount, setPendentesCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const previousCountRef = useRef<number | null>(null);

  const carregarPendentes = useCallback(async (notificarAumento: boolean) => {
    if (!enabled) {
      previousCountRef.current = null;
      setPendentesCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { count, error } = await (supabase.from as any)('cotacao_solicitacoes')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'solicitada');

      if (error) throw error;

      const atual = count ?? 0;
      const anterior = previousCountRef.current;
      setPendentesCount(atual);

      if (notificarAumento && anterior !== null && atual > anterior) {
        const novas = atual - anterior;
        toast.info(
          novas === 1 ? 'Nova solicitação de orçamento' : `${novas} novas solicitações de orçamento`,
          {
            description: `${atual} ${atual === 1 ? 'solicitação aguarda' : 'solicitações aguardam'} atendimento do Almoxarifado.`,
            duration: 8000,
          },
        );
      }

      previousCountRef.current = atual;
    } catch (error) {
      console.error('Erro ao carregar solicitações de orçamento pendentes:', error);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    previousCountRef.current = null;

    if (!enabled) {
      setPendentesCount(0);
      setLoading(false);
      return;
    }

    void carregarPendentes(false);

    const channel = supabase
      .channel('solicitacoes-cotacao-pendentes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cotacao_solicitacoes',
        },
        () => {
          void carregarPendentes(true);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, carregarPendentes]);

  return {
    pendentesCount,
    loading,
    recarregar: () => carregarPendentes(false),
  };
};
