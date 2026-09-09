import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface InputCurrencyProps extends Omit<React.ComponentProps<"input">, "type" | "onChange" | "value"> {
  value: number | string | null | undefined;
  onChange: (value: number) => void;
  allowEmpty?: boolean;
  onClear?: () => void;
}

const parseCurrencyValue = (value: number | string | null | undefined): number | null => {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const raw = String(value).trim().replace(/R\$/gi, "").replace(/\s/g, "");
  if (!raw) return null;

  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");
  let normalized = raw;

  if (hasComma && hasDot) {
    const decimalIndex = Math.max(raw.lastIndexOf(","), raw.lastIndexOf("."));
    const integerPart = raw.slice(0, decimalIndex).replace(/\D/g, "") || "0";
    const decimalPart = raw.slice(decimalIndex + 1).replace(/\D/g, "");
    normalized = `${integerPart}.${decimalPart}`;
  } else if (hasComma) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (hasDot) {
    const dots = (raw.match(/\./g) || []).length;
    const lastPart = raw.slice(raw.lastIndexOf(".") + 1);
    if (dots > 1 || lastPart.length === 3) {
      normalized = raw.replace(/\./g, "");
    }
  }

  const numericValue = Number(normalized.replace(/[^\d.-]/g, ""));
  return Number.isFinite(numericValue) ? numericValue : null;
};

const formatCurrencyValue = (
  value: number | string | null | undefined,
  allowEmpty = false
): string => {
  const numericValue = parseCurrencyValue(value);
  if (numericValue === null) return allowEmpty ? "" : "0,00";

  return numericValue.toLocaleString("pt-BR", {
    useGrouping: true,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const sanitizeCurrencyInput = (rawValue: string): string => {
  const cleaned = rawValue.replace(/R\$/gi, "").replace(/[^\d.,]/g, "");
  if (!cleaned) return "";

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (!hasComma && !hasDot) {
    return cleaned.replace(/^0+(?=\d)/, "") || "0";
  }

  let decimalIndex: number;

  if (hasComma && hasDot) {
    decimalIndex = Math.max(cleaned.lastIndexOf(","), cleaned.lastIndexOf("."));
  } else {
    const separator = hasComma ? "," : ".";
    const occurrences = cleaned.split(separator).length - 1;

    if (occurrences > 1) {
      decimalIndex = cleaned.lastIndexOf(separator);
    } else {
      decimalIndex = cleaned.indexOf(separator);
    }
  }

  const integerPart = cleaned.slice(0, decimalIndex).replace(/\D/g, "").replace(/^0+(?=\d)/, "") || "0";
  const decimalPart = cleaned.slice(decimalIndex + 1).replace(/\D/g, "").slice(0, 2);

  return `${integerPart},${decimalPart}`;
};

const InputCurrency = React.forwardRef<HTMLInputElement, InputCurrencyProps>(
  ({ className, value, onChange, allowEmpty = false, onClear, onFocus, onBlur, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(() => formatCurrencyValue(value, allowEmpty));
    const [isFocused, setIsFocused] = React.useState(false);

    React.useEffect(() => {
      if (!isFocused) {
        setDisplayValue(formatCurrencyValue(value, allowEmpty));
      }
    }, [value, isFocused, allowEmpty]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const sanitized = sanitizeCurrencyInput(event.target.value);
      setDisplayValue(sanitized);

      if (!sanitized) {
        if (allowEmpty) {
          onClear?.();
        } else {
          onChange(0);
        }
        return;
      }

      const numericValue = Number(sanitized.replace(/\./g, "").replace(",", "."));
      if (Number.isFinite(numericValue)) {
        onChange(numericValue);
      }
    };

    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(event);
    };

    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      setDisplayValue(formatCurrencyValue(value, allowEmpty));
      onBlur?.(event);
    };

    return (
      <div className="relative">
        <span
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-muted-foreground"
          aria-hidden="true"
        >
          R$
        </span>
        <Input
          {...props}
          ref={ref}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={cn("pl-10 text-right tabular-nums", className)}
        />
      </div>
    );
  }
);

InputCurrency.displayName = "InputCurrency";

export { InputCurrency };
