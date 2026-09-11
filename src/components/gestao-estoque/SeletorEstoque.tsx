import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Database } from 'lucide-react';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { usePermissions } from '@/hooks/usePermissions';
import { CloudStorageIndicator } from '@/components/gestao-estoque/CloudStorageIndicator';
import { OfflineSyncIndicator } from '@/components/gestao-estoque/OfflineSyncIndicator';

export const SeletorEstoque = () => {
  const { estoques, estoqueAtivo, alterarEstoqueAtivo } = useConfiguracoes();
  const { isAdmin, isGestor } = usePermissions();
  const podeVerArmazenamento = isAdmin() || isGestor();

  return (
    <div className="flex items-center gap-2">
      <Database className="h-4 w-4" />
      <Select value={estoqueAtivo} onValueChange={alterarEstoqueAtivo}>
        <SelectTrigger className="w-40 sm:w-64">
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
      <OfflineSyncIndicator />
      {podeVerArmazenamento && <CloudStorageIndicator />}
    </div>
  );
};