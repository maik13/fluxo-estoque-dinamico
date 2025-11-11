import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, X, Edit } from 'lucide-react';
import { EstoqueItem } from '@/types/estoque';
import { usePermissions } from '@/hooks/usePermissions';

interface EditarQuantidadeInlineProps {
  item: EstoqueItem;
  onSalvar: (itemId: string, novaQuantidade: number) => Promise<boolean>;
  disabled?: boolean;
}

export const EditarQuantidadeInline = ({ item, onSalvar, disabled }: EditarQuantidadeInlineProps) => {
  const [editando, setEditando] = useState(false);
  const [quantidade, setQuantidade] = useState(item.estoqueAtual.toString());
  const { isAdmin, isGestor } = usePermissions();

  // Apenas gestores e administradores podem editar
  const podeEditar = isAdmin() || isGestor();

  if (!podeEditar || disabled) {
    return (
      <span className="text-right font-bold">
        {item.estoqueAtual.toLocaleString('pt-BR')}
      </span>
    );
  }

  const handleSalvar = async () => {
    const novaQuantidade = parseFloat(quantidade);
    if (isNaN(novaQuantidade) || novaQuantidade < 0) {
      return;
    }

    const sucesso = await onSalvar(item.id, novaQuantidade);
    if (sucesso) {
      setEditando(false);
    }
  };

  const handleCancelar = () => {
    setQuantidade(item.estoqueAtual.toString());
    setEditando(false);
  };

  if (editando) {
    return (
      <div className="flex items-center gap-1 w-32">
        <Input
          type="number"
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          className="h-8 text-right"
          min="0"
          step="1"
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleSalvar();
            } else if (e.key === 'Escape') {
              handleCancelar();
            }
          }}
          autoFocus
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSalvar}
          className="h-8 w-8 p-0"
        >
          <Check className="h-4 w-4 text-green-600" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCancelar}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4 text-red-600" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between group">
      <span className="text-right font-bold">
        {item.estoqueAtual.toLocaleString('pt-BR')}
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setEditando(true)}
        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Editar quantidade"
      >
        <Edit className="h-3 w-3" />
      </Button>
    </div>
  );
};