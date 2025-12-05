// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ItemInput {
  origem?: string;
  caixaOrganizador?: string;
  localizacao?: string;
  responsavel: string;
  nome: string;
  tipoItem: 'Insumo' | 'Ferramenta' | 'Matéria Prima';
  metragem?: number;
  peso?: number;
  comprimentoLixa?: number;
  polaridadeDisjuntor?: string;
  especificacao?: string;
  marca?: string;
  quantidade?: number;
  unidade: string;
  condicao?: 'Novo' | 'Usado' | 'Defeito' | 'Descarte';
  categoria?: string;
  subcategoria?: string;
  subDestino?: string;
  tipoServico?: string;
  quantidadeMinima?: number;
  valor?: number;
  ncm?: string;
}

type ImportRequest = { itens: ItemInput[] };

type ImportResult = {
  success: boolean;
  imported?: number;
  errors?: { index: number; nome?: string; message: string }[];
};

// Input validation function
function validateItemInput(item: any, index: number): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Required fields
  if (!item.nome || typeof item.nome !== 'string') {
    errors.push('Nome é obrigatório');
  } else if (item.nome.trim().length > 200) {
    errors.push('Nome: máximo 200 caracteres');
  }
  
  if (!item.responsavel || typeof item.responsavel !== 'string') {
    errors.push('Responsável é obrigatório');
  } else if (item.responsavel.trim().length > 100) {
    errors.push('Responsável: máximo 100 caracteres');
  }
  
  if (!item.unidade || typeof item.unidade !== 'string') {
    errors.push('Unidade é obrigatória');
  } else if (item.unidade.trim().length > 20) {
    errors.push('Unidade: máximo 20 caracteres');
  }
  
  if (!item.tipoItem || typeof item.tipoItem !== 'string') {
    errors.push('Tipo de item é obrigatório');
  } else if (!['Insumo', 'Ferramenta', 'Matéria Prima'].includes(item.tipoItem)) {
    errors.push('tipoItem inválido. Use "Insumo", "Ferramenta" ou "Matéria Prima"');
  }
  
  // Optional string fields with length limits
  const stringFieldLimits: Record<string, number> = {
    origem: 100,
    caixaOrganizador: 50,
    localizacao: 100,
    especificacao: 500,
    marca: 100,
    categoria: 100,
    subcategoria: 100,
    subDestino: 100,
    tipoServico: 100,
    ncm: 20,
    polaridadeDisjuntor: 50
  };
  
  for (const [field, maxLength] of Object.entries(stringFieldLimits)) {
    if (item[field] !== undefined && item[field] !== null) {
      if (typeof item[field] !== 'string') {
        errors.push(`${field} deve ser texto`);
      } else if (item[field].trim().length > maxLength) {
        errors.push(`${field}: máximo ${maxLength} caracteres`);
      }
    }
  }
  
  // Optional numeric fields
  if (item.quantidade !== undefined && item.quantidade !== null) {
    if (typeof item.quantidade !== 'number' || item.quantidade < 0 || item.quantidade > 999999) {
      errors.push('Quantidade deve ser um número entre 0 e 999999');
    }
  }
  
  if (item.quantidadeMinima !== undefined && item.quantidadeMinima !== null) {
    if (typeof item.quantidadeMinima !== 'number' || item.quantidadeMinima < 0 || item.quantidadeMinima > 999999) {
      errors.push('Quantidade mínima deve ser um número entre 0 e 999999');
    }
  }
  
  if (item.valor !== undefined && item.valor !== null) {
    if (typeof item.valor !== 'number' || item.valor < 0 || item.valor > 999999999.99) {
      errors.push('Valor deve ser um número entre 0 e 999999999.99');
    }
  }
  
  // Condition validation
  if (item.condicao !== undefined && item.condicao !== null) {
    if (!['Novo', 'Usado', 'Defeito', 'Descarte'].includes(item.condicao)) {
      errors.push('Condição inválida. Use "Novo", "Usado", "Defeito" ou "Descarte"');
    }
  }
  
  return { valid: errors.length === 0, errors };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, message: 'Método não permitido' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;

    const authHeader = req.headers.get('Authorization') || '';

    // Client with caller's JWT to check auth
    const supabaseAuth = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Admin client to perform inserts (bypass RLS)
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Validate session
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !userData.user) {
      console.log('Authentication failed:', userErr?.message);
      return new Response(JSON.stringify({ success: false, message: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const callerId = userData.user.id;
    console.log('Import request from user:', callerId);

    // Check permissions: administrador, gestor, engenharia
    const { data: perfil, error: perfilErr } = await supabaseAdmin
      .from('profiles')
      .select('tipo_usuario')
      .eq('user_id', callerId)
      .maybeSingle();

    if (perfilErr || !perfil || !['administrador', 'gestor', 'engenharia'].includes(perfil.tipo_usuario)) {
      console.log('Permission denied for user:', callerId, 'role:', perfil?.tipo_usuario);
      return new Response(JSON.stringify({ success: false, message: 'Sem permissão para importar itens' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as ImportRequest;
    if (!body || !Array.isArray(body.itens) || body.itens.length === 0) {
      return new Response(JSON.stringify({ success: false, message: 'Lista de itens inválida' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Limit batch size to prevent abuse
    if (body.itens.length > 500) {
      return new Response(JSON.stringify({ success: false, message: 'Máximo 500 itens por importação' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const errors: { index: number; nome?: string; message: string }[] = [];
    let imported = 0;

    console.log('Starting import of', body.itens.length, 'items');

    for (let i = 0; i < body.itens.length; i++) {
      const inItem = body.itens[i];
      try {
        // Validate input
        const validation = validateItemInput(inItem, i);
        if (!validation.valid) {
          throw new Error(validation.errors.join('; '));
        }

        // Generate next code
        const { data: codigoData, error: codigoErr } = await supabaseAdmin.rpc('gerar_proximo_codigo');
        if (codigoErr || !codigoData) throw new Error(`Falha ao gerar código: ${codigoErr?.message}`);
        const codigoGerado = codigoData as string;

        // Sanitize inputs
        const nome = inItem.nome.trim();
        const responsavel = inItem.responsavel.trim();
        const unidade = inItem.unidade.trim();

        // Insert item
        const insertItem = {
          codigo_barras: codigoGerado,
          origem: inItem.origem?.trim() || null,
          caixa_organizador: inItem.caixaOrganizador?.trim() || null,
          localizacao: inItem.localizacao?.trim() || null,
          nome,
          tipo_item: inItem.tipoItem,
          especificacao: inItem.especificacao?.trim() || null,
          marca: inItem.marca?.trim() || null,
          unidade,
          condicao: inItem.condicao || 'Novo',
          quantidade_minima: typeof inItem.quantidadeMinima === 'number' ? inItem.quantidadeMinima : null,
          valor: typeof inItem.valor === 'number' ? inItem.valor : null,
          ncm: inItem.ncm?.trim() || null,
        };

        const { data: itemRow, error: itemErr } = await supabaseAdmin
          .from('items')
          .insert(insertItem)
          .select('id')
          .maybeSingle();
        if (itemErr || !itemRow) throw new Error(`Falha ao inserir item: ${itemErr?.message}`);

        // Insert movement log (best-effort)
        const quantidade = typeof inItem.quantidade === 'number' ? inItem.quantidade : 0;
        const { error: movErr } = await supabaseAdmin.from('movements').insert({
          item_id: itemRow.id,
          tipo: 'CADASTRO',
          quantidade: quantidade,
          quantidade_anterior: 0,
          quantidade_atual: quantidade,
          user_id: callerId,
          observacoes: null,
          data_hora: new Date().toISOString(),
          item_snapshot: {
            id: itemRow.id,
            nome: insertItem.nome,
            marca: insertItem.marca,
            origem: insertItem.origem,
            unidade: insertItem.unidade,
            condicao: insertItem.condicao,
            quantidade: quantidade,
            localizacao: insertItem.localizacao,
            codigoBarras: codigoGerado,
            especificacao: insertItem.especificacao,
            caixaOrganizador: insertItem.caixa_organizador,
          },
        });
        if (movErr) {
          // Do not block on movement error; just record
          errors.push({ index: i, nome: inItem.nome, message: `Log de movimento falhou: ${movErr.message}` });
        }

        imported++;
      } catch (e: any) {
        errors.push({ index: i, nome: inItem?.nome, message: e?.message || 'Erro desconhecido' });
      }
    }

    console.log('Import completed:', imported, 'items imported,', errors.length, 'errors');

    const result: ImportResult = { success: true, imported, errors };
    return new Response(JSON.stringify(result), {
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
