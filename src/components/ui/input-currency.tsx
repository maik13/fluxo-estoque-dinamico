import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface InputCurrencyProps extends Omit<React.ComponentProps<"input">, "type" | "onChange" | "value"> {
  value: number | string | null | undefined;
  onChange: (value: number) => void;
  allowEmpty?: boolean;
  onClear?: () => void;
}

const formatDecimalValue = (
  value: number | string | null | undefined,
  allowEmpty = false
): string => {
  if (value === "" || value === null || value === undefined) {
    return allowEmpty ? "" : "0";
  }

  const numericValue = typeof value === "number"
    ? value
    : Number(String(value).trim().replace(",", "."));

  if (!Number.isFinite(numericValue)) return allowEmpty ? "" : "0";

  return numericValue.toLocaleString("pt-BR", {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: 20,
  });
};

const sanitizeDecimalInput = (rawValue: string): string => {
  const cleaned = rawValue.replace(/[^\d.,]/g, "");
  if (!cleaned) return "";

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (!hasComma && !hasDot) {
    return cleaned;
  }

  let decimalIndex: number;

  if (hasComma && hasDot) {
    // Em valores colados como 1.234,5678 ou 1,234.5678,
    // o último separador é tratado como separador decimal.
    decimalIndex = Math.max(cleaned.lastIndexOf(","), cleaned.lastIndexOf("."));
  } else {
    // Durante a digitação direta, o primeiro separador inicia as casas decimais.
    const separator = hasComma ? "," : ".";
    decimalIndex = cleaned.indexOf(separator);
  }

  const integerPart = cleaned.slice(0, decimalIndex).replace(/\D/g, "") || "0";
  const decimalPart = cleaned.slice(decimalIndex + 1).replace(/\D/g, "");

  return `${integerPart},${decimalPart}`;
};

const InputCurrency = React.forwardRef<HTMLInputElement, InputCurrencyProps>(
  ({ className, value, onChange, allowEmpty = false, onClear, onFocus, onBlur, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(() => formatDecimalValue(value, allowEmpty));
    const [isFocused, setIsFocused] = React.useState(false);

    React.useEffect(() => {
      // Enquanto o operador digita, preserva exatamente as casas decimais informadas.
      // Isso evita que 0,0025 seja reformatado a cada tecla pelo valor numérico do pai.
      if (!isFocused) {
        setDisplayValue(formatDecimalValue(value, allowEmpty));
      }
    }, [value, isFocused, allowEmpty]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const sanitized = sanitizeDecimalInput(event.target.value);
      setDisplayValue(sanitized);

      if (!sanitized) {
        if (allowEmpty) {
          onClear?.();
        } else {
          onChange(0);
        }
        return;
      }

      const numericValue = Number(sanitized.replace(",", "."));
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

      if (!displayValue) {
        setDisplayValue(allowEmpty ? "" : "0");
      } else if (displayValue.endsWith(",")) {
        setDisplayValue(displayValue.replace(/,$/, ""));
      }

      onBlur?.(event);
    };

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn("text-right", className)}
      />
    );
  }
);

InputCurrency.displayName = "InputCurrency";

export { InputCurrency };
