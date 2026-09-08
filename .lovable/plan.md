# Auditoria do Supabase externo — resultado e próximo passo

A auditoria somente-leitura foi concluída (nenhuma escrita foi feita). Este documento é o inventário consolidado; o detalhamento completo (lista de FKs com cascatas, políticas por tabela, triggers, campos de delta por tabela) pode ser entregue como arquivo separado no próximo passo, pois o modo atual permite escrever apenas este plano.

## Resumo do inventário

- **Banco**: Postgres 17.6, acessível. 47 tabelas em `public`, nenhuma view, todas com RLS. ~22 mil registros / ~30 MB. Maiores: `movements` 10.095, `solicitacao_itens` 5.863, `items` 2.611, `solicitacoes` 2.049.
- **Estrutura**: 73 FKs (9 apontam para `auth.users`), 105 índices, 40 checks, 6 sequences (`solicitacoes_numero_seq=2049`, `pedidos_compra=38`, `producao_ordem=50`, `producao_processo=19`, `solicitacoes_material=51`).
- **Lógica no banco**: 89 funções (84 SECURITY DEFINER), 45 triggers, 1 enum, extensões `pg_net, pgcrypto, uuid-ossp, pg_stat_statements, vault` (sem pg_cron). Realtime em 13 tabelas.
- **RLS**: 125 políticas em `public` + 18 em storage.
- **Storage**: `product-photos` 1.789 objetos / **285 MB** (público), `branding` 1 objeto, `producao-apontamentos` vazio. 1.771 itens gravam `foto_url` com URL absoluta do projeto atual.
- **Auth**: 15 usuários (provider e-mail), 13 profiles, 2 usuários sem profile, 91 sessões ativas.
- **Edge Functions**: `admin-create-user`, `import-items`, `push-notification` — só usam env padrão do Supabase; `push-notification` tem chave VAPID privada hard-coded no código.
- **Delta incremental**: 27 tabelas com `created_at+updated_at`; 14 append-only com `created_at`; nenhuma tem soft-delete (exclusões não são detectáveis por delta).

## Drift encontrado

- Histórico de migrações do banco (76 versões, última jun/2026) **não bate** com o repositório (152 arquivos, última set/2026): ~60 migrações do repo não constam no banco e vice-versa. O schema real só é confiável lendo o banco vivo.
- RPC `listar_ultima_atualizacao_valor_itens_v1` existe no repo e é usada pelo export Excel, mas **não existe no banco** (feature quebrada hoje).
- Trigger `set_movement_dedupe_key` duplicado em `movements`; políticas de storage do bucket `branding` duplicadas; `import-items` ausente do `config.toml`.

## Riscos principais para migrar sem downtime

1. O projeto está bloqueado por egress: exportar dados/fotos agora pode falhar ou agravar o bloqueio.
2. IDs de `auth.users` precisam ser preservados (9 FKs + snapshots); senhas só migram com dump da tabela de auth.
3. Dupla escrita contínua não é viável (triggers, dedupe temporal, sem soft-delete) → o caminho seguro é **cutover curto**: congelar escrita, carregar delta final, trocar credenciais.
4. `foto_url` e `push_subscriptions` dependem do domínio/chaves antigas — exigem atualização em massa no destino.
5. Triggers devem ficar desabilitados durante a carga e sequences reajustadas depois.

## Não verificado (sem acesso)

Configurações do Auth no dashboard (redirects, SMTP), secrets do painel de Edge Functions, versões deployadas das funções, backups/PITR, cota real de egress e o texto completo de todas as funções/políticas (extraível na fase de execução).

## Próximo passo proposto (requer aprovação)

Preparar o pacote de migração, ainda **sem tocar em produção**:

1. Extrair o DDL do banco vivo (schema, funções, triggers, políticas, publicação Realtime) para um único script revisável, corrigindo os itens de drift (trigger duplicado, RPC faltante, políticas duplicadas).
2. Gerar script de exportação de dados por tabela na ordem de FKs, com marcadores de delta (`created_at/updated_at`) e `setval` das sequences.
3. Definir o procedimento de cutover: janela de congelamento, importação de `auth.users` com IDs/hashes, rewrite de `foto_url`, cópia dos 285 MB de fotos, atualização das Edge Functions (VAPID em secret, `import-items` no config) e troca das credenciais do app.
4. Só depois de revisado, ativar o Lovable Cloud e executar em ambiente paralelo, validando contagens tabela a tabela antes de apontar a produção.

## Detalhes técnicos

- Todas as consultas usadas foram `SELECT` em `pg_class`, `pg_constraint`, `pg_indexes`, `pg_sequences`, `pg_proc`, `pg_trigger`, `pg_policies`, `pg_publication_tables`, `information_schema.columns`, `supabase_migrations.schema_migrations`, `storage.buckets/objects`, `auth.users/identities/sessions` e `count(*)` por tabela.
- Recomendação antes de qualquer extração: regularizar temporariamente o billing do Supabase para liberar egress, ou extrair em partes fora do horário de uso.
