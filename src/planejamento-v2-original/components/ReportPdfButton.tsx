// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCompanyLogo } from "@/planejamento-v2-original/hooks/useCompanyLogo";
import { exportSectionsToPdf, type DashboardPdfOptions } from "@/planejamento-v2-original/lib/dashboardPdfExport";

interface ReportPdfButtonProps {
  reportName: string;
  targetId: string;
  filtersSummary?: string;
  selectedRowIds?: string[];
  orientation?: DashboardPdfOptions["orientation"];
  pageFormat?: DashboardPdfOptions["pageFormat"];
  expandScrollContent?: boolean;
  disabled?: boolean;
  label?: string;
  className?: string;
  onBeforeExport?: () => void;
}

export function ReportPdfButton({
  reportName,
  targetId,
  filtersSummary,
  selectedRowIds,
  orientation = "landscape",
  pageFormat = "a4",
  expandScrollContent = true,
  disabled = false,
  label = "Gerar PDF",
  className,
  onBeforeExport,
}: ReportPdfButtonProps) {
  const [exporting, setExporting] = useState(false);
  const { logoUrl, companyName } = useCompanyLogo();

  const handleExport = async () => {
    const content = document.getElementById(targetId);
    if (!content) {
      toast.error("Não foi possível localizar o conteúdo deste relatório.");
      return;
    }

    onBeforeExport?.();
    setExporting(true);
    try {
      await exportSectionsToPdf({
        reportName,
        sections: [content],
        filtersSummary,
        logoUrl,
        companyName,
        selectedRowIds,
        orientation,
        pageFormat,
        expandScrollContent,
      });
      toast.success(`PDF "${reportName}" gerado com sucesso.`);
    } catch (error) {
      console.error("[pdf-export] erro ao gerar relatório", error);
      toast.error("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleExport()}
      disabled={disabled || exporting}
      data-pdf-hide
      className={className || "inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent disabled:pointer-events-none disabled:opacity-50"}
    >
      {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      {exporting ? "Gerando PDF..." : label}
    </button>
  );
}
