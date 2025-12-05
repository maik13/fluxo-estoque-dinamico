// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema (inline for Deno compatibility)
function validateUserCreation(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Email validation
  if (!data.email || typeof data.email !== 'string') {
    errors.push('Email é obrigatório');
  } else {
    const email = data.email.trim().toLowerCase();
    if (email.length > 255) {
      errors.push('Email muito longo (máximo 255 caracteres)');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Formato de email inválido');
    }
  }
  
  // Password validation
  if (!data.password || typeof data.password !== 'string') {
    errors.push('Senha é obrigatória');
  } else {
    if (data.password.length < 8) {
      errors.push('Senha deve ter no mínimo 8 caracteres');
    }
    if (data.password.length > 72) {
      errors.push('Senha muito longa (máximo 72 caracteres)');
    }
    if (!/[A-Z]/.test(data.password)) {
      errors.push('Senha deve conter ao menos uma letra maiúscula');
    }
    if (!/[a-z]/.test(data.password)) {
      errors.push('Senha deve conter ao menos uma letra minúscula');
    }
    if (!/[0-9]/.test(data.password)) {
      errors.push('Senha deve conter ao menos um número');
    }
  }
  
  // Nome validation
  if (!data.nome || typeof data.nome !== 'string') {
    errors.push('Nome é obrigatório');
  } else {
    const nome = data.nome.trim();
    if (nome.length < 2) {
      errors.push('Nome deve ter no mínimo 2 caracteres');
    }
    if (nome.length > 100) {
      errors.push('Nome muito longo (máximo 100 caracteres)');
    }
  }
  
  // Tipo validation (optional)
  if (data.tipo !== undefined) {
    const validTypes = ['administrador', 'gestor', 'engenharia', 'mestre', 'estoquista'];
    if (!validTypes.includes(data.tipo)) {
      errors.push('Tipo de usuário inválido');
    }
  }
  
  return { valid: errors.length === 0, errors };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') || '';

    // Client with caller's JWT to check permissions
    const supabaseAuth = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Admin client to perform privileged ops
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Get current user and role
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !userData.user) {
      console.log('Authentication failed:', userErr?.message);
      return new Response(JSON.stringify({ success: false, message: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const callerId = userData.user.id;

    // Verify caller is admin or gestor
    const { data: perfil } = await supabaseAdmin
      .from('profiles')
      .select('tipo_usuario')
      .eq('user_id', callerId)
      .maybeSingle();

    if (!perfil || !['administrador', 'gestor'].includes(perfil.tipo_usuario)) {
      console.log('Permission denied for user:', callerId, 'role:', perfil?.tipo_usuario);
      return new Response(JSON.stringify({ success: false, message: 'Sem permissão' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    
    // Validate input
    const validation = validateUserCreation(body);
    if (!validation.valid) {
      console.log('Validation failed:', validation.errors);
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Erro de validação',
        errors: validation.errors 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const email = body.email.trim().toLowerCase();
    const password = body.password;
    const nome = body.nome.trim();
    const tipo = body.tipo || 'estoquista';

    console.log('Creating user:', email, 'by:', callerId);

    // Create auth user (confirmed)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr) {
      console.log('User creation failed:', createErr.message);
      return new Response(JSON.stringify({ success: false, message: createErr.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const targetId = created.user?.id;
    if (!targetId) {
      console.log('Failed to get created user ID');
      return new Response(JSON.stringify({ success: false, message: 'Falha ao obter usuário criado' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create or update profile using security definer function
    const { error: rpcErr } = await supabaseAdmin.rpc('admin_create_profile', {
      target_user_id: targetId,
      nome,
      email,
      tipo,
    });
    if (rpcErr) {
      console.log('Profile creation failed:', rpcErr.message);
      return new Response(JSON.stringify({ success: false, message: rpcErr.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('User created successfully:', targetId);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('Unexpected error:', e?.message);
    return new Response(JSON.stringify({ success: false, message: e?.message || 'Erro inesperado' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
