// deno-lint-ignore-file no-explicit-any
// Sincroniza a senha do App Controle com a senha do Fluxo de Estoque.
// Só age quando: o usuário está logado no Fluxo E a senha enviada é a senha
// correta do Fluxo para esse mesmo e-mail. Nunca cria contas no App Controle.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APP_CONTROLE_URL = "https://vwjtlndymnbzanvpzkda.supabase.co";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (status: number, body: any) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const appControleKey = Deno.env.get("APP_CONTROLE_SERVICE_ROLE_KEY");
    if (!appControleKey) return json(500, { error: "Chave do App Controle não configurada" });

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;

    const caller = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await caller.auth.getUser();
    const email = authData?.user?.email?.trim().toLowerCase();
    if (authError || !email) return json(401, { error: "Não autenticado no Fluxo" });

    const body = await req.json().catch(() => ({}));
    const password = typeof body?.password === "string" ? body.password : "";
    if (password.length < 6 || password.length > 72) return json(400, { error: "Senha inválida" });

    // Confirma que é a senha real do Fluxo deste usuário.
    const checker = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: checkError } = await checker.auth.signInWithPassword({ email, password });
    if (checkError) return json(403, { error: "Senha do Fluxo incorreta" });
    await checker.auth.signOut({ scope: "local" }).catch(() => {});

    const admin = createClient(APP_CONTROLE_URL, appControleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let userId: string | null = null;
    for (let page = 1; page <= 20 && !userId; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return json(500, { error: error.message });
      userId = data.users.find((u: any) => (u.email || "").toLowerCase() === email)?.id ?? null;
      if (data.users.length < 1000) break;
    }
    if (!userId) return json(404, { error: "Este e-mail não tem conta no App Controle" });

    const { error: updError } = await admin.auth.admin.updateUserById(userId, { password });
    if (updError) return json(500, { error: updError.message });

    return json(200, { ok: true });
  } catch (err: any) {
    return json(500, { error: err?.message || "Erro inesperado" });
  }
});
