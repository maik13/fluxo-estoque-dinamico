import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ItemAgrupado } from '@/hooks/useConsolidacao';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface DialogoEncerrarItensProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itens: ItemAgrupado[];
  onSuccess: () => void;
}

export const DialogoEncerrarItens = ({ open, onOpenChange, itens, onSuccess }: DialogoEncerrarItensProps) => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { obterEstoqueAtivoInfo } = useConfiguracoes();
  const { toast } = useToast();

  const handleEncerrar = async () => {
    try {
      setLoading(true);
      const estoqueAtivoInfo = obterEstoqueAtivoInfo();
      const timestamp = new Date().toISOString();

      // Para cada item pendente, vamos registrar a Devolução Fictícia e a Baixa
      for (const item of itens) {
        if (item.pendente <= 0) continue;

        // 1. Achar a quantidade anterior no estoque físico para manter histórico
        const { data: itemData } = await supabase
          .from('items')
          .select('id')
          .eq('id', item.itemId)
          .single();

        if (!itemData) continue;

        const qtdEncerrar = item.pendente;

        // Precisamos calcular o estoque atual para registrar as quantidades anteriores/atuais corretamente.
        // Faremos isso no servidor ou assumiremos o valor da última movimentação?
        // Como o Supabase não faz transação explícita na API REST por padrão, vamos inserir as duas movimentações
        // Para simplificar, a quantidade física (quantidade_atual) após as duas operações será a MESMA de antes.
        // Então quantidade_anterior e quantidade_atual nas movimentações fictícias não afetarão o total se forem simétricas.

        // Devolução (para tirar a pendência do projeto)
        const { error: err1 } = await supabase.from('movements').insert({
          item_id: item.itemId,
          tipo: 'ENTRADA',
          quantidade: qtdEncerrar,
          quantidade_anterior: 0, // Ignorado no cálculo final de estoque
          quantidade_atual: 0,
          user_id: user?.id,
          observacoes: '[ENCERRAMENTO PROJETO] Devolução de fechamento de projeto',
          data_hora: timestamp,
          item_snapshot: item.itemSnapshot,
          estoque_id: estoqueAtivoInfo?.id ?? null,
          local_utilizacao_id: item.localUtilizacaoId !== 'sem-local' && item.localUtilizacaoId !== 'sem-grupo' ? item.localUtilizacaoId : null,
          tipo_operacao_id: null // Poderia ser um tipo 'Devolução'
        });

        if (err1) throw err1;

        // Baixa por consumo/perda (para retirar a ferramenta do estoque físico, já que ela não voltou de verdade)
        const { error: err2 } = await supabase.from('movements').insert({
          item_id: item.itemId,
          tipo: 'SAIDA',
          quantidade: qtdEncerrar,
          quantidade_anterior: 0,
          quantidade_atual: 0,
          user_id: user?.id,
          observacoes: '[BAIXA DE ENCERRAMENTO] Ferramenta não retornou ao almoxarifado',
          data_hora: new Date(new Date(timestamp).getTime() + 1000).toISOString(), // 1 segundo depois para ordenar
          item_snapshot: item.itemSnapshot,
          estoque_id: estoqueAtivoInfo?.id ?? null,
          local_utilizacao_id: null, // Saída direta do estoque, sem alocar a nenhum projeto
          tipo_operacao_id: null
        });

        if (err2) throw err2;
      }

      toast({
        title: 'Encerramento concluído',
        description: `${itens.length} itens foram encerrados e baixados com sucesso.`,
      });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao encerrar itens:', error);
      toast({
        title: 'Erro ao encerrar',
        description: 'Não foi possível concluir o encerramento. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            Encerrar {itens.length} itens pendentes?
          </DialogTitle>
          <DialogDescription className="pt-3 space-y-3">
            <p>
              Você está prestes a <strong>encerrar</strong> ferramentas que saíram e não retornaram fisicamente para o almoxarifado.
            </p>
            <p className="text-muted-foreground text-sm">
              O sistema irá realizar a baixa automática desses itens no estoque para que eles não constem mais como pendentes neste projeto.
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleEncerrar} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              'Confirmar Encerramento'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
