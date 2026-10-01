// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (status: number, body: any) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authorization = req.headers.get("Authorization") || "";

    const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: authData, error: authError } = await caller.auth.getUser();
    if (authError || !authData.user) return json(401, { error: "Não autenticado" });

    const { data: allowed, error: permError } = await admin.rpc("permissao_individual_efetiva", {
      p_user_id: authData.user.id,
      p_permissao: "rh_colaboradores_gerenciar",
    });
    if (permError || !allowed) return json(403, { error: "Usuário sem permissão para gerenciar colaboradores do RH" });

    const body = await req.json();
    const nome = String(body.nome || "").trim();
    const email = body.email ? String(body.email).trim().toLowerCase() : null;
    const createLogin = Boolean(body.create_login);
    const password = body.password ? String(body.password) : null;

    if (!nome) return json(400, { error: "Nome é obrigatório" });
    if (createLogin && !email) return json(400, { error: "Email é obrigatório para criar acesso de login" });
    if (createLogin && (!password || password.length < 8)) return json(400, { error: "Senha deve ter pelo menos 8 caracteres" });

    let userId: string | null = null;

    if (createLogin) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: email!,
        password: password!,
        email_confirm: true,
      });
      if (createError) return json(400, { error: createError.message });
      userId = created.user?.id || null;
      if (!userId) return json(500, { error: "Usuário criado sem identificador" });

      const { error: profileError } = await admin.rpc("admin_create_profile", {
        target_user_id: userId,
        nome,
        email,
        tipo: "colaborador",
      });
      if (profileError) {
        await admin.auth.admin.deleteUser(userId);
        return json(400, { error: profileError.message });
      }

      await admin.from("profiles").update({
        deve_trocar_senha: true,
        senha_redefinida_em: null,
      }).eq("user_id", userId);

      const now = new Date().toISOString();
      const permissions = [
        { user_id: userId, permissao: "ponto_registrar", efeito: "permitir", criado_por: authData.user.id, atualizado_por: authData.user.id, created_at: now, updated_at: now },
        { user_id: userId, permissao: "ponto_visualizar", efeito: "permitir", criado_por: authData.user.id, atualizado_por: authData.user.id, created_at: now, updated_at: now },
      ];
      const { error: permissionInsertError } = await admin.from("usuario_permissoes_individuais").upsert(permissions, {
        onConflict: "user_id,permissao",
      });
      if (permissionInsertError) {
        await admin.auth.admin.deleteUser(userId);
        return json(400, { error: permissionInsertError.message });
      }
    }

    const type = String(body.tipo_contrato || "clt").toLowerCase();
    const payload = {
      nome,
      email,
      cpf_cnpj: body.cpf_cnpj || null,
      telefone: body.telefone || null,
      data_nascimento: body.data_nascimento || null,
      endereco: body.endereco || null,
      cidade: body.cidade || null,
      estado: body.estado || null,
      cep: body.cep || null,
      cargo: body.cargo || null,
      departamento: body.departamento || null,
      salario: type === "clt" && body.salario !== null && body.salario !== undefined && body.salario !== "" ? Number(body.salario) : null,
      data_admissao: body.data_admissao || null,
      pis: body.pis || null,
      jornada_id: body.jornada_id || null,
      ativo: body.ativo !== undefined ? Boolean(body.ativo) : true,
      user_id: userId,
      controla_ponto: Boolean(body.controla_ponto),
      tipo_contrato: type,
      valor_contrato: type === "clt" || body.valor_contrato === null || body.valor_contrato === undefined || body.valor_contrato === "" ? null : Number(body.valor_contrato),
      hora_extra_gera_valor: type !== "horista",
      rh_ativo: true,
      rh_cadastrado: true,
      origem_sistema: "fluxo_estoque_dinamico",
    };

    const { data: colaborador, error: insertError } = await admin.from("rh_colaboradores").insert(payload).select("*").single();
    if (insertError) {
      if (userId) await admin.auth.admin.deleteUser(userId);
      return json(400, { error: insertError.message });
    }

    return json(200, {
      success: true,
      colaborador,
      colaborador_id: colaborador.id,
      user_id: userId,
      has_login: Boolean(userId),
    });
  } catch (error: any) {
    return json(500, { error: error?.message || "Erro interno do servidor" });
  }
});