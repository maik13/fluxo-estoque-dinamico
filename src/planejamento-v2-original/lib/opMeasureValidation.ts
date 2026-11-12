// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
export type MeasureInputRow = {
  key?: string;
  comprimento: string | number;
  quantidade?: string | number | null;
};

export type OperationalMeasureValidationOptions = {
  requireQuantity?: boolean;
};

const parseDecimal = (value: string | number | null | undefined) =>
  Number(String(value ?? "").trim().replace(",", "."));

export function parseMeasureRows(rows: MeasureInputRow[]) {
  const parsed = rows
    .map((row, index) => ({
      comprimento: parseDecimal(row.comprimento),
      quantidade: String(row.quantidade ?? "").trim()
        ? parseDecimal(row.quantidade)
        : null,
      ordem: index,
    }))
    .filter((row) => Number.isFinite(row.comprimento) && row.comprimento > 0);

  const seen = new Set<string>();
  for (const row of parsed) {
    const key = row.comprimento.toFixed(3);
    if (seen.has(key)) throw new Error(`O comprimento ${row.comprimento} m foi informado mais de uma vez.`);
    seen.add(key);
    if (row.quantidade != null && (!Number.isFinite(row.quantidade) || row.quantidade < 0)) {
      throw new Error("As quantidades por medida devem ser maiores ou iguais a zero.");
    }
  }

  return parsed;
}

export function validateOperationalMeasureRows(
  rows: MeasureInputRow[],
  options: OperationalMeasureValidationOptions = {},
) {
  const requireQuantity = options.requireQuantity === true;
  if (!rows.length) {
    throw new Error("Informe pelo menos uma medida para esta OP.");
  }

  const seen = new Set<string>();
  return rows.map((row, index) => {
    const rawLength = String(row.comprimento ?? "").trim();
    const rawQuantity = String(row.quantidade ?? "").trim();

    if (!rawLength && !rawQuantity) {
      throw new Error(`Preencha ou remova a medida vazia da linha ${index + 1}.`);
    }

    const comprimento = parseDecimal(rawLength);
    if (!rawLength || !Number.isFinite(comprimento) || comprimento <= 0) {
      throw new Error(`Informe um comprimento válido e maior que zero na linha ${index + 1}.`);
    }

    const key = comprimento.toFixed(3);
    if (seen.has(key)) {
      throw new Error(`O comprimento ${comprimento} m foi informado mais de uma vez.`);
    }
    seen.add(key);

    if (requireQuantity && !rawQuantity) {
      throw new Error(`Informe a quantidade produzida para ${comprimento} m.`);
    }

    const quantidade = rawQuantity ? parseDecimal(rawQuantity) : null;
    if (quantidade != null && (!Number.isFinite(quantidade) || quantidade < 0)) {
      throw new Error(`A quantidade da medida ${comprimento} m deve ser maior ou igual a zero.`);
    }

    return { comprimento, quantidade, ordem: index };
  });
}

export function sumMeasureQuantities(rows: MeasureInputRow[]) {
  return rows.reduce((sum, row) => {
    const value = parseDecimal(row.quantidade);
    return sum + (Number.isFinite(value) && value >= 0 ? value : 0);
  }, 0);
}

export function resolveProductionLogLength(rows: MeasureInputRow[]) {
  const parsed = parseMeasureRows(rows);
  return parsed.length === 1 ? parsed[0].comprimento : null;
}
