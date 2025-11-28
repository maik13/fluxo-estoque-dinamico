import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface InputCurrencyProps extends Omit<React.ComponentProps<"input">, "type" | "onChange"> {
  value: number | string;
  onChange: (value: number) => void;
}

const InputCurrency = React.forwardRef<HTMLInputElement, InputCurrencyProps>(
  ({ className, value, onChange, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState("");

    React.useEffect(() => {
      const numValue = typeof value === "string" ? parseFloat(value) || 0 : value || 0;
      setDisplayValue(formatCurrency(numValue));
    }, [value]);

    const formatCurrency = (value: number): string => {
      return value.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let inputValue = e.target.value;
      
      // Remove tudo exceto dígitos
      inputValue = inputValue.replace(/\D/g, "");
      
      // Se vazio, retorna 0
      if (!inputValue || inputValue === "") {
        setDisplayValue(formatCurrency(0));
        onChange(0);
        return;
      }
      
      // Converte para número (centavos) - digita da direita para esquerda
      const numberValue = parseFloat(inputValue) / 100;
      
      // Atualiza o valor formatado
      setDisplayValue(formatCurrency(numberValue));
      
      // Chama o onChange com o valor numérico
      onChange(numberValue);
    };

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        value={displayValue}
        onChange={handleChange}
        className={cn("text-right", className)}
      />
    );
  }
);

InputCurrency.displayName = "InputCurrency";

export { InputCurrency };
