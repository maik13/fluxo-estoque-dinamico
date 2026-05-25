import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import webPush from "npm:web-push"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Chaves VAPID geradas pelo Antigravity
const VAPID_PUBLIC_KEY = "BAJaTusXeN97bOB7m38jSAAgu0kR-VMTk3xEU6Zw0MV6vL1NsQtoPCrbm7qz7hX8q0HTK8bt5QB00DLP5IJt-H4";
const VAPID_PRIVATE_KEY = "XiH-ixQanmplGnP-Rs8TYkT6jvjSsORL8MZRhf-4Yjc";
const SUBJECT = "mailto:admin@almoxarifado.com";

webPush.setVapidDetails(SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

serve(async (req) => {
  try {
    const payload = await req.json();
    
    const message = payload.record;
    if (!message) {
      return new Response("Nenhum registro encontrado", { status: 400 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const resolveAuthUserId = async (id?: string | null) => {
      if (!id) return null;

      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .or(`user_id.eq.${id},id.eq.${id}`)
        .maybeSingle();

      return profile?.user_id || id;
    };

    const { data: thread } = await supabase
      .from('viewer_message_threads')
      .select('created_by, recipient_id, viewer_id')
      .eq('id', message.thread_id)
      .single();

    if (!thread) return new Response("Thread nao encontrada", { status: 404 });

    const senderId = await resolveAuthUserId(message.sender_id);
    const recipientId = await resolveAuthUserId(thread.recipient_id);
    const createdBy = await resolveAuthUserId(thread.created_by);
    const viewerId = await resolveAuthUserId(thread.viewer_id);
    let targetUserId = null;

    if (recipientId && senderId !== recipientId) {
      targetUserId = recipientId;
    } else if (createdBy && senderId !== createdBy) {
      targetUserId = createdBy;
    } else if (viewerId && senderId !== viewerId) {
      targetUserId = viewerId;
    }

    if (!targetUserId) {
      return new Response("Nenhum destinatario elegivel", { status: 200 });
    }

    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', targetUserId);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response("Usuario nao tem inscricoes push", { status: 200 });
    }

    const notificationPayload = JSON.stringify({
      title: 'Nova Mensagem',
      body: 'Voce recebeu uma nova mensagem no almoxarifado.',
      url: '/'
    });

    const sendPromises = subscriptions.map(async (sub) => {
      try {
        await webPush.sendNotification(sub.subscription, notificationPayload);
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        } else {
          console.error("Erro ao enviar push:", err);
        }
      }
    });

    await Promise.all(sendPromises);

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("Erro no Edge Function:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
})
