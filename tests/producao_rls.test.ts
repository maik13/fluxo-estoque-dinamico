import { beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.TEST_PRODUCAO_EMAIL;
const password = process.env.TEST_PRODUCAO_PASSWORD;

const integrationAvailable = Boolean(url && anonKey && email && password);

let client: SupabaseClient;

beforeAll(async () => {
  if (!integrationAvailable) return;

  client = createClient(url!, anonKey!);
  const { error } = await client.auth.signInWithPassword({
    email: email!,
    password: password!,
  });

  if (error) throw error;
});

describe.skipIf(!integrationAvailable)('RLS e RPCs da Produção', () => {
  it('bloqueia escrita direta em tabela produtiva', async () => {
    const { error } = await client
      .from('producao_tarefas')
      .insert({ nome: `Direto ${Date.now()}` });

    expect(error).not.toBeNull();
  });

  it('permite a RPC quando o usuário possui a permissão necessária', async () => {
    const { data, error } = await client.rpc('criar_tarefa_producao', {
      p_nome: `RPC ${Date.now()}`,
      p_categoria: 'Teste de integração',
    });

    expect(error).toBeNull();
    expect(data).toBeTruthy();
  });

  it('não expõe funções antigas que aceitam identidade fornecida pelo cliente', async () => {
    const { error } = await client.rpc('iniciar_processo_producao', {
      p_processo_id: '00000000-0000-0000-0000-000000000000',
      p_usuario_id: '00000000-0000-0000-0000-000000000000',
      p_nome_usuario: 'Usuário forjado',
      p_justificativa: null,
    });

    expect(error).not.toBeNull();
  });

  it('impede alteração direta da auditoria', async () => {
    const { error } = await client
      .from('producao_processo_eventos')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    expect(error).not.toBeNull();
  });
});
