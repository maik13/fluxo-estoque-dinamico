# Mensageiro e notificações do app

## Objetivo

Implementar e manter no app um mensageiro interno com comportamento semelhante ao WhatsApp:

- Conversa única entre dois usuários.
- Identificação clara de quem enviou cada mensagem.
- Atualização da conversa sem precisar fechar e abrir o app.
- Notificação push no celular quando o app estiver fechado ou em segundo plano.
- Alerta visual e sonoro no computador quando a tela estiver aberta.

## Problemas observados

### 1. Remetente aparecendo como "Usuário"

Em alguns casos, a tela de mensagens recebia um `sender_id`, `viewer_id` ou `recipient_id` que não batia diretamente com o campo usado para buscar o nome na tabela `profiles`.

O banco possui dois identificadores importantes:

- `profiles.id`: ID interno da linha do perfil.
- `profiles.user_id`: ID real do usuário autenticado no Supabase Auth.

As mensagens, inscrições push e funções de envio devem trabalhar com `profiles.user_id`. Quando a tela tentava resolver o nome usando apenas `profiles.id`, o nome não era encontrado e o fallback exibido era "Usuário".

### 2. Mensagem demorando ou aparecendo só após reabrir o app

Foram encontradas conversas duplicadas entre os mesmos usuários. Exemplo:

- Conversa A: Master -> Ju.
- Conversa B: Ju -> Master.

Com isso, um usuário podia estar visualizando uma conversa enquanto a nova mensagem entrava em outra. A sensação era de atraso, porque a mensagem só aparecia depois que o app recarregava e reorganizava a lista.

Além disso, navegadores móveis e PWAs podem suspender conexões realtime em segundo plano. Por isso, o app não deve depender apenas do realtime para atualizar mensagens.

### 3. Push sem entrega aparente

A permissão de notificação no celular não é suficiente sozinha. Para receber push, o app precisa ter uma inscrição válida salva na tabela `push_subscriptions`, vinculada ao `user_id` correto.

Se a conversa aponta para `profiles.id`, mas a inscrição push está salva para `profiles.user_id`, a Edge Function procura no ID errado e não encontra destinatário.

## Modelo correto

### Tabela `profiles`

Usar `profiles.user_id` como identificador funcional do usuário nas mensagens.

### Tabela `viewer_message_threads`

Os campos abaixo devem guardar IDs de usuário do Auth, ou seja, `profiles.user_id`:

- `viewer_id`
- `created_by`
- `recipient_id`

### Tabela `viewer_thread_messages`

O campo abaixo também deve guardar o ID do Auth:

- `sender_id`

### Tabela `push_subscriptions`

Cada inscrição push deve ser salva com:

- `user_id`: ID do Auth.
- `endpoint`: endpoint único do navegador/celular.
- `subscription`: objeto completo retornado pelo Push API.

Deve existir índice único para evitar duplicidade:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_id_endpoint_idx
ON public.push_subscriptions (user_id, endpoint);
```

## Comportamento esperado

### Conversa

Quando um usuário abre mensagens:

1. O app carrega as conversas onde o usuário atual participa.
2. Conversas entre os mesmos dois usuários são tratadas como uma única conversa.
3. A lista mostra o nome do outro participante.
4. Ao abrir uma conversa, as mensagens aparecem em ordem cronológica.
5. Mensagens do usuário atual ficam à direita.
6. Mensagens do outro usuário ficam à esquerda com o nome do remetente.
7. A caixa de digitação fica fixa na parte inferior da conversa.
8. Novas mensagens sobem dentro da área rolável, sem empurrar a caixa de digitação para baixo.

### Atualização em tempo real

Enquanto a tela está aberta:

1. O app escuta inserts em `viewer_thread_messages` via Supabase Realtime.
2. Quando chega uma nova mensagem da conversa aberta, a conversa é recarregada.
3. Quando chega mensagem em outra conversa, a lista de conversas é atualizada.
4. Se a mensagem for de outro usuário, tocar alerta sonoro e exibir toast.

Como reforço para celular/PWA:

1. Ao voltar o app para o foco, recarregar conversas e mensagens.
2. Enquanto a tela estiver visível, fazer uma checagem leve periódica.
3. Isso reduz falhas quando o navegador suspende o realtime.

### Push

Quando uma mensagem é enviada:

1. O front chama a RPC para inserir a mensagem.
2. O front chama a Edge Function `push-notification`.
3. A Edge Function identifica a conversa.
4. A função descobre quem é o outro participante.
5. A função normaliza qualquer ID antigo para `profiles.user_id`.
6. A função busca inscrições em `push_subscriptions`.
7. A função envia a notificação para os endpoints encontrados.
8. Endpoints expirados devem ser removidos quando o provedor retornar `404` ou `410`.

## Implementação no front-end

Arquivo principal:

```text
src/components/gestao-estoque/Mensagens.tsx
```

### Resolver nomes de usuários

Criar uma função auxiliar para buscar nomes tanto por `profiles.user_id` quanto por `profiles.id`, garantindo compatibilidade com dados antigos.

Regras:

- Primeiro tentar por `user_id`.
- Para IDs não encontrados, tentar por `id`.
- Guardar os dois IDs no mapa de nomes.
- Fallback "Usuário" só deve acontecer se o perfil realmente não existir.

### Destinatários

Ao listar destinatários para nova conversa:

- Buscar `id,user_id,nome,email,tipo_usuario`.
- Excluir o usuário atual por `user_id`.
- Usar `profile.user_id` como `selectedRecipientId`.

### Atualização da conversa

Adicionar:

- Realtime em `viewer_thread_messages`.
- Recarregamento ao foco da janela.
- Recarregamento ao `visibilitychange`.
- Intervalo leve enquanto a tela estiver visível.

### Layout

A estrutura da tela deve ter:

- Container principal com altura fixa relativa à viewport.
- Área de mensagens com `overflow-y-auto`.
- Composer com `shrink-0` no rodapé.
- Scroll automático para o final quando chegam mensagens.

## Implementação no banco

### Normalizar conversas existentes

Criar migration para converter `profiles.id` para `profiles.user_id` nos campos:

- `viewer_message_threads.viewer_id`
- `viewer_message_threads.created_by`
- `viewer_message_threads.recipient_id`

### Mesclar conversas duplicadas

Para cada par de usuários, manter uma conversa canônica e mover mensagens das duplicadas para ela.

Critério recomendado:

- Manter a conversa com `updated_at` mais recente.
- Atualizar `viewer_thread_messages.thread_id` das duplicadas.
- Atualizar `last_message` e `updated_at` da conversa canônica.
- Remover threads duplicadas vazias.

### Evitar novas duplicações

Atualizar a função `start_user_message_thread` para:

1. Normalizar `p_recipient_id` para `profiles.user_id`.
2. Procurar conversa existente entre o remetente e destinatário.
3. Se existir, reutilizar.
4. Se não existir, criar nova.
5. Inserir a mensagem na conversa correta.

## Edge Function

Arquivo:

```text
supabase/functions/push-notification/index.ts
```

### Regras

A função deve:

1. Receber `thread_id` e `sender_id`.
2. Buscar a conversa.
3. Normalizar `sender_id`, `recipient_id`, `created_by` e `viewer_id` para `profiles.user_id`.
4. Identificar o outro participante.
5. Buscar inscrições push do destinatário.
6. Enviar notificação.
7. Remover inscrições inválidas.

### Payload recomendado

```json
{
  "title": "Nova mensagem",
  "body": "Você recebeu uma nova mensagem no almoxarifado.",
  "url": "/"
}
```

Fase futura: incluir nome do remetente e trecho da mensagem no push:

```json
{
  "title": "Mensagem de Master Admin",
  "body": "teste",
  "url": "/"
}
```

## Service Worker

Arquivo:

```text
public/sw.js
```

Responsabilidades:

- Ouvir evento `push`.
- Exibir notificação com `showNotification`.
- Ao clicar, abrir ou focar o app.

## Testes obrigatórios

### Teste 1: nome do remetente

1. Master envia mensagem para Ju.
2. Ju abre a conversa no celular.
3. A mensagem recebida deve mostrar "Master Admin" ou o nome configurado do Master.
4. Não deve aparecer "Usuário".

### Teste 2: conversa única

1. Master envia mensagem para Ju.
2. Ju responde.
3. As duas mensagens devem aparecer na mesma conversa.
4. A lista lateral não deve criar duas conversas para o mesmo par.

### Teste 3: realtime com app aberto

1. Ju deixa a conversa aberta no celular.
2. Master envia uma mensagem.
3. A mensagem deve aparecer sem fechar e abrir o app.
4. Pode haver pequeno atraso, mas não deve exigir recarregar manualmente.

### Teste 4: foco do app

1. Ju deixa o app em segundo plano.
2. Master envia uma mensagem.
3. Ju volta ao app.
4. A conversa deve atualizar automaticamente.

### Teste 5: push

1. Ju fecha o app ou deixa em segundo plano.
2. Master envia mensagem.
3. O celular da Ju deve receber push.
4. Repetir no sentido Ju -> Master.

### Teste 6: inscrição push

Validar no Supabase:

```sql
SELECT ps.user_id, p.nome, p.email, ps.created_at, ps.endpoint
FROM public.push_subscriptions ps
LEFT JOIN public.profiles p ON p.user_id = ps.user_id
ORDER BY ps.created_at DESC;
```

Ju e Master devem aparecer com `user_id` correto.

## Checklist de publicação

1. Rodar build:

```bash
npm run build
```

2. Aplicar migrations no Supabase.

3. Republicar Edge Function:

```bash
npx supabase functions deploy push-notification --project-ref zhnmblqzvvicqzkzqvrb
```

4. Publicar front-end.

5. No celular, fechar e abrir o app uma vez para carregar a nova versão.

6. Testar envio nos dois sentidos.

## Observações importantes

- Permissão de notificação no celular não garante push se não existir inscrição válida em `push_subscriptions`.
- PWA no celular pode suspender realtime. Por isso o app deve ter fallback por foco e checagem periódica.
- O identificador padrão para mensagens e push deve ser sempre `profiles.user_id`.
- Conversas duplicadas entre o mesmo par de usuários causam atraso aparente e mensagens separadas.
