// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type MultiMeasureRow = {
  key: string;
  comprimento: string;
  quantidade: string;
};

type Props = {
  rows: MultiMeasureRow[];
  onChange: (rows: MultiMeasureRow[]) => void;
  quantityLabel?: string;
  disabled?: boolean;
  compact?: boolean;
};

export const createMeasureRow = (
  comprimento = "",
  quantidade = "",
): MultiMeasureRow => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  comprimento,
  quantidade,
});

export function MultiMeasureEditor({
  rows,
  onChange,
  quantityLabel = "Qtd. planejada",
  disabled = false,
  compact = false,
}: Props) {
  const update = (key: string, field: "comprimento" | "quantidade", value: string) => {
    onChange(rows.map((row) => row.key === key ? { ...row, [field]: value } : row));
  };

  const remove = (key: string) => {
    onChange(rows.filter((row) => row.key !== key));
  };

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-primary/30 bg-primary/[0.03] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className={compact ? "text-xs font-semibold" : "text-sm font-semibold"}>
            Medidas da OP
          </Label>
          <p className="text-[11px] text-muted-foreground">
            Opcional. Se não adicionar medidas, a OP continua no modelo antigo.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => onChange([...rows, createMeasureRow()])}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Adicionar medida
        </Button>
      </div>

      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div key={row.key} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">
                  Comprimento {index + 1} (m)
                </Label>
                <Input
                  inputMode="decimal"
                  value={row.comprimento}
                  disabled={disabled}
                  onChange={(event) =>
                    update(
                      row.key,
                      "comprimento",
                      event.target.value.replace(/[^0-9,.]/g, ""),
                    )
                  }
                  placeholder="Ex.: 1,00"
                  className={compact ? "h-8 text-xs" : "h-9"}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">
                  {quantityLabel}
                </Label>
                <Input
                  inputMode="decimal"
                  value={row.quantidade}
                  disabled={disabled}
                  onChange={(event) =>
                    update(
                      row.key,
                      "quantidade",
                      event.target.value.replace(/[^0-9,.]/g, ""),
                    )
                  }
                  placeholder="0"
                  className={compact ? "h-8 text-xs" : "h-9"}
                />
              </div>

              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={disabled}
                onClick={() => remove(row.key)}
                className={compact ? "h-8 w-8" : "h-9 w-9"}
                title="Remover medida"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
