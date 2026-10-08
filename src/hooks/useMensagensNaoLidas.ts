import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const tocarSomMensagem = () => {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    oscillator.frequency.setValueAtTime(660, context.currentTime + 0.12);
    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.28);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.3);
  } catch (error) {
    console.error('Erro ao tocar som de mensagem:', error);
  }
};

export function useMensagensNaoLidas() {
  const { user } = useAuth();
  const userId = user?.id;
  const [naoLidas, setNaoLidas] = useState(0);
  const mensagensConhecidasRef = useRef<Set<string>>(new Set());
  const inicializadoRef = useRef(false);

  const carregarNaoLidas = useCallback(async () => {
    if (!userId) {
      setNaoLidas(0);
      return;
    }

    const { data, error } = await (supabase as any).rpc('contar_mensagens_nao_lidas_v1');
    if (error) {
      console.error('Erro ao contar mensagens não lidas:', error);
      return;
    }

    setNaoLidas(Number(data || 0));
  }, [userId]);


  const notificarMensagem = useCallback(async (message: any) => {
    if (!message?.id || mensagensConhecidasRef.current.has(message.id)) return;
    mensagensConhecidasRef.current.add(message.id);

    let senderName = 'Usuário';
    const { data: profile } = await supabase
      .from('profiles')
      .select('nome,email')
      .eq('user_id', message.sender_id)
      .maybeSingle();

    if (profile) senderName = profile.nome || profile.email || senderName;

    const texto = String(message.message || '');
    const resumo = texto.includes('[Áudio:')
      ? 'Mensagem de áudio'
      : texto.includes('[Anexo:')
        ? 'Novo arquivo recebido'
        : texto.slice(0, 140);

    tocarSomMensagem();

    toast.info(`Nova mensagem de ${senderName}`, {
      description: resumo,
      duration: 7000,
      action: {
        label: 'Abrir',
        onClick: () => window.dispatchEvent(new CustomEvent('abrir-mensagens')),
      },
    });

    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted' &&
      document.visibilityState !== 'visible'
    ) {
      new Notification(`Nova mensagem de ${senderName}`, {
        body: resumo,
        tag: `mensagem-${message.thread_id}`,
      });
    }
  }, []);

  const verificarNovasMensagens = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await (supabase as any).rpc('listar_mensagens_nao_lidas_detalhes_v1', {
      p_limite: 50,
    });

    if (error) {
      console.error('Erro ao verificar novas mensagens:', error);
      return;
    }

    const mensagens = data || [];

    if (!inicializadoRef.current) {
      mensagens.forEach((message: any) => mensagensConhecidasRef.current.add(message.id));
      inicializadoRef.current = true;
      return;
    }

    for (const message of [...mensagens].reverse()) {
      await notificarMensagem(message);
    }

    await carregarNaoLidas();
  }, [userId, carregarNaoLidas, notificarMensagem]);

  useEffect(() => {
    void carregarNaoLidas();
    if (!userId) return;

    const handleNewMessage = async (payload: any) => {
      const message = payload.new;
      if (!message?.thread_id || message.sender_id === userId) return;

      const { data: thread, error } = await (supabase as any)
        .from('viewer_message_threads')
        .select('viewer_id,created_by,recipient_id')
        .eq('id', message.thread_id)
        .maybeSingle();

      if (error || !thread) return;

      const participants = [thread.viewer_id, thread.created_by, thread.recipient_id].filter(Boolean);
      if (!participants.includes(userId)) return;

      await carregarNaoLidas();
      await notificarMensagem(message);
    };

    const channel = supabase
      .channel(`mensagens-global-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'viewer_thread_messages' },
        handleNewMessage,
      )
      .subscribe();

    const refresh = () => {
      void carregarNaoLidas();
      void verificarNovasMensagens();
    };
    window.addEventListener('mensagens-nao-lidas-alteradas', refresh);

    void verificarNovasMensagens();
    const fallback = window.setInterval(() => {
      void verificarNovasMensagens();
    }, 4000);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('mensagens-nao-lidas-alteradas', refresh);
      window.clearInterval(fallback);
    };
  }, [userId, carregarNaoLidas, verificarNovasMensagens, notificarMensagem]);

  return {
    naoLidas,
    recarregar: carregarNaoLidas,
  };
}
