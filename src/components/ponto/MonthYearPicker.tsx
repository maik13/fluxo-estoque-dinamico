import { format, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface MonthYearPickerProps {
  value: string; // "yyyy-MM"
  onChange: (value: string) => void;
  className?: string;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function MonthYearPicker({ value, onChange, className }: MonthYearPickerProps) {
  const [open, setOpen] = useState(false);
  const year = parseInt(value.split("-")[0]);
  const month = parseInt(value.split("-")[1]) - 1;
  const [viewYear, setViewYear] = useState(year);

  const displayLabel = format(new Date(year, month, 1), "MMMM 'de' yyyy", { locale: ptBR });

  const handlePrev = () => {
    const d = subMonths(new Date(year, month, 1), 1);
    onChange(format(d, "yyyy-MM"));
  };

  const handleNext = () => {
    const d = addMonths(new Date(year, month, 1), 1);
    onChange(format(d, "yyyy-MM"));
  };

  const handleSelectMonth = (m: number) => {
    const val = `${viewYear}-${(m + 1).toString().padStart(2, "0")}`;
    onChange(val);
    setOpen(false);
  };

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) setViewYear(year);
    setOpen(isOpen);
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={handlePrev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Popover open={open} onOpenChange={handleOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="min-w-[200px] justify-start gap-2 capitalize">
            <Calendar className="h-4 w-4 opacity-60" />
            {displayLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-3" align="start">
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewYear(v => v - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-sm">{viewYear}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewYear(v => v + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {MONTHS.map((name, i) => {
              const isSelected = viewYear === year && i === month;
              return (
                <Button
                  key={i}
                  variant={isSelected ? "default" : "ghost"}
                  size="sm"
                  className={cn("text-xs h-8", isSelected && "pointer-events-none")}
                  onClick={() => handleSelectMonth(i)}
                >
                  {name.substring(0, 3)}
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={handleNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
