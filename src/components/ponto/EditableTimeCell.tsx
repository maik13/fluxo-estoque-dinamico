import { useState, useRef, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Clock, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditableTimeCellProps {
  value: string | null; // "HH:mm" or null
  onChange: (newValue: string | null) => void;
  disabled?: boolean;
}

function minutesToTimeStr(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function timeStrToMinutes(time: string | null): number {
  if (!time) return 0;
  const [h, m] = time.substring(0, 5).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function EditableTimeCell({ value, onChange, disabled }: EditableTimeCellProps) {
  const [open, setOpen] = useState(false);
  const [sliderValue, setSliderValue] = useState(timeStrToMinutes(value));
  const displayValue = value ? value.substring(0, 5) : "-";

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setSliderValue(timeStrToMinutes(value));
    }
    setOpen(isOpen);
  };

  const handleConfirm = () => {
    onChange(minutesToTimeStr(sliderValue));
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setOpen(false);
  };

  if (disabled) {
    return (
      <span className="font-mono text-sm">{displayValue}</span>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "font-mono text-sm cursor-pointer hover:bg-primary/10 px-2 py-1 rounded transition-colors",
            value ? "text-foreground" : "text-muted-foreground"
          )}
          title="Clique para ajustar o horário"
        >
          {displayValue}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4 bg-popover border-border z-50" align="center" side="top">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4 text-primary" />
              Ajustar Horário
            </div>
            <span className="text-2xl font-bold font-mono text-primary">
              {minutesToTimeStr(sliderValue)}
            </span>
          </div>

          {/* Hours slider */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Hora</label>
            <Slider
              min={0}
              max={23}
              step={1}
              value={[Math.floor(sliderValue / 60)]}
              onValueChange={([h]) => setSliderValue(h * 60 + (sliderValue % 60))}
            />
          </div>

          {/* Minutes slider */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Minuto</label>
            <Slider
              min={0}
              max={59}
              step={1}
              value={[sliderValue % 60]}
              onValueChange={([m]) => setSliderValue(Math.floor(sliderValue / 60) * 60 + m)}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={handleClear} className="text-destructive">
              <X className="h-3 w-3 mr-1" />
              Limpar
            </Button>
            <Button size="sm" onClick={handleConfirm}>
              <Check className="h-3 w-3 mr-1" />
              Salvar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
