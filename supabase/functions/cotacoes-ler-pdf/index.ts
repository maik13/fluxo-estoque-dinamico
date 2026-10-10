import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as pdfjsLib from "npm:pdfjs-dist@4.10.38/legacy/build/pdf.mjs";

type ParsedItem = {
  descricao: string;
  quantidade: number | null;
  unidade: string | null;
  valor_unitario: number | null;
  valor_total: number | null;
};

const money = (value?: string | null) => {
  if (!value) return null;
  const cleaned = value
    .replace(/R\$\s?/gi, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

const decimal = (value?: string | null) => {
  if (!value) return null;
  const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

const firstMatch = (text: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
};

const normalizeDate = (value?: string | null) => {
  if (!value) return null;
  const m = value.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if (!m) return null;
  const year = m[3].length === 2 ? "20" + m[3] : m[3];
  return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
};

const classify = (text: string) => {
  const t = text.toLowerCase();
  const freteScore = ["frete", "transportadora", "origem", "destino", "peso", "cubagem", "ct-e"].filter((x) => t.includes(x)).length;
  const insumoScore = ["quantidade", "qtd", "unidade", "valor unit", "produto", "item", "material"].filter((x) => t.includes(x)).length;
  if (freteScore >= 3 && freteScore > insumoScore) return "frete";
  if (insumoScore >= 2) return "insumo";
  return "global";
};

const parseItems = (text: string): ParsedItem[] => {
  const lines = text.split(/\n+/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const items: ParsedItem[] = [];

  // Heurística conservadora: descrição + quantidade/unidade + valor unitário + total.
  const lineRegex = /^(.{3,}?)\s+(\d+(?:[.,]\d+)?)\s*(un|und|unid|pc|pç|kg|g|m|m2|m²|m3|m³|lt|l|cx|pct|rolo|rl)\s+(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{2,4})?|\d+(?:,\d{2,4})?)\s+(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{2})|\d+(?:,\d{2}))$/i;

  for (const line of lines) {
    const m = line.match(lineRegex);
    if (!m) continue;
    const descricao = m[1].trim();
    if (/subtotal|total|frete|desconto|imposto/i.test(descricao)) continue;
    items.push({
      descricao,
      quantidade: decimal(m[2]),
      unidade: m[3],
      valor_unitario: money(m[4]),
      valor_total: money(m[5]),
    });
    if (items.length >= 100) break;
  }
  return items;
};

const parseText = (text: string) => {
  const tipo = classify(text);
  const cnpj = firstMatch(text, [
    /CNPJ\s*[:\-]?\s*([0-9.\/\-]{14,18})/i,
    /([0-9]{2}\.[0-9]{3}\.[0-9]{3}\/[0-9]{4}\-[0-9]{2})/,
  ]);

  const fornecedor = firstMatch(text, [
    /(?:Raz[aã]o Social|Fornecedor|Empresa|Transportadora)\s*[:\-]\s*([^\n]{3,120})/i,
    /(?:Emitente|Proponente)\s*[:\-]\s*([^\n]{3,120})/i,
  ]);

  const endereco = firstMatch(text, [
    /Endere[cç]o\s*[:\-]\s*([^\n]{5,180})/i,
  ]);

  const numeroProposta = firstMatch(text, [
    /(?:Proposta|Or[cç]amento|Cota[cç][aã]o)\s*(?:n[ºo°.]|n[uú]mero|#)?\s*[:\-]?\s*([A-Z0-9._\/-]{2,40})/i,
  ]);

  const dataRaw = firstMatch(text, [
    /(?:Data(?: da proposta| do or[cç]amento| da cota[cç][aã]o)?|Emiss[aã]o)\s*[:\-]\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i,
  ]);

  const validadeDiasRaw = firstMatch(text, [
    /Validade\s*[:\-]?\s*(\d{1,3})\s*dias?/i,
  ]);

  const condicao = firstMatch(text, [
    /(?:Condi[cç][aã]o de pagamento|Pagamento)\s*[:\-]\s*([^\n]{2,120})/i,
  ]);

  const origem = tipo === "frete" ? firstMatch(text, [
    /Origem\s*[:\-]\s*([^\n]{2,120})/i,
    /Coleta\s*[:\-]\s*([^\n]{2,120})/i,
  ]) : null;

  const destino = tipo === "frete" ? firstMatch(text, [
    /Destino\s*[:\-]\s*([^\n]{2,120})/i,
    /Entrega\s*[:\-]\s*([^\n]{2,120})/i,
  ]) : null;

  const pesoRaw = tipo === "frete" ? firstMatch(text, [
    /Peso(?: bruto)?\s*[:\-]?\s*([\d.,]+)\s*kg/i,
  ]) : null;

  const cubagemRaw = tipo === "frete" ? firstMatch(text, [
    /Cubagem\s*[:\-]?\s*([\d.,]+)\s*m[³3]/i,
  ]) : null;

  const valorFreteRaw = tipo === "frete" ? firstMatch(text, [
    /(?:Valor do frete|Frete total|Total frete)\s*[:\-]?\s*(R\$\s*[\d.,]+)/i,
  ]) : null;

  const totalCandidates = [...text.matchAll(/(?:valor\s+total|total\s+(?:geral|da proposta|do or[cç]amento)?|total)\s*[:\-]?\s*(R\$\s*[\d.]+,\d{2})/gi)]
    .map((m) => money(m[1]))
    .filter((v): v is number => v !== null);

  const valorTotal = valorFreteRaw ? money(valorFreteRaw) : (totalCandidates.at(-1) ?? null);

  return {
    tipo,
    fornecedor_nome: fornecedor,
    fornecedor_cnpj: cnpj,
    fornecedor_endereco: endereco,
    numero_proposta: numeroProposta,
    data_cotacao: normalizeDate(dataRaw),
    validade_dias: validadeDiasRaw ? Number(validadeDiasRaw) : null,
    condicao_pagamento: condicao,
    origem_frete: origem,
    destino_frete: destino,
    peso_kg: decimal(pesoRaw),
    cubagem_m3: decimal(cubagemRaw),
    valor_frete: money(valorFreteRaw),
    valor_total: valorTotal,
    itens: tipo === "insumo" ? parseItems(text) : [],
  };
};

Deno.serve(async (req: Request) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const service = createClient(supabaseUrl, serviceKey);

    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const { cotacao_id } = await req.json();
    if (!cotacao_id) throw new Error("cotacao_id obrigatório");

    const { data: cotacao, error: cotacaoError } = await userClient
      .from("cotacoes")
      .select("id,arquivo_path")
      .eq("id", cotacao_id)
      .single();

    if (cotacaoError || !cotacao) throw new Error(cotacaoError?.message || "Cotação não encontrada");
    if (!cotacao.arquivo_path) throw new Error("Cotação sem PDF vinculado");

    await userClient.from("cotacoes").update({ leitura_status: "processando", leitura_erro: null }).eq("id", cotacao_id);

    const { data: fileData, error: downloadError } = await service.storage
      .from("cotacoes-documentos")
      .download(cotacao.arquivo_path);

    if (downloadError || !fileData) throw new Error(downloadError?.message || "Falha ao baixar PDF");

    const bytes = new Uint8Array(await fileData.arrayBuffer());
    const loadingTask = pdfjsLib.getDocument({
      data: bytes,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;

    const pages: string[] = [];
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const page = await pdf.getPage(pageNo);
      const content = await page.getTextContent();
      const strings = content.items
        .map((item: any) => item.str || "")
        .filter(Boolean);
      pages.push(strings.join(" "));
    }

    const text = pages.join("\n").replace(/\u0000/g, "").trim();
    if (!text) {
      await userClient.from("cotacoes").update({
        leitura_status: "sem_texto",
        leitura_erro: "O PDF não possui camada de texto. Preencha manualmente ou use OCR.",
        texto_extraido: null,
      }).eq("id", cotacao_id);

      return new Response(JSON.stringify({ status: "sem_texto" }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const parsed = parseText(text);

    const updatePayload: Record<string, any> = {
      tipo: parsed.tipo,
      fornecedor_nome: parsed.fornecedor_nome,
      fornecedor_cnpj: parsed.fornecedor_cnpj,
      fornecedor_endereco: parsed.fornecedor_endereco,
      numero_proposta: parsed.numero_proposta,
      data_cotacao: parsed.data_cotacao,
      validade_dias: parsed.validade_dias,
      condicao_pagamento: parsed.condicao_pagamento,
      origem_frete: parsed.origem_frete,
      destino_frete: parsed.destino_frete,
      peso_kg: parsed.peso_kg,
      cubagem_m3: parsed.cubagem_m3,
      valor_frete: parsed.valor_frete,
      valor_total: parsed.valor_total,
      texto_extraido: text.slice(0, 200000),
      leitura_json: parsed,
      leitura_status: "concluida",
      leitura_erro: null,
      status: "em_validacao",
      updated_at: new Date().toISOString(),
    };

    await userClient.from("cotacoes").update(updatePayload).eq("id", cotacao_id);

    if (parsed.itens.length > 0) {
      await userClient.from("cotacao_itens").delete().eq("cotacao_id", cotacao_id);
      const rows = parsed.itens.map((item, index) => ({
        cotacao_id,
        descricao: item.descricao,
        quantidade: item.quantidade,
        unidade: item.unidade,
        valor_unitario: item.valor_unitario,
        valor_total: item.valor_total,
        ordem: index,
      }));
      const { error: itemError } = await userClient.from("cotacao_itens").insert(rows);
      if (itemError) console.error("Erro ao salvar itens extraídos:", itemError);
    }

    return new Response(JSON.stringify({ status: "concluida", parsed }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error(error);
    return new Response(JSON.stringify({ error: error?.message || "Erro ao ler PDF" }), {
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
    });
  }
});
