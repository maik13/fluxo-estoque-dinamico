// public/sw.js

self.addEventListener('push', function(event) {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch (_) {
    data = { body: event.data.text() };
  }

  const title = data.title || 'Nova mensagem';
  const options = {
    body: data.body || 'Você recebeu uma nova mensagem.',
    icon: data.icon || '/vite.svg',
    badge: data.badge || '/vite.svg',
    tag: data.tag || ('mensagem-' + (data.threadId || 'nova')),
    renotify: true,
    data: {
      url: data.url || '/?tab=mensagens',
      threadId: data.threadId || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl = new URL(data.url || '/?tab=mensagens', self.location.origin).href;
  const threadId = data.threadId || new URL(targetUrl).searchParams.get('thread');

  event.waitUntil((async function() {
    const windowClients = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    const sameOriginClient = windowClients.find((client) => {
      try {
        return new URL(client.url).origin === self.location.origin;
      } catch (_) {
        return false;
      }
    });

    if (sameOriginClient) {
      sameOriginClient.postMessage({
        type: 'OPEN_MESSAGES',
        threadId,
      });

      if ('focus' in sameOriginClient) {
        await sameOriginClient.focus();
      }
      return;
    }

    if (clients.openWindow) {
      await clients.openWindow(targetUrl);
    }
  })());
});
