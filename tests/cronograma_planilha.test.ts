import { describe, expect, it } from "vitest";
import { lerCronogramaPlanilha } from "@/components/integracoes/cronogramaPlanilha";

describe("lerCronogramaPlanilha", () => {
  it("cria uma atividade por linha de Dia/Turno com a data da planilha", () => {
    const r = lerCronogramaPlanilha([
      ["Dia", "Data & Dia", "Turno", "Frentes Ativas"],
      ["Dia 1", "11/11/2026 (Qua)", "Manhã", "Torii | Túnel 40m"],
      ["", "", "", "flor de lotus"],
      ["Dia 8", "18/11/2026 (Qua)", "Tarde", "Encerramento"],
    ]);
    expect(r).toEqual([
      { title: "Dia 1 · Manhã — Torii | Túnel 40m", start_date: "2026-11-11", end_date: "2026-11-11" },
      { title: "Dia 8 · Tarde — Encerramento", start_date: "2026-11-18", end_date: "2026-11-18" },
    ]);
  });
  it("ignora linhas sem data válida", () => {
    expect(lerCronogramaPlanilha([["Dia 2", "sem data", "Manhã", "X"]])).toEqual([]);
  });
});
