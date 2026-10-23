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
  const carregandoRef = useRef(false);

  const carregarPendentes = useCallback(async (notificarAumento: boolean) => {
    if (!enabled) {
      previousCountRef.current = null;
      setPendentesCount(0);
      setLoading(false);
      return;
    }

    // Realtime, foco da janela e o evento local podem ocorrer juntos. Uma única
    // consulta é suficiente e evita contagens concorrentes fora de ordem.
    if (carregandoRef.current) return;
    carregandoRef.current = true;

    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc(
        'contar_solicitacoes_cotacao_pendentes_v1',
      );

      if (error) throw error;

      const atual = Number(data ?? 0);
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
      carregandoRef.current = false;
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cotacoes' },
        () => void carregarPendentes(false),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cotacao_solicitacoes_vinculos' },
        () => void carregarPendentes(false),
      )
      .subscribe();

    const atualizarPorEventoLocal = () => void carregarPendentes(true);
    const atualizarAoRetomar = () => {
      if (document.visibilityState === 'visible') void carregarPendentes(false);
    };

    // O aviso não depende apenas do Realtime: permanece correto após retorno à
    // aba, criação no mesmo navegador e eventuais interrupções de conexão.
    window.addEventListener('cotacao-solicitacao-criada', atualizarPorEventoLocal);
    window.addEventListener('cotacao-solicitacao-atualizada', atualizarPorEventoLocal);
    window.addEventListener('focus', atualizarAoRetomar);
    document.addEventListener('visibilitychange', atualizarAoRetomar);
    const polling = window.setInterval(() => void carregarPendentes(false), 30_000);

    return () => {
      window.removeEventListener('cotacao-solicitacao-criada', atualizarPorEventoLocal);
      window.removeEventListener('cotacao-solicitacao-atualizada', atualizarPorEventoLocal);
      window.removeEventListener('focus', atualizarAoRetomar);
      document.removeEventListener('visibilitychange', atualizarAoRetomar);
      window.clearInterval(polling);
      void supabase.removeChannel(channel);
    };
  }, [enabled, carregarPendentes]);

  return {
    pendentesCount,
    loading,
    recarregar: () => carregarPendentes(false),
  };
};
