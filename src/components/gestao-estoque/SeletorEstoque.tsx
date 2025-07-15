import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Database } from 'lucide-react';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';

export const SeletorEstoque = () => {
  const { estoques, estoqueAtivo, alterarEstoqueAtivo, obterEstoqueAtivoInfo } = useConfiguracoes();
  
  const estoqueAtivoInfo = obterEstoqueAtivoInfo();

  return (
    <div className="flex items-center gap-2">
      <Database className="h-4 w-4" />
      <Select value={estoqueAtivo} onValueChange={alterarEstoqueAtivo}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Selecione o estoque" />
        </SelectTrigger>
        <SelectContent>
          {estoques.map((estoque) => (
            <SelectItem key={estoque.id} value={estoque.id}>
              {estoque.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {estoqueAtivoInfo && (
        <span className="text-sm text-muted-foreground">
          ({estoqueAtivoInfo.nome})
        </span>
      )}
    </div>
  );
};