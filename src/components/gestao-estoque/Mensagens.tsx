import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Loader2, MessageCircle, Send, Paperclip, Bell, BellRing } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRef } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";

interface ViewerThread {
  id: string;
  viewer_id: string;
  created_by?: string;
  recipient_id?: string | null;
  requested_date: string | null;
  created_at: string;
  updated_at: string;
  viewer_name?: string;
  creator_name?: string;
  recipient_name?: string;
  display_name?: string;
  last_message?: string;
}

interface ViewerMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  sender_name?: string;
}

interface MessageRecipient {
  id: string;
  name: string;
  email?: string | null;
  role?: string | null;
}

export function Mensagens() {
  const { user } = useAuth();
  const userId = user?.id;
  const { isAdmin, isGestor } = usePermissions();
  const canChooseMessageRecipient = isAdmin() || isGestor();

  const [messageDate, setMessageDate] = useState(new Date().toISOString().split('T')[0]);
  const [messageText, setMessageText] = useState("");
  const [replyText, setReplyText] = useState("");
  const [threadSearchTerm, setThreadSearchTerm] = useState("");
  const [isComposingNewThread, setIsComposingNewThread] = useState(false);
  const [selectedRecipientId, setSelectedRecipientId] = useState("");
  const [recipientSearchTerm, setRecipientSearchTerm] = useState("");
  const [messageRecipients, setMessageRecipients] = useState<MessageRecipient[]>([]);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [threads, setThreads] = useState<ViewerThread[]>([]);
  const [messages, setMessages] = useState<ViewerMessage[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const fetchThreads = async () => {
    if (!userId) return;

    setIsLoadingThreads(true);
    try {
      let query = (supabase as any)
        .from("viewer_message_threads")
        .select("*")
        .order("updated_at", { ascending: false });

      if (!canChooseMessageRecipient) {
        query = query.eq("viewer_id", userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const loadedThreads = (data || []) as ViewerThread[];
      const participantIds = Array.from(new Set(
        loadedThreads.flatMap((thread) => [
          thread.viewer_id,
          thread.created_by,
          thread.recipient_id,
        ]).filter(Boolean)
      ));
      const profileMap = new Map<string, string>();

      if (participantIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id,nome,email")
          .in("id", participantIds);

        (profiles || []).forEach((profile: any) => {
          profileMap.set(profile.id, profile.nome || profile.email || "Usuário");
        });
      }

      const threadIds = loadedThreads.map((thread) => thread.id);
      const lastMessageMap = new Map<string, string>();

      if (threadIds.length > 0) {
        const { data: allMessages } = await (supabase as any)
          .from("viewer_thread_messages")
          .select("thread_id,message,created_at")
          .in("thread_id", threadIds)
          .order("created_at", { ascending: false });

        (allMessages || []).forEach((message: any) => {
          if (!lastMessageMap.has(message.thread_id)) {
            lastMessageMap.set(message.thread_id, message.message);
          }
        });
      }

      const nextThreads = loadedThreads.map((thread) => ({
        ...thread,
        viewer_name: profileMap.get(thread.viewer_id) || "Usuário",
        creator_name: thread.created_by ? profileMap.get(thread.created_by) : undefined,
        recipient_name: thread.recipient_id ? profileMap.get(thread.recipient_id) : undefined,
        display_name: thread.recipient_id
          ? profileMap.get(thread.created_by === userId ? thread.recipient_id : thread.created_by || thread.viewer_id)
          : canChooseMessageRecipient
            ? profileMap.get(thread.viewer_id) || "Usuário"
            : "Gestão / Coordenação",
        last_message: lastMessageMap.get(thread.id) || "",
      }));

      setThreads(nextThreads);
      
      if (!selectedThreadId && nextThreads.length > 0) {
        setSelectedThreadId(nextThreads[0].id);
        setIsComposingNewThread(false);
      } else if (nextThreads.length === 0) {
        setIsComposingNewThread(true);
      }
    } catch (error: any) {
      console.error("Erro ao carregar conversas:", error);
      const message = String(error?.message || "");
      if (message.includes("viewer_message_threads")) {
        toast.error("A estrutura de conversas ainda não foi aplicada no banco.");
      } else {
        toast.error("Erro ao carregar conversas");
      }
    } finally {
      setIsLoadingThreads(false);
    }
  };

  const fetchThreadMessages = async () => {
    if (!selectedThreadId) {
      setMessages([]);
      return;
    }

    setIsLoadingMessages(true);
    try {
      const { data, error } = await (supabase as any)
        .from("viewer_thread_messages")
        .select("*")
        .eq("thread_id", selectedThreadId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const loadedMessages = (data || []) as ViewerMessage[];
      const senderIds = Array.from(new Set(loadedMessages.map((message) => message.sender_id)));
      const profileMap = new Map<string, string>();

      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id,nome,email")
          .in("id", senderIds);

        (profiles || []).forEach((profile: any) => {
          profileMap.set(profile.id, profile.nome || profile.email || "Usuário");
        });
      }

      setMessages(
        loadedMessages.map((message) => ({
          ...message,
          sender_name: profileMap.get(message.sender_id) || "Usuário",
        }))
      );
    } catch (error) {
      console.error("Erro ao carregar mensagens:", error);
      toast.error("Erro ao carregar mensagens da conversa");
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    fetchThreads();

    const handleNewMessage = async (payload: any) => {
      try {
        if (payload.new.thread_id === selectedThreadId) {
          await fetchThreadMessages();
        }
        await fetchThreads();
      } catch (error) {
        console.error("Erro no processamento da mensagem realtime:", error);
      }
    };

    const threadSubscription = supabase
      .channel('public:viewer_thread_messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'viewer_thread_messages' },
        handleNewMessage
      )
      .subscribe();

    if ('Notification' in window && 'serviceWorker' in navigator) {
      setPushEnabled(Notification.permission === 'granted');
    }

    return () => {
      threadSubscription.unsubscribe();
    };
  }, [selectedThreadId, isComposingNewThread, user]);

  const handleSubscribePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast.error('Seu navegador não suporta notificações Push.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Permissão para notificações foi negada.');
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
          .replace(/\-/g, '+')
          .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      };

      const publicVapidKey = 'BAJaTusXeN97bOB7m38jSAAgu0kR-VMTk3xEU6Zw0MV6vL1NsQtoPCrbm7qz7hX8q0HTK8bt5QB00DLP5IJt-H4';
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
      });

      const { error } = await supabase
        .from('push_subscriptions')
        .insert({
          user_id: user?.id,
          subscription: JSON.parse(JSON.stringify(subscription))
        });

      if (error) {
        if (error.code === '42P01') {
          toast.error('Tabela push_subscriptions não encontrada. Configure o Supabase.');
        } else {
           throw error;
        }
      } else {
        setPushEnabled(true);
        toast.success('Notificações ativadas com sucesso!');
      }

    } catch (error: any) {
      console.error('Erro ao ativar notificações:', error);
      toast.error('Não foi possível ativar as notificações.');
    }
  };

  useEffect(() => {
    fetchThreadMessages();
  }, [selectedThreadId]);

  useEffect(() => {
    if (selectedThreadId) return;
    setIsComposingNewThread(true);
  }, [selectedThreadId]);

  const fetchMessageRecipients = async () => {
    if (!userId || !canChooseMessageRecipient) return;

    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id,nome,email,tipo_usuario")
        .neq("id", userId);

      if (profilesError) throw profilesError;

      setMessageRecipients((profiles || [])
        .map((profile: any) => ({
          id: profile.id,
          name: profile.nome || profile.email || "Usuário",
          email: profile.email,
          role: profile.tipo_usuario || null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
    } catch (error) {
      console.error("Erro ao carregar destinatários:", error);
      toast.error("Erro ao carregar usuários para mensagem");
    }
  };

  useEffect(() => {
    fetchMessageRecipients();
  }, [userId, canChooseMessageRecipient]);

  const handleSendMessage = async () => {
    const trimmedMessage = messageText.trim();

    if (!trimmedMessage) {
      toast.error("Digite a mensagem antes de enviar");
      return;
    }

    if (canChooseMessageRecipient && !selectedRecipientId) {
      toast.error("Selecione para quem enviar");
      return;
    }

    setIsSendingMessage(true);
    try {
      if (canChooseMessageRecipient) {
        const { data: threadId, error } = await (supabase as any).rpc("start_user_message_thread", {
          p_recipient_id: selectedRecipientId,
          p_message: trimmedMessage,
          p_requested_date: messageDate || null,
        });

        if (error) throw error;

        if (threadId) {
          supabase.functions.invoke('rapid-service', {
            body: { record: { thread_id: threadId, sender_id: userId } }
          }).catch(console.error);
        }

        setMessageText("");
        setSelectedRecipientId("");
        setRecipientSearchTerm("");
        setIsComposingNewThread(false);
        await fetchThreads();
        if (threadId) setSelectedThreadId(threadId);
        return;
      }

      const { data: newThreadId, error } = await (supabase as any).rpc("send_visualizador_message", {
        p_message: trimmedMessage,
        p_requested_date: messageDate || null,
      });

      if (error) {
        throw error;
      }

      if (newThreadId && typeof newThreadId === 'string') {
        supabase.functions.invoke('rapid-service', {
          body: { record: { thread_id: newThreadId, sender_id: userId } }
        }).catch(console.error);
      }

      toast.success("Mensagem enviada com sucesso.");
      setMessageText("");
      await fetchThreads();
      setIsComposingNewThread(false);
    } catch (error: any) {
      console.error("Erro ao enviar mensagem:", error);
      toast.error(error?.message || "Erro ao enviar mensagem");
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleSendReply = async () => {
    const trimmedReply = replyText.trim();

    if (!selectedThreadId) {
      toast.error("Selecione uma conversa");
      return;
    }

    if (!trimmedReply) {
      toast.error("Digite uma resposta antes de enviar");
      return;
    }

    setIsSendingMessage(true);
    try {
      const { error } = await (supabase as any).rpc("send_visualizador_thread_message", {
        p_thread_id: selectedThreadId,
        p_message: trimmedReply,
      });

      if (error) throw error;

      supabase.functions.invoke('rapid-service', {
        body: { record: { thread_id: selectedThreadId, sender_id: userId } }
      }).catch(console.error);

      setReplyText("");
      await fetchThreads();
      await fetchThreadMessages();
    } catch (error: any) {
      console.error("Erro ao responder conversa:", error);
      toast.error(error?.message || "Erro ao responder conversa");
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tamanho (máx 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('O arquivo deve ter no máximo 10MB');
      return;
    }

    setIsUploadingFile(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('product-photos') // Usando o bucket existente
        .upload(`anexos/${fileName}`, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-photos')
        .getPublicUrl(`anexos/${fileName}`);

      const attachmentText = `\n[Anexo: ${file.name}](${publicUrl})`;
      
      if (isComposingNewThread) {
        setMessageText(prev => prev + attachmentText);
      } else {
        setReplyText(prev => prev + attachmentText);
      }
      
      toast.success('Arquivo anexado com sucesso!');
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast.error('Erro ao enviar arquivo');
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const formatMessageContent = (text: string) => {
    const linkRegex = /\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      parts.push(
        <a 
          key={match.index} 
          href={match[2]} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="font-bold underline hover:opacity-80 transition-opacity"
          style={{ color: 'inherit' }}
        >
          📎 {match[1]}
        </a>
      );
      lastIndex = linkRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) || null;
  const filteredThreads = threads.filter((thread) => {
    const search = threadSearchTerm.trim().toLowerCase();
    if (!search) return true;

    return (
      thread.viewer_name?.toLowerCase().includes(search) ||
      thread.last_message?.toLowerCase().includes(search) ||
      thread.requested_date?.includes(search)
    );
  });

  const filteredMessageRecipients = recipientSearchTerm.trim().length < 2
    ? []
    : messageRecipients
        .filter((recipient) => {
          const search = recipientSearchTerm.trim().toLowerCase();
          return (
            recipient.name.toLowerCase().includes(search) ||
            recipient.email?.toLowerCase().includes(search)
          );
        })
        .slice(0, 8);

  return (
    <div className="grid min-h-[calc(100dvh-15rem)] overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-[320px_minmax(0,1fr)] shadow-sm">
      <aside className="flex min-h-[400px] flex-col border-b border-border lg:border-b-0 lg:border-r bg-muted/10">
        <div className="border-b border-border p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Conversas
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary"
                onClick={handleSubscribePush}
                title={pushEnabled ? "Notificações ativadas" : "Ativar notificações Push"}
              >
                {pushEnabled ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              </Button>
              {!isComposingNewThread && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-xs font-medium"
                  onClick={() => {
                    setSelectedThreadId(null);
                    setIsComposingNewThread(true);
                  }}
                >
                  Nova
                </Button>
              )}
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={threadSearchTerm}
              onChange={(event) => setThreadSearchTerm(event.target.value)}
              placeholder="Pesquisar conversa..."
              className="h-10 w-full rounded-full border border-border bg-background pl-9 pr-4 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {isLoadingThreads ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <MessageCircle className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">Nenhuma conversa</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Inicie uma nova conversa para começar.
                </p>
              </div>
            ) : (
              filteredThreads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => {
                    setSelectedThreadId(thread.id);
                    setIsComposingNewThread(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-all",
                    selectedThreadId === thread.id && !isComposingNewThread 
                      ? "bg-primary/10 border border-primary/20" 
                      : "hover:bg-muted border border-transparent"
                  )}
                >
                  <div className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-primary font-bold",
                    selectedThreadId === thread.id && !isComposingNewThread ? "bg-primary/20" : "bg-primary/10"
                  )}>
                    {(thread.display_name || (canChooseMessageRecipient ? thread.viewer_name : "G"))?.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {thread.display_name || (canChooseMessageRecipient ? thread.viewer_name : "Gestão")}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground font-medium">
                        {new Date(thread.updated_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {thread.last_message || "Conversa iniciada"}
                    </p>
                  </div>
                </button>
              ))
            )}
        </div>
      </aside>

      <section className="flex min-h-[500px] flex-col bg-background/50 relative">
        <header className="flex min-h-16 items-center gap-3 border-b border-border bg-card/80 backdrop-blur-md px-6 sticky top-0 z-10">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-foreground">
              {isComposingNewThread
                ? canChooseMessageRecipient
                  ? "Nova conversa"
                  : "Nova mensagem para a gestão"
                : selectedThread
                  ? selectedThread.display_name || (canChooseMessageRecipient ? selectedThread.viewer_name : "Gestão")
                  : canChooseMessageRecipient
                    ? "Conversas"
                    : "Nova conversa"}
            </h2>
            {(!canChooseMessageRecipient && (isComposingNewThread ? messageDate : selectedThread?.requested_date)) && (
              <p className="text-xs text-muted-foreground">
                Data de Referência: {new Date(`${isComposingNewThread ? messageDate : selectedThread?.requested_date}T00:00:00`).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6" style={{
            backgroundImage: "radial-gradient(hsl(var(--muted-foreground)/0.1) 1px, transparent 1px)",
            backgroundSize: "20px 20px"
        }}>
          {isComposingNewThread ? (
            <div className="flex flex-col h-full items-center justify-center text-center opacity-70">
                <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium text-foreground">Comece uma nova conversa</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-[250px]">
                    {canChooseMessageRecipient 
                        ? "Escolha um destinatário abaixo e digite sua mensagem." 
                        : "Sua mensagem será enviada diretamente para a gestão e administração do almoxarifado."}
                </p>
            </div>
          ) : !selectedThread ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {canChooseMessageRecipient ? "Selecione ou inicie uma conversa" : "Digite sua mensagem abaixo para iniciar a conversa"}
            </div>
            ) : isLoadingMessages ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Nenhuma mensagem encontrada
              </div>
            ) : (
              messages.map((message) => {
                const isOwnMessage = message.sender_id === userId;

                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex",
                      isOwnMessage ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm relative group",
                        isOwnMessage
                          ? "rounded-tr-sm bg-primary text-primary-foreground"
                          : "rounded-tl-sm bg-card border border-border text-foreground"
                      )}
                    >
                      {!isOwnMessage && (
                        <p className="mb-1 text-[11px] font-bold text-primary">
                          {message.sender_name}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap leading-relaxed">{formatMessageContent(message.message)}</p>
                      <div className={cn(
                          "mt-1 text-[10px] font-medium opacity-70 flex items-center justify-end gap-1",
                          isOwnMessage ? "text-primary-foreground/80" : "text-muted-foreground"
                      )}>
                        {new Date(message.created_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
        </div>

        <div className="border-t border-border bg-card/80 backdrop-blur-md p-4 sticky bottom-0 z-10">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv"
          />
          {isComposingNewThread ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                {canChooseMessageRecipient && (
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Label htmlFor="message-recipient" className="shrink-0 text-sm font-medium">
                      Para:
                    </Label>
                    <div className="relative flex-1 sm:min-w-[300px]">
                      <input
                        id="message-recipient"
                        value={recipientSearchTerm}
                        onChange={(event) => {
                          setRecipientSearchTerm(event.target.value);
                          setSelectedRecipientId("");
                        }}
                        placeholder="Buscar usuário (nome ou email)..."
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
                      />
                      {filteredMessageRecipients.length > 0 && !selectedRecipientId && (
                        <div className="absolute left-0 right-0 bottom-[110%] z-20 overflow-hidden rounded-md border border-border bg-popover shadow-xl max-h-[300px] overflow-y-auto">
                          {filteredMessageRecipients.map((recipient) => (
                            <button
                              key={recipient.id}
                              type="button"
                              onClick={() => {
                                setSelectedRecipientId(recipient.id);
                                setRecipientSearchTerm(recipient.name);
                              }}
                              className="flex flex-col w-full px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent transition-colors"
                            >
                              <span className="font-semibold text-foreground">{recipient.name}</span>
                              {recipient.email && (
                                <span className="text-xs text-muted-foreground">{recipient.email}</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {!canChooseMessageRecipient && (
                  <div className="flex items-center gap-3">
                    <Label htmlFor="message-date" className="shrink-0 text-sm font-medium">
                      Data:
                    </Label>
                    <input
                      id="message-date"
                      type="date"
                      value={messageDate}
                      onChange={(event) => setMessageDate(event.target.value)}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
                    />
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <Textarea
                  id="viewer-message"
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder="Escreva sua mensagem aqui..."
                  className="min-h-[60px] max-h-[150px] resize-y rounded-xl focus-visible:ring-primary/40"
                  onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                      }
                  }}
                />
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingFile}
                    className="h-10 w-10 rounded-xl"
                    title="Anexar arquivo"
                  >
                    {isUploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                  </Button>
                  <Button
                    onClick={handleSendMessage}
                    disabled={isSendingMessage || isUploadingFile}
                    className="h-10 gap-2 px-6 rounded-xl shadow-md hover:shadow-lg transition-all"
                  >
                    {isSendingMessage ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                    <span className="hidden sm:inline font-semibold">Enviar</span>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <Textarea
                value={replyText}
                onChange={(event) => setReplyText(event.target.value)}
                placeholder="Escreva sua resposta..."
                disabled={!selectedThread || isSendingMessage}
                className="min-h-[60px] max-h-[150px] resize-y rounded-xl focus-visible:ring-primary/40"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendReply();
                    }
                }}
              />
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingFile || !selectedThread}
                  className="h-10 w-10 rounded-xl"
                  title="Anexar arquivo"
                >
                  {isUploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                </Button>
                <Button
                  onClick={handleSendReply}
                  disabled={!selectedThread || isSendingMessage || isUploadingFile || (!replyText.trim() && !replyText.includes('[Anexo:'))}
                  className="h-10 gap-2 px-6 rounded-xl shadow-md hover:shadow-lg transition-all"
                >
                  {isSendingMessage ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                  <span className="hidden sm:inline font-semibold">Responder</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
