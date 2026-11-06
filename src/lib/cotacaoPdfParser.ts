/* eslint-disable no-useless-escape */
/* Parser compartilhado para PDFs com texto e OCR local. */
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
    "valor equipamento",
    "valor do equipamento",
    "quantidade",
    "unidade",
    "produto",
    "material",
    "subtotal",
  ].filter((x) => t.includes(x)).length;

  if (freteScore >= 2 && freteScore > insumoScore) return "frete";
  if (insumoScore >= 2 || /orçamento completo|condições comerciais/i.test(text)) return "insumo";
  return "global";
};

const findLine = (lines: string[], pattern: RegExp) =>
  lines.find((line) => pattern.test(line)) || null;

const valueFromLabeledLine = (lines: string[], label: RegExp) => {
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const match = line.match(label);
    if (!match) continue;
    const rest = clean(line.slice((match.index || 0) + match[0].length).replace(/^\s*[:\-]\s*/, ""));
    if (rest && rest.length <= 140 && !/(?:CNPJ|Cidade|Data\/Hora|Validade|Usuário|Página|Telefone|Fax)\s*:/i.test(rest)) {
      return rest;
    }
    // Muitos PDFs trazem o rótulo numa célula e o conteúdo na linha seguinte.
    const next = clean(lines[index + 1]);
    if (next && next.length <= 180 && !/^(?:CNPJ|Cidade|Data\/Hora|Validade|Usuário|Página|Telefone|Fax)\s*:/i.test(next)) {
      return next;
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

const unidadeItem = "un|und|unid|pc|pç|peça|peca|kg|g|m|m2|m²|m3|m³|lt|l|cx|pct|rolo|rl";
const valorBr = "(?:R\\$\\s*)?\\d{1,3}(?:\\.\\d{3})*(?:,\\d{2,4})?|(?:R\\$\\s*)?\\d+(?:,\\d{2,4})?";

const parseItems = (lines: string[]): ParsedItem[] => {
  const items: ParsedItem[] = [];
  const lineRegex = new RegExp(`^(.{3,}?)\\s+(\\d+(?:[.,]\\d+)?)\\s*(${unidadeItem})\\s+(${valorBr})\\s+(${valorBr})$`, "i");
  const lineWithoutUnitRegex = new RegExp(`^(.{3,}?)\\s+(\\d+(?:[.,]\\d+)?)\\s+(${valorBr})\\s+(${valorBr})$`, "i");
  const detailsRegex = /^(?:especifica[cç][aã]o|espec\.?|marca|modelo|cor|medidas?|dimens[oõ]es|observa[cç][aã]o)\s*[:\-]/i;

  for (let index = 0; index < lines.length; index++) {
    let line = lines[index];
    // Alguns fornecedores quebram a descrição da tabela exatamente antes das colunas numéricas.
    if (index + 1 < lines.length && !line.match(/\d+(?:[.,]\d+)?\s*(?:un|und|kg|m|l)\b/i)) {
      const joined = `${line} ${lines[index + 1]}`;
      if (lineRegex.test(joined) || lineWithoutUnitRegex.test(joined)) {
        line = joined;
        index += 1;
      }
    }
    const m = line.match(lineRegex) || line.match(lineWithoutUnitRegex);
    if (!m) continue;
    let descricao = m[1].trim();
    if (/subtotal|total|frete|desconto|imposto/i.test(descricao)) continue;
    const hasUnit = m.length === 6;
    const unitIndex = hasUnit ? 3 : -1;
    const unit = hasUnit ? m[unitIndex] : "UN";
    const unitPriceIndex = hasUnit ? 4 : 3;
    const totalIndex = hasUnit ? 5 : 4;

    // Mantém o detalhamento que o fornecedor colocou abaixo do item, em vez de descartá-lo.
    while (index + 1 < lines.length && detailsRegex.test(lines[index + 1])) {
      descricao = `${descricao} — ${lines[index + 1]}`;
      index += 1;
    }
    items.push({
      descricao,
      quantidade: decimal(m[2]),
      unidade: unit,
      valor_unitario: money(m[unitPriceIndex]),
      valor_total: money(m[totalIndex]),
    });
    if (items.length >= 100) break;
  }
  return items;
};

// Alguns locadores não usam uma tabela convencional. No orçamento da Casa do
// Construtor, por exemplo, a quantidade fica ao fim do nome do equipamento e
// o preço unitário e o total aparecem em células separadas, em duas linhas.
const parseRentalItems = (lines: string[]): ParsedItem[] => {
  const items: ParsedItem[] = [];
  const valuePattern = `${valorBr}`;
  const unitPriceRegex = new RegExp(
    `valor\\s+unit[aá]rio(?:\\s+(?:do\\s+)?equipamento)?\\s*:\\s*(${valuePattern})`,
    "i",
  );
  const totalValueRegex = new RegExp(
    `valor\\s+(?:(?:do\\s+)?equipamento(?:\\(s\\))?|total)\\s*:\\s*(${valuePattern})`,
    "i",
  );
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const unitMatch = line.match(unitPriceRegex);
    if (!unitMatch?.index && unitMatch?.index !== 0) continue;

    const beforePrice = clean(line.slice(0, unitMatch.index)) || "";
    const quantityMatch = beforePrice.match(/^(.*?)(?:\s+(?:qtde|quantidade)\s*:?\s*)?(\d+(?:[.,]\d+)?)\s*$/i);
    const detailsAroundItem = lines.slice(index, index + 4).join(" ");
    const quantityFromDetails = detailsAroundItem.match(/quantidade\s*:?\s*(\d+(?:[.,]\d+)?)/i);

    // Há fornecedores que exibem a quantidade na linha do código, abaixo da
    // descrição. Nesse caso, preservamos a descrição e buscamos a quantidade
    // naquela linha, em vez de descartar a peça do orçamento.
    const descricaoBase = quantityMatch?.[1] || beforePrice;
    const quantidade = decimal(quantityMatch?.[2] || quantityFromDetails?.[1]);
    let descricao = clean(descricaoBase.replace(/^[+|•\-\s]+/, ""));
    if (!descricao || quantidade === null || /^(?:descri[cç][aã]o|produto|item)$/i.test(descricao)) continue;

    const codigo = detailsAroundItem.match(/c[oó]digo\s*:\s*([A-Z0-9][A-Z0-9.\-/]+)/i)?.[1];
    if (codigo && !descricao.toLocaleLowerCase("pt-BR").includes(`código ${codigo}`.toLocaleLowerCase("pt-BR"))) {
      descricao = `${descricao} — Código ${codigo}`;
    }

    let valorTotal: number | null = null;
    for (let offset = 0; offset <= 3 && index + offset < lines.length; offset++) {
      const candidate = lines[index + offset];
      const match = candidate.match(totalValueRegex);
      if (match) {
        valorTotal = money(match[1]);
        break;
      }
    }

    items.push({
      descricao,
      quantidade,
      unidade: "UN",
      valor_unitario: money(unitMatch[1]),
      valor_total: valorTotal,
    });
    if (items.length >= 100) break;
  }

  return items;
};

export const parseCotacaoDocumento = (lines: string[], fileName: string) => {
  const text = lines.join("\n");
  const flat = lines.join(" ").replace(/\s+/g, " ");
  const tipo = classify(flat);

  const headerText = lines.slice(0, 25).join("\n");
  const beforeRemetente = flat.split(/CNPJ\s+Remetente/i)[0] || flat;

  const companyLine =
    lines.slice(0, 18).find((line) => /\b(?:LTDA|EIRELI|S\/?A|ME)\b/i.test(line)) ||
    valueFromLabeledLine(lines, /(?:Fornecedor|Empresa|Transportadora|Raz[aã]o Social)/i) ||
    lines.slice(0, 18).find((line) => /\bcasa\s+do\s+construtor\b/i.test(line));

  const cnpjCandidates = [...beforeRemetente.matchAll(/\b(?:\d[.\/-]?){14,18}\b/g)]
    .map((m) => normalizeCnpj(m[0]))
    .filter((v): v is string => Boolean(v));
  const fornecedorCnpj = cnpjCandidates[0] || null;

  const addressLabel = valueFromLabeledLine(lines, /(?:Endere[cç]o|End\.?|Logradouro)/i);
  const streetLine = addressLabel || lines.slice(0, 28).find((line) =>
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

  if (!numeroProposta) {
    numeroProposta = flat.match(/N[uú]mero\s*[-:]\s*(\d{2,12})/i)?.[1] || null;
  }

  if (!numeroProposta || !/[0-9]/.test(numeroProposta)) {
    numeroProposta =
      fileName.match(/(?:COTA(?:Ç|C)[AÃ]O|PROPOSTA)[-_\s]*(\d{2,12})/i)?.[1]
      || null;
  }

  const dataCotacao =
    findDateNearLabel(lines, /Data\/Hora/i)
    || findDateNearLabel(lines, /Data d[ao] (?:Cota[cç][aã]o|Or[cç]amento)/i)
    || findDateNearLabel(lines, /Emiss[aã]o/i);

  const validadeData = findDateNearLabel(lines, /Validade/i);
  let validadeDias: number | null = null;
  const diasValidade = flat.match(/Validade(?:\s+do\s+or[cç]amento)?\s*[:\-]?\s*(\d{1,3})\s*dias?/i);
  if (diasValidade) validadeDias = Number(diasValidade[1]);

  const explicitCondition = valueFromLabeledLine(lines, /(?:Condi[cç][aã]o|Forma) de pagamento/i);
  const paymentSentence = flat.match(/PAGAMENTO\s*[:\-]?\s*(.{3,180}?)(?=\s+(?:PRAZO|SE\s+HOUVER|REENTREGA|DEVOLU[CÇ][AÃ]O|SEGURO|VALIDADE)\b|[.]\s|$)/i);
  const periodoLocacao = flat.match(/\b(Di[aá]rio|Semanal|Quinzenal|Mensal)\b/i)?.[1];
  const condicaoPagamento = clean(
    explicitCondition
      || (paymentSentence ? `PAGAMENTO ${paymentSentence[1]}` : null)
      || (periodoLocacao ? `Locação ${periodoLocacao.toLowerCase()} (conforme orçamento)` : null),
  );

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
    const totalCandidates = [...flat.matchAll(/(?:valor\s+(?:total|final)|total\s+(?:geral|da proposta|do or[cç]amento|a pagar)?|total)\s*[:\-]?\s*(R\$\s*[\d.]+,\d{2}|\d{1,3}(?:\.\d{3})*,\d{2})/gi)]
      .map((m) => money(m[1]))
      .filter((v): v is number => v !== null);
    valorTotal = totalCandidates.at(-1) ?? null;
  }

  const descricaoObs = clean(
    section(flat, /Informa[cç][oõ]es adicionais|Observa[cç][aã]o/i).slice(0, 1500)
  );

  const itensPadrao = tipo === "insumo" ? parseItems(lines) : [];
  const itens = itensPadrao.length > 0 ? itensPadrao : parseRentalItems(lines);

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

