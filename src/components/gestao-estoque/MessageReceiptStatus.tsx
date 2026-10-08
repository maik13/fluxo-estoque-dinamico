import { useCallback, useEffect, useState } from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type Props = {
  threadId: string;
  messageId: string;
};

type Status = 'sent' | 'delivered' | 'read';

export function MessageReceiptStatus({ threadId, messageId }: Props) {
  const [status, setStatus] = useState<Status>('sent');

  const carregar = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc('listar_recibos_thread_v1', {
      p_thread_id: threadId,
    });
    if (error) {
      console.error('Erro ao carregar recibo da mensagem:', error);
      return;
    }

    const receipt = (data || []).find((row: any) => row.message_id === messageId);
    if (receipt?.read_at) setStatus('read');
    else if (receipt?.delivered_at) setStatus('delivered');
    else setStatus('sent');
  }, [threadId, messageId]);

  useEffect(() => {
    void carregar();

    const channel = supabase
      .channel('recibo-' + messageId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'viewer_message_receipts' },
        () => void carregar(),
      )
      .subscribe();

    const fallback = window.setInterval(() => void carregar(), 5000);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(fallback);
    };
  }, [carregar, messageId]);

  if (status === 'read') {
    return <CheckCheck className="h-3.5 w-3.5 text-sky-300" aria-label="Visualizado" />;
  }

  if (status === 'delivered') {
    return <CheckCheck className="h-3.5 w-3.5" aria-label="Entregue" />;
  }

  return <Check className="h-3.5 w-3.5" aria-label="Enviado" />;
}
