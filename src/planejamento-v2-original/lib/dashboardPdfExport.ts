// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/**
 * Exportação de relatórios do Painel Executivo para PDF.
 * - Captura seções renderizadas do dashboard (KPIs, cards, tabelas e gráficos Recharts).
 * - Gráficos SVG são rasterizados em PNG (com resolução das variáveis CSS do tema).
 * - O PDF sai em tema claro, com logo, nome da empresa, nome do relatório e filtros aplicados.
 */

const CHART_SELECTOR = ".recharts-responsive-container svg";
const EXPORT_MARK = "data-pdf-export-target";

/** Resolve `hsl(var(--token))` para o valor computado real do tema. */
function resolveCssVars(svgClone: SVGElement) {
  const computedStyle = getComputedStyle(document.documentElement);
  const resolveVar = (val: string): string =>
    val.replace(/hsl\(var\(--([^)]+)\)\)/g, (_, varName) => {
      const resolved = computedStyle.getPropertyValue(`--${varName}`).trim();
      return resolved ? `hsl(${resolved})` : val;
    });
  svgClone.querySelectorAll("*").forEach((el) => {
    const htmlEl = el as HTMLElement;
    ["fill", "stroke", "color", "stop-color"].forEach((attr) => {
      const val = htmlEl.getAttribute(attr);
      if (val && val.includes("var(")) htmlEl.setAttribute(attr, resolveVar(val));
    });
    if (htmlEl.style) {
      ["fill", "stroke", "color"].forEach((prop) => {
        const val = htmlEl.style.getPropertyValue(prop);
        if (val && val.includes("var(")) htmlEl.style.setProperty(prop, resolveVar(val));
      });
    }
  });
}

/** Converte um SVG (Recharts) em PNG dataURL. Retorna null em falha. */
async function svgToPngDataUrl(svg: SVGSVGElement): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const rect = svg.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return null;
    const svgClone = svg.cloneNode(true) as SVGElement;
    resolveCssVars(svgClone);
    svgClone.setAttribute("width", String(rect.width));
    svgClone.setAttribute("height", String(rect.height));
    const svgData = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(rect.width * 2);
      canvas.height = Math.round(rect.height * 2);
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      return { dataUrl: canvas.toDataURL("image/png"), width: rect.width, height: rect.height };
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error("[pdf-export] falha ao converter gráfico", error);
    return null;
  }
}

/** Baixa uma imagem (logo) e devolve como dataURL; null se falhar (ex.: CORS). */
async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

interface CaptureResult {
  canvas: HTMLCanvasElement;
  title?: string;
}

/** Captura uma seção do DOM com tema claro forçado e gráficos substituídos por imagens. */
async function captureSection(
  element: HTMLElement,
  options: Pick<DashboardPdfOptions, "expandScrollContent" | "selectedRowIds"> = {},
): Promise<CaptureResult> {
  const title = element.getAttribute("data-report-name") || undefined;
  let captureWidth = element.scrollWidth;
  let captureHeight = element.scrollHeight;

  if (options.expandScrollContent) {
    const rootBounds = element.getBoundingClientRect();
    element.querySelectorAll<HTMLElement>("[data-pdf-expand], .overflow-auto, .overflow-x-auto, .overflow-y-auto").forEach((scrollable) => {
      const bounds = scrollable.getBoundingClientRect();
      const offsetX = Math.max(0, Math.round(bounds.left - rootBounds.left));
      const offsetY = Math.max(0, Math.round(bounds.top - rootBounds.top));
      captureWidth = Math.max(captureWidth, offsetX + scrollable.scrollWidth);
      captureHeight = Math.max(captureHeight, offsetY + scrollable.scrollHeight);
    });

    if (options.selectedRowIds?.length) {
      const selectedIds = new Set(options.selectedRowIds);
      element.querySelectorAll<HTMLElement>("[data-pdf-row-id]").forEach((row) => {
        if (!selectedIds.has(row.getAttribute("data-pdf-row-id") || "")) {
          captureHeight -= Math.round(row.getBoundingClientRect().height);
        }
      });
      captureHeight = Math.max(captureHeight, 1);
    }
  }

  // 1) Rasteriza os gráficos do elemento original (na ordem do DOM).
  const originalSvgs = Array.from(element.querySelectorAll(CHART_SELECTOR)) as SVGSVGElement[];
  const chartImages = await Promise.all(originalSvgs.map((svg) => svgToPngDataUrl(svg)));

  // 2) Marca o elemento para localizá-lo dentro do clone.
  element.setAttribute(EXPORT_MARK, "1");
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      width: captureWidth,
      ...(options.expandScrollContent ? { height: captureHeight } : {}),
      windowWidth: Math.max(document.documentElement.clientWidth, captureWidth),
      onclone: (clonedDoc) => {
        // Força tema claro no clone (tokens semânticos voltam ao :root claro).
        clonedDoc.documentElement.classList.remove("dark");
        clonedDoc.documentElement.style.colorScheme = "light";
        const clonedTarget = clonedDoc.querySelector(`[${EXPORT_MARK}="1"]`) as HTMLElement | null;
        if (!clonedTarget) return;

        if (options.expandScrollContent) {
          clonedTarget.style.width = `${captureWidth}px`;
          clonedTarget.style.maxWidth = "none";
          clonedTarget.style.minHeight = "0";
          clonedTarget.style.maxHeight = "none";
          clonedTarget.style.overflow = "visible";
          clonedTarget.scrollLeft = 0;
          clonedTarget.scrollTop = 0;
        }

        // Expande áreas com scroll para capturar o conteúdo completo.
        const overflowSelector = options.expandScrollContent
          ? "[data-pdf-expand], .overflow-x-auto, .overflow-y-auto, .overflow-auto, .overflow-hidden"
          : ".overflow-x-auto, .overflow-y-auto, .overflow-auto";
        clonedTarget.querySelectorAll<HTMLElement>(overflowSelector).forEach((el) => {
          el.style.overflow = "visible";
          el.style.maxHeight = "none";
          if (options.expandScrollContent) {
            el.style.maxWidth = "none";
            el.scrollLeft = 0;
            el.scrollTop = 0;
          }
        });

        if (options.selectedRowIds?.length) {
          const selectedIds = new Set(options.selectedRowIds);
          clonedTarget.querySelectorAll<HTMLElement>("[data-pdf-row-id]").forEach((row) => {
            if (!selectedIds.has(row.getAttribute("data-pdf-row-id") || "")) row.remove();
          });
        }

        // Substitui os SVGs do clone pelas imagens PNG geradas do original.
        const clonedSvgs = Array.from(clonedTarget.querySelectorAll(CHART_SELECTOR));
        clonedSvgs.forEach((clonedSvg, index) => {
          const chart = chartImages[index];
          if (!chart) return;
          const img = clonedDoc.createElement("img");
          img.src = chart.dataUrl;
          img.style.width = `${chart.width}px`;
          img.style.height = `${chart.height}px`;
          img.style.display = "block";
          clonedSvg.parentNode?.replaceChild(img, clonedSvg);
        });

        // Remove elementos marcados como não imprimíveis.
        clonedTarget.querySelectorAll("[data-pdf-hide]").forEach((el) => el.remove());
      },
    });
    return { canvas, title };
  } finally {
    element.removeAttribute(EXPORT_MARK);
  }
}

export interface DashboardPdfOptions {
  /** Nome do relatório exibido no cabeçalho. */
  reportName: string;
  /** Seções (elementos DOM) que compõem o relatório, em ordem. */
  sections: HTMLElement[];
  /** Resumo dos filtros aplicados (ex.: "Projeto: TOCTAO · Período: 01/08/2026 a 22/08/2026"). */
  filtersSummary?: string;
  logoUrl?: string | null;
  companyName?: string | null;
  orientation?: "portrait" | "landscape";
  pageFormat?: "a4" | "a3";
  expandScrollContent?: boolean;
  selectedRowIds?: string[];
}

const PAGE_FORMATS = {
  a4: { width: 210, height: 297 },
  a3: { width: 297, height: 420 },
} as const;
const MARGIN_X = 10;
const MARGIN_BOTTOM = 14;
const FIRST_HEADER_H = 32;
const HEADER_H = 14;
const MIN_SECTION_SPACE = 18;
const SECTION_GAP = 5;

/** Gera e baixa o PDF do relatório. */
export async function exportSectionsToPdf(options: DashboardPdfOptions): Promise<void> {
  const { reportName, sections, filtersSummary, logoUrl, companyName } = options;
  const orientation = options.orientation || "portrait";
  const pageFormat = options.pageFormat || "a4";
  const dimensions = PAGE_FORMATS[pageFormat];
  const pageWidth = orientation === "landscape" ? dimensions.height : dimensions.width;
  const pageHeight = orientation === "landscape" ? dimensions.width : dimensions.height;
  const validSections = sections.filter(Boolean);
  if (!validSections.length) throw new Error("Nenhuma seção disponível para exportar.");

  const captured: CaptureResult[] = [];
  for (const section of validSections) {
    captured.push(await captureSection(section, options));
  }

  const logoDataUrl = logoUrl ? await urlToDataUrl(logoUrl) : null;

  const pdf = new jsPDF(orientation === "landscape" ? "l" : "p", "mm", pageFormat);
  const generatedAt = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  const drawHeader = () => {
    const textX = logoDataUrl ? MARGIN_X + 34 : MARGIN_X;
    if (logoDataUrl) {
      try {
        pdf.addImage(logoDataUrl, "PNG", MARGIN_X, 6, 30, 14, undefined, "FAST");
      } catch {
        try {
          pdf.addImage(logoDataUrl, "JPEG", MARGIN_X, 6, 30, 14, undefined, "FAST");
        } catch {
          /* logo ignorado em caso de formato inválido */
        }
      }
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.setTextColor(5, 122, 85); // emerald-700
    pdf.text(reportName, textX, 12);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(40, 40, 40);
    pdf.text(companyName || "App Controle", textX, 18);
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    const meta = [`Gerado em ${generatedAt}`, filtersSummary].filter(Boolean).join("  ·  ");
    pdf.text(pdf.splitTextToSize(meta, pageWidth - textX - MARGIN_X), textX, 23);
    pdf.setDrawColor(5, 122, 85);
    pdf.setLineWidth(0.6);
    pdf.line(MARGIN_X, FIRST_HEADER_H - 2, pageWidth - MARGIN_X, FIRST_HEADER_H - 2);
  };

  const drawSlimHeader = () => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(5, 122, 85);
    pdf.text(`${companyName || "App Controle"} — ${reportName}`, MARGIN_X, 8);
    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.3);
    pdf.line(MARGIN_X, HEADER_H - 3, pageWidth - MARGIN_X, HEADER_H - 3);
  };

  const contentW = pageWidth - MARGIN_X * 2;
  let cursorY = FIRST_HEADER_H;

  pdf.setPage(1);
  drawHeader();

  const startNextPage = () => {
    pdf.addPage();
    drawSlimHeader();
    cursorY = HEADER_H;
  };

  for (const section of captured) {
    const { canvas } = section;
    if (canvas.width <= 0 || canvas.height <= 0) continue;

    const pxPerMm = canvas.width / contentW;
    let offsetPx = 0;

    while (offsetPx < canvas.height) {
      const availFromCursor = pageHeight - cursorY - MARGIN_BOTTOM;
      if (availFromCursor < MIN_SECTION_SPACE) {
        startNextPage();
        continue;
      }

      const slicePx = Math.min(canvas.height - offsetPx, Math.floor(availFromCursor * pxPerMm));
      if (slicePx <= 0) {
        startNextPage();
        continue;
      }

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = slicePx;
      const ctx = pageCanvas.getContext("2d");
      if (!ctx) break;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(canvas, 0, offsetPx, canvas.width, slicePx, 0, 0, canvas.width, slicePx);

      const sliceHeightMm = slicePx / pxPerMm;
      pdf.addImage(pageCanvas.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN_X, cursorY, contentW, sliceHeightMm, undefined, "FAST");

      offsetPx += slicePx;
      cursorY += sliceHeightMm;
      if (offsetPx < canvas.height) {
        startNextPage();
      }
    }

    // As seções compartilham a página quando há espaço, sem capas em branco.
    if (section !== captured[captured.length - 1]) {
      cursorY += SECTION_GAP;
    }
  }

  // Rodapé com paginação.
  const totalPages = pdf.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(130, 130, 130);
    pdf.text(`Página ${page} de ${totalPages}`, pageWidth - MARGIN_X, pageHeight - 6, { align: "right" });
    pdf.text(companyName || "App Controle", MARGIN_X, pageHeight - 6);
  }

  const safeName = reportName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  pdf.save(`relatorio-${safeName || "painel"}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
