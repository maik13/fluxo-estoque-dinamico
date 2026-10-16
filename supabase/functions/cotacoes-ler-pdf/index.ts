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

type PdfLine = {
  y: number;
  text: string;
};

const clean = (value?: string | null) =>
  value ? value.replace(/\s+/g, " ").trim() : null;

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
  const normalized = value
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^0-9.-]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

const normalizeDate = (value?: string | null) => {
  if (!value) return null;
  const repaired = value.replace(/(\d{2}\/\d{2}\/2)\s+(\d{3})/, "$1$2");
  const m = repaired.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if (!m) return null;
  const year = m[3].length === 2 ? "20" + m[3] : m[3];
  return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
};

const digitsOnly = (value?: string | null) => value?.replace(/\D/g, "") || "";

const normalizeCnpj = (value?: string | null) => {
  const digits = digitsOnly(value);
  return digits.length === 14 ? digits : null;
};

const classify = (text: string) => {
  const t = text.toLocaleLowerCase("pt-BR");
  const freteScore = [
    "cotação de frete",
    "transportadora",
    "cidade/estado origem",
    "cidade/estado destino",
    "frete peso",
    "pedágio",
    "peso cubado",
  ].filter((x) => t.includes(x)).length;
  const insumoScore = [
    "valor unitário",
    "quantidade",
    "unidade",
    "produto",
    "material",
    "subtotal",
  ].filter((x) => t.includes(x)).length;

  if (freteScore >= 2 && freteScore > insumoScore) return "frete";
  if (insumoScore >= 2) return "insumo";
  return "global";
};

const reconstructLines = (items: any[]): PdfLine[] => {
  const positioned = items
    .filter((item) => item?.str && item?.transform)
    .map((item) => ({
      str: String(item.str),
      x: Number(item.transform[4] || 0),
      y: Number(item.transform[5] || 0),
      width: Number(item.width || 0),
    }))
    .filter((item) => item.str.trim());

  positioned.sort((a, b) => Math.abs(b.y - a.y) > 2.2 ? b.y - a.y : a.x - b.x);

  const rows: Array<{ y: number; items: typeof positioned }> = [];
  for (const item of positioned) {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= 2.2);
    if (row) {
      row.items.push(item);
      row.y = (row.y * (row.items.length - 1) + item.y) / row.items.length;
    } else {
      rows.push({ y: item.y, items: [item] });
    }
  }

  rows.sort((a, b) => b.y - a.y);

  return rows.map((row) => {
    row.items.sort((a, b) => a.x - b.x);
    let result = "";
    let previousEnd = -Infinity;
    for (const item of row.items) {
      const gap = item.x - previousEnd;
      if (result && gap > 1.5) result += " ";
      result += item.str;
      previousEnd = item.x + item.width;
    }
    return { y: row.y, text: result.replace(/\s+/g, " ").trim() };
  }).filter((line) => line.text);
};

const findLine = (lines: string[], pattern: RegExp) =>
  lines.find((line) => pattern.test(line)) || null;

const valueFromLabeledLine = (lines: string[], label: RegExp) => {
  for (const line of lines) {
    const match = line.match(label);
    if (!match) continue;
    const rest = clean(line.slice((match.index || 0) + match[0].length).replace(/^\s*[:\-]\s*/, ""));
    if (rest && rest.length <= 140 && !/(?:CNPJ|Cidade|Data\/Hora|Validade|Usuário|Página|Telefone|Fax)\s*:/i.test(rest)) {
      return rest;
    }
  }
  return null;
};

const findDateNearLabel = (lines: string[], label: RegExp) => {
  for (let i = 0; i < lines.length; i++) {
    if (!label.test(lines[i])) continue;
    const same = lines[i].match(/(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/);
    if (same) return normalizeDate(same[1]);
    for (let offset = 1; offset <= 2 && i + offset < lines.length; offset++) {
      const next = lines[i + offset].match(/(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/);
      if (next) return normalizeDate(next[1]);
    }
  }
  return null;
};

const section = (text: string, start: RegExp, end?: RegExp) => {
  const startMatch = text.match(start);
  if (!startMatch?.index && startMatch?.index !== 0) return "";
  const after = text.slice(startMatch.index + startMatch[0].length);
  if (!end) return after;
  const endMatch = after.match(end);
  return endMatch?.index !== undefined ? after.slice(0, endMatch.index) : after;
};

const parseItems = (lines: string[]): ParsedItem[] => {
  const items: ParsedItem[] = [];
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

const parseDocument = (lines: string[], fileName: string) => {
  const text = lines.join("\n");
  const flat = lines.join(" ").replace(/\s+/g, " ");
  const tipo = classify(flat);

  const headerText = lines.slice(0, 25).join("\n");
  const beforeRemetente = flat.split(/CNPJ\s+Remetente/i)[0] || flat;

  const companyLine =
    lines.slice(0, 18).find((line) => /\b(?:LTDA|EIRELI|S\/?A|ME)\b/i.test(line)) ||
    valueFromLabeledLine(lines, /(?:Fornecedor|Empresa|Transportadora|Raz[aã]o Social)/i);

  const cnpjCandidates = [...beforeRemetente.matchAll(/\b(?:\d[.\/-]?){14,18}\b/g)]
    .map((m) => normalizeCnpj(m[0]))
    .filter((v): v is string => Boolean(v));
  const fornecedorCnpj = cnpjCandidates[0] || null;

  const streetLine = lines.slice(0, 20).find((line) =>
    /\b(?:Rua|R\.|Avenida|Av\.|Rodovia|Estrada|Alameda|Travessa)\b/i.test(line)
  ) || null;
  const addressNumber = beforeRemetente.match(/\bN[ºo°.]?\s*:\s*(\d{1,8})\b/i)?.[1] || null;
  const supplierCityUf = headerText.match(/([A-ZÀ-Ý][A-ZÀ-Ý\s.'-]{2,})\s+UF\s*:\s*([A-Z]{2})/i);
  const fornecedorEndereco = clean([
    streetLine,
    addressNumber && streetLine && !new RegExp(`\\b${addressNumber}\\b`).test(streetLine) ? `Nº ${addressNumber}` : null,
    supplierCityUf ? `${clean(supplierCityUf[1])}/${supplierCityUf[2].toUpperCase()}` : null,
  ].filter(Boolean).join(", "));

  const phone = headerText.match(/(?:\+?55\s*)?\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4}/)?.[0] || null;
  const email = headerText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null;
  const fornecedorContato = clean([phone, email].filter(Boolean).join(" · "));

  let numeroProposta = valueFromLabeledLine(lines, /N[uú]mero da Cota[cç][aã]o/i)
    || valueFromLabeledLine(lines, /N[uú]mero da Proposta/i)
    || valueFromLabeledLine(lines, /N[ºo°.]?\s*Proposta/i);

  if (!numeroProposta || !/[0-9]/.test(numeroProposta)) {
    numeroProposta =
      fileName.match(/(?:COTA(?:Ç|C)[AÃ]O|PROPOSTA)[-_\s]*(\d{2,12})/i)?.[1]
      || null;
  }

  const dataCotacao =
    findDateNearLabel(lines, /Data\/Hora/i)
    || findDateNearLabel(lines, /Data da Cota[cç][aã]o/i)
    || findDateNearLabel(lines, /Emiss[aã]o/i);

  const validadeData = findDateNearLabel(lines, /Validade/i);
  let validadeDias: number | null = null;
  const diasValidade = flat.match(/Validade\s*[:\-]?\s*(\d{1,3})\s*dias?/i);
  if (diasValidade) validadeDias = Number(diasValidade[1]);

  const explicitCondition =
    valueFromLabeledLine(lines, /Condi[cç][aã]o de pagamento/i);
  const paymentSentence = flat.match(/PAGAMENTO\s+(.{3,140}?)(?=\s+(?:PRAZO|SE\s+HOUVER|REENTREGA|DEVOLU[CÇ][AÃ]O|SEGURO)\b|[.]\s|$)/i);
  const condicaoPagamento = clean(explicitCondition || (paymentSentence ? `PAGAMENTO ${paymentSentence[1]}` : null));

  let origemFrete: string | null = null;
  let destinoFrete: string | null = null;
  let pesoKg: number | null = null;
  let cubagemM3: number | null = null;
  let volumes: number | null = null;
  let tipoVeiculo: string | null = null;
  let prazoDias: number | null = null;
  let valorFrete: number | null = null;
  let valorTotal: number | null = null;

  if (tipo === "frete") {
    const routeSection = section(flat, /Dados informados para cota[cç][aã]o/i, /Dados informados para c[aá]lculo/i);
    const cityMatches = [...routeSection.matchAll(/([A-ZÀ-Ý][A-ZÀ-Ý\s.'-]{2,}?)\s*\/\s*([A-Z]{2})\b/g)]
      .map((m) => `${clean(m[1])}/${m[2].toUpperCase()}`)
      .filter((value, index, array) => array.indexOf(value) === index);
    if (cityMatches.length >= 2) {
      origemFrete = cityMatches[0];
      destinoFrete = cityMatches[1];
    } else {
      origemFrete = clean(valueFromLabeledLine(lines, /(?:Cidade\/Estado\s+)?Origem/i));
      destinoFrete = clean(valueFromLabeledLine(lines, /(?:Cidade\/Estado\s+)?Destino/i));
    }

    const calculationSection = section(flat, /Dados informados para c[aá]lculo/i, /Rota/i)
      .replace(/\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}/g, " ")
      .replace(/R\$\s*[\d.,]+/g, " ");
    const calcNumbers = [...calculationSection.matchAll(/(?<![A-ZÀ-Ý])\b\d{1,3}(?:\.\d{3})*(?:,\d+)?\b/g)]
      .map((m) => decimal(m[0]))
      .filter((v): v is number => v !== null);

    if (calcNumbers.length >= 3) {
      volumes = Number.isInteger(calcNumbers[0]) ? calcNumbers[0] : null;
      pesoKg = calcNumbers[1];
      cubagemM3 = calcNumbers[2];
    }

    const explicitWeight = flat.match(/Peso(?:\s+(?:real|bruto))?\s*[:\-]?\s*([\d.,]+)\s*kg/i);
    if (explicitWeight) pesoKg = decimal(explicitWeight[1]);

    const explicitCubage = flat.match(/Cubagem\s*[:\-]?\s*([\d.,]+)\s*m[³3]/i);
    if (explicitCubage) cubagemM3 = decimal(explicitCubage[1]);

    const vehicle = flat.match(/\b(CARRETA|TRUCK|TOCO|VUC|BITREM|RODOTREM|UTILIT[ÁA]RIO|FIORINO)\b/i)
      || fileName.match(/\b(CARRETA|TRUCK|TOCO|VUC|BITREM|RODOTREM|UTILIT[ÁA]RIO|FIORINO)\b/i);
    tipoVeiculo = vehicle?.[1]?.toUpperCase() || null;

    const prazo = flat.match(/PRAZO\s+DE\s+ENTREGA\s*(?:DE)?\s*(\d{1,3})\s*DIAS?/i);
    prazoDias = prazo ? Number(prazo[1]) : null;

    const valuesSection = section(flat, /Valores da cota[cç][aã]o/i, /CIF\b|FOB\b|Informa[cç][oõ]es adicionais/i);
    const values = [...valuesSection.matchAll(/R\$\s*[\d.]+,\d{2}/g)]
      .map((m) => money(m[0]))
      .filter((v): v is number => v !== null);
    const nonZero = values.filter((v) => v > 0);
    if (nonZero.length > 0) {
      valorFrete = nonZero.at(-1) || null;
      valorTotal = nonZero.at(-1) || null;
    }

    const explicitTotal = flat.match(/Valor do Frete\s*[:\-]?\s*(R\$\s*[\d.]+,\d{2})/i);
    if (explicitTotal) {
      valorFrete = money(explicitTotal[1]);
      valorTotal = valorFrete;
    }
  }

  if (valorTotal === null) {
    // Alguns fornecedores apresentam o total sem o prefixo "R$" (por exemplo,
    // "Valor Total: 49.880,00"). O rótulo do total é obrigatório; só a moeda é opcional.
    const totalCandidates = [...flat.matchAll(/(?:valor\s+total|total\s+(?:geral|da proposta|do or[cç]amento)?|total)\s*[:\-]?\s*((?:R\$\s*)?[\d.]+,\d{2})/gi)]
      .map((m) => money(m[1]))
      .filter((v): v is number => v !== null);
    valorTotal = totalCandidates.at(-1) ?? null;
  }

  const descricaoObs = clean(
    section(flat, /Informa[cç][oõ]es adicionais|Observa[cç][aã]o/i).slice(0, 1500)
  );

  const itens = tipo === "insumo" ? parseItems(lines) : [];

  const identificados = {
    fornecedor_nome: companyLine || null,
    fornecedor_cnpj: fornecedorCnpj,
    fornecedor_endereco: fornecedorEndereco,
    fornecedor_contato: fornecedorContato,
    numero_proposta: numeroProposta,
    data_cotacao: dataCotacao,
    validade_data: validadeData,
    validade_dias: validadeDias,
    condicao_pagamento: condicaoPagamento,
    origem_frete: origemFrete,
    destino_frete: destinoFrete,
    peso_kg: pesoKg,
    cubagem_m3: cubagemM3,
    volumes,
    tipo_veiculo: tipoVeiculo,
    prazo_dias: prazoDias,
    valor_frete: valorFrete,
    valor_total: valorTotal,
    descricao: descricaoObs,
  };

  return {
    tipo,
    ...identificados,
    itens,
    diagnostico: {
      versao: "layout-v2",
      campos_identificados: Object.entries(identificados)
        .filter(([, value]) => value !== null && value !== "")
        .map(([key]) => key),
    },
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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const service = createClient(supabaseUrl, serviceKey);

    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { cotacao_id } = await req.json();
    if (!cotacao_id) throw new Error("cotacao_id obrigatório");

    const { data: cotacao, error: cotacaoError } = await userClient
      .from("cotacoes")
      .select("id,arquivo_path,arquivo_nome")
      .eq("id", cotacao_id)
      .single();

    if (cotacaoError || !cotacao) throw new Error(cotacaoError?.message || "Cotação não encontrada");
    if (!cotacao.arquivo_path) throw new Error("Cotação sem PDF vinculado");

    await userClient
      .from("cotacoes")
      .update({ leitura_status: "processando", leitura_erro: null })
      .eq("id", cotacao_id);

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

    const allLines: string[] = [];
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const page = await pdf.getPage(pageNo);
      const pageContent = await page.getTextContent();
      const pageLines = reconstructLines(pageContent.items as any[]).map((line) => line.text);
      allLines.push(...pageLines, "");
    }

    const lines = allLines
      .map((line) => line.replace(/\u0000/g, "").trim())
      .filter(Boolean);

    const text = lines.join("\n").trim();
    if (!text) {
      await userClient.from("cotacoes").update({
        leitura_status: "sem_texto",
        leitura_erro: "O PDF não possui camada de texto. Preencha manualmente ou use OCR.",
        texto_extraido: null,
      }).eq("id", cotacao_id);

      return new Response(JSON.stringify({ status: "sem_texto" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const parsed = parseDocument(lines, cotacao.arquivo_nome || "");

    const updatePayload: Record<string, any> = {
      tipo: parsed.tipo,
      fornecedor_nome: parsed.fornecedor_nome,
      fornecedor_cnpj: parsed.fornecedor_cnpj,
      fornecedor_endereco: parsed.fornecedor_endereco,
      fornecedor_contato: parsed.fornecedor_contato,
      numero_proposta: parsed.numero_proposta,
      data_cotacao: parsed.data_cotacao,
      validade_data: parsed.validade_data,
      validade_dias: parsed.validade_dias,
      condicao_pagamento: parsed.condicao_pagamento,
      descricao: parsed.descricao,
      origem_frete: parsed.origem_frete,
      destino_frete: parsed.destino_frete,
      peso_kg: parsed.peso_kg,
      cubagem_m3: parsed.cubagem_m3,
      volumes: parsed.volumes,
      tipo_veiculo: parsed.tipo_veiculo,
      prazo_dias: parsed.prazo_dias,
      valor_frete: parsed.valor_frete,
      valor_total: parsed.valor_total,
      texto_extraido: text.slice(0, 200000),
      leitura_json: parsed,
      leitura_status: "concluida",
      leitura_erro: null,
      status: "em_validacao",
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await userClient
      .from("cotacoes")
      .update(updatePayload)
      .eq("id", cotacao_id);
    if (updateError) throw updateError;

    await userClient.from("cotacao_itens").delete().eq("cotacao_id", cotacao_id);
    if (parsed.itens.length > 0) {
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
