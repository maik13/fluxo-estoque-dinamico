export type AtividadeImportada = { title: string; start_date: string; end_date: string };

const DATA_RE = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;

/** Converte as linhas da aba de cronograma (Dia | Data & Dia | Turno | Frentes | ...) em atividades. */
export function lerCronogramaPlanilha(linhas: unknown[][]): AtividadeImportada[] {
  const out: AtividadeImportada[] = [];
  for (const raw of linhas) {
    const r = (raw || []).map((c) => (c == null ? "" : String(c).trim()));
    const dia = r[0] || "";
    if (!/^dia\s*\d+/i.test(dia)) continue;
    const m = DATA_RE.exec(r[1] || "");
    if (!m) continue;
    const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    const turno = r[2] || "";
    const frentes = r[3] || "";
    const title = [`${dia}${turno ? ` · ${turno}` : ""}`, frentes].filter(Boolean).join(" — ").slice(0, 240);
    out.push({ title, start_date: iso, end_date: iso });
  }
  return out;
}
