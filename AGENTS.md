# REGRA CANÔNICA DE BACKEND — LEITURA OBRIGATÓRIA

Este repositório possui histórico de migração de backend. Antes de qualquer alteração de banco, migration, deploy, leitura/escrita administrativa ou operação que possa atingir dados de produção, leia `config/production-target.json` e siga estas regras.

## Fonte de verdade atual

- Aplicação: `fluxo-estoque-dinamico` / `GESTÃO ALMOXARIFADO`
- Repositório: `maik13/fluxo-estoque-dinamico`
- Branch de produção: `main`
- Backend de produção: **Lovable Cloud**
- Projeto Lovable Cloud de produção: **`f2b21626-c1f3-4d7c-9966-6dd8bb0f2ef1`**
- Workspace: **JOELMA – SISTEMA INTEGRADO**
- Organização: **UNIKA**

## Regra de segurança absoluta

1. **NUNCA** executar migration, SQL, deploy, consulta administrativa, escrita ou alteração de dados contra o Supabase antigo ou qualquer projeto Lovable legado.
2. Antes de toda operação de banco/deploy, confirmar o `project_id` conectado. Ele deve ser exatamente `f2b21626-c1f3-4d7c-9966-6dd8bb0f2ef1`.
3. Se o ambiente/ferramenta não permitir confirmar o projeto atual, **PARAR**. Não inferir, não usar o projeto disponível por conveniência e não executar a operação.
4. A pasta histórica `supabase/`, o pacote `@supabase/supabase-js` e nomes compatíveis com Supabase **não definem o destino do banco**. O projeto usa uma API/estrutura compatível, mas o alvo operacional é o Lovable Cloud indicado acima.
5. O arquivo `.env` pode conter referências históricas/legadas e **não é fonte de verdade para escolher o backend de produção**. Nunca usar seus identificadores para decidir em qual banco executar uma migration sem validar o alvo canônico.
6. Qualquer mudança do projeto de produção em `config/production-target.json` exige autorização explícita do proprietário. Não atualizar este alvo por inferência.
7. Antes de uma operação mutável de banco/deploy, executar o preflight:
   `bun run guard:backend -- <PROJECT_ID_CONECTADO>`
   A operação só pode prosseguir se o comando retornar sucesso.

## Alvos legados conhecidos — PROIBIDOS

Os identificadores legados ficam registrados em `config/production-target.json` apenas para bloqueio e auditoria. Eles nunca devem ser usados como destino operacional.

## Protocolo para novos chats/agentes

Ao iniciar trabalho neste repositório:

1. Ler este arquivo.
2. Ler `config/production-target.json`.
3. Para tarefas apenas de frontend/código sem banco, trabalhar normalmente.
4. Para banco/deploy, validar o projeto conectado com `bun run guard:backend -- <PROJECT_ID>` antes de qualquer escrita.
5. Em caso de divergência entre ferramenta, `.env`, histórico, documentação antiga ou memória, **o arquivo canônico prevalece e a operação deve ser interrompida até validação explícita**.
