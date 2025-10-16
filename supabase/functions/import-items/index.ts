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
  tipoItem: 'Insumo' | 'Ferramenta';
  metragem?: number;
  peso?: number;
  comprimentoLixa?: number;
  polaridadeDisjuntor?: string;
  especificacao?: string;
  marca?: string;
  quantidade?: number; // default 0
  unidade: string;
  condicao?: 'Novo' | 'Usado' | 'Defeito' | 'Descarte';
  categoria?: string;
  subcategoria?: string;
  subDestino?: string;
  tipoServico?: string;
  quantidadeMinima?: number;
}

type ImportRequest = { itens: ItemInput[] };

type ImportResult = {
  success: boolean;
  imported?: number;
  errors?: { index: number; nome?: string; message: string }[];
};

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
      return new Response(JSON.stringify({ success: false, message: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const callerId = userData.user.id;

    // Check permissions: administrador, gestor, engenharia
    const { data: perfil, error: perfilErr } = await supabaseAdmin
      .from('profiles')
      .select('tipo_usuario')
      .eq('user_id', callerId)
      .maybeSingle();

    if (perfilErr || !perfil || !['administrador', 'gestor', 'engenharia'].includes(perfil.tipo_usuario)) {
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

    const errors: { index: number; nome?: string; message: string }[] = [];
    let imported = 0;

    for (let i = 0; i < body.itens.length; i++) {
      const inItem = body.itens[i];
      try {
        // Basic validation
        if (!inItem.nome || !inItem.responsavel || !inItem.unidade || !inItem.tipoItem) {
          throw new Error('Campos obrigatórios ausentes (nome, responsavel, unidade, tipoItem)');
        }
        if (!['Insumo', 'Ferramenta'].includes(inItem.tipoItem)) {
          throw new Error('tipoItem inválido. Use "Insumo" ou "Ferramenta"');
        }

        // Generate next code
        const { data: codigoData, error: codigoErr } = await supabaseAdmin.rpc('gerar_proximo_codigo');
        if (codigoErr || !codigoData) throw new Error(`Falha ao gerar código: ${codigoErr?.message}`);
        const codigoGerado = codigoData as string;

        // Insert item
        const insertItem = {
          codigo_barras: codigoGerado,
          origem: inItem.origem || null,
          caixa_organizador: inItem.caixaOrganizador || null,
          localizacao: inItem.localizacao || null,
          responsavel: inItem.responsavel,
          nome: inItem.nome,
          tipo_item: inItem.tipoItem,
          metragem: inItem.metragem ?? null,
          peso: inItem.peso ?? null,
          comprimento_lixa: inItem.comprimentoLixa ?? null,
          polaridade_disjuntor: inItem.polaridadeDisjuntor || null,
          especificacao: inItem.especificacao || null,
          marca: inItem.marca || null,
          quantidade: typeof inItem.quantidade === 'number' ? inItem.quantidade : 0,
          unidade: inItem.unidade,
          condicao: inItem.condicao || 'Novo',
          categoria: inItem.categoria || null,
          subcategoria: inItem.subcategoria || null,
          sub_destino: inItem.subDestino || null,
          tipo_servico: inItem.tipoServico || null,
          data_criacao: new Date().toISOString(),
          quantidade_minima: typeof inItem.quantidadeMinima === 'number' ? inItem.quantidadeMinima : null,
        };

        const { data: itemRow, error: itemErr } = await supabaseAdmin
          .from('items')
          .insert(insertItem)
          .select('id')
          .maybeSingle();
        if (itemErr || !itemRow) throw new Error(`Falha ao inserir item: ${itemErr?.message}`);

        // Insert movement log (best-effort)
        const { error: movErr } = await supabaseAdmin.from('movements').insert({
          item_id: itemRow.id,
          tipo: 'CADASTRO',
          quantidade: insertItem.quantidade,
          quantidade_anterior: 0,
          quantidade_atual: insertItem.quantidade,
          responsavel: insertItem.responsavel,
          observacoes: null,
          data_hora: new Date().toISOString(),
          item_snapshot: {
            id: itemRow.id,
            nome: insertItem.nome,
            marca: insertItem.marca,
            origem: insertItem.origem,
            unidade: insertItem.unidade,
            condicao: insertItem.condicao,
            categoria: insertItem.categoria,
            quantidade: insertItem.quantidade,
            subDestino: insertItem.sub_destino,
            dataCriacao: insertItem.data_criacao,
            localizacao: insertItem.localizacao,
            responsavel: insertItem.responsavel,
            tipoServico: insertItem.tipo_servico,
            codigoBarras: codigoGerado,
            subcategoria: insertItem.subcategoria,
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

    const result: ImportResult = { success: true, imported, errors };
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, message: e?.message || 'Erro inesperado' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
