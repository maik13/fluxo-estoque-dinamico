import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const testEmail = process.env.E2E_PRODUCAO_EMAIL;
const testPassword = process.env.E2E_PRODUCAO_PASSWORD;

const integrationAvailable = Boolean(
  supabaseUrl && supabaseAnonKey && testEmail && testPassword,
);

test.describe('Isolamento do Módulo de Produção', () => {
  test.skip(!integrationAvailable, 'Credenciais E2E de homologação não configuradas.');

  test('nega INSERT direto e permite somente a RPC autorizada', async () => {
    const supabase = createClient(supabaseUrl!, supabaseAnonKey!);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: testEmail!,
      password: testPassword!,
    });
    expect(authError).toBeNull();

    const { error: directInsertError } = await supabase
      .from('producao_tarefas')
      .insert({ nome: `E2E direto ${Date.now()}` });

    expect(directInsertError).not.toBeNull();

    const { data: rpcId, error: rpcError } = await supabase.rpc(
      'criar_tarefa_producao',
      {
        p_nome: `E2E RPC ${Date.now()}`,
        p_categoria: 'Teste automatizado',
      },
    );

    expect(rpcError).toBeNull();
    expect(rpcId).toBeTruthy();
  });

  test('a produção não permite escrita direta em tabelas do almoxarifado', async () => {
    const supabase = createClient(supabaseUrl!, supabaseAnonKey!);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: testEmail!,
      password: testPassword!,
    });
    expect(authError).toBeNull();

    const { error } = await supabase
      .from('items')
      .insert({ name: `Item indevido ${Date.now()}` });

    expect(error).not.toBeNull();
  });
});
