// Service Worker do mensageiro

self.addEventListener('push', function(event) {
  if (!event.data) return;

  event.waitUntil((async () => {
    let data = {};
    try {
      data = event.data.json();
    } catch {
      data = { body: event.data.text() };
    }

    const threadId = data.threadId || null;
    const targetPath = data.url && data.url !== '/'
      ? data.url
      : (threadId
        ? '/?tab=mensagens&thread=' + encodeURIComponent(threadId)
        : '/?tab=mensagens');

    const windowClients = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    // Só suprime a notificação do sistema quando a própria janela do Fluxo está em foco.
    const appFocused = windowClients.some((client) => client.focused === true);
    if (appFocused) {
      return;
    }

    const title = data.title || 'Nova mensagem';
    const options = {
      body: data.body || 'Você recebeu uma nova mensagem.',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: threadId ? 'mensagem-' + threadId : 'mensagem-nova',
      renotify: true,
      data: {
        url: targetPath,
        threadId,
      },
    };

    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  event.waitUntil((async () => {
    const data = event.notification.data || {};
    const threadId = data.threadId || null;
    const targetPath = data.url && data.url !== '/'
      ? data.url
      : (threadId
        ? '/?tab=mensagens&thread=' + encodeURIComponent(threadId)
        : '/?tab=mensagens');
    const targetUrl = new URL(targetPath, self.location.origin).href;

    const windowClients = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    for (const client of windowClients) {
      if (!client.url.startsWith(self.location.origin)) continue;

      client.postMessage({
        type: 'OPEN_MESSAGES',
        threadId,
      });

      if ('focus' in client) {
        await client.focus();
      }
      return;
    }

    if (clients.openWindow) {
      await clients.openWindow(targetUrl);
    }
  })());
});
