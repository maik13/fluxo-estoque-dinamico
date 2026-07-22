import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { ProducaoProcesso } from '@/types/producao';

interface ModalFinalizarProcessoProps {
  processo: ProducaoProcesso | null;
  onClose: () => void;
  onConfirm: (justificativa: string) => Promise<void>;
}

export const ModalFinalizarProcesso = ({ processo, onClose, onConfirm }: ModalFinalizarProcessoProps) => {
  const [justificativa, setJustificativa] = useState('');
  const [loading, setLoading] = useState(false);

  if (!processo) return null;

  const handleConfirm = async () => {
    if (!justificativa.trim()) {
      alert('Justificativa é obrigatória para finalização.');
      return;
    }
    setLoading(true);
    try {
      await onConfirm(justificativa);
      setJustificativa('');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao finalizar processo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!processo} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finalizar Processo: {processo.nome}</DialogTitle>
          <DialogDescription>
            Por favor, confira o resumo e adicione uma justificativa para encerrar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted p-4 rounded-md text-sm space-y-2">
            <h4 className="font-semibold mb-2">Resumo (Planejado vs Realizado)</h4>
            <div className="flex justify-between border-b pb-1">
              <span>Status Atual:</span>
              <span className="font-medium capitalize">{processo.status.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span>Iniciado em:</span>
              <span className="font-medium">{processo.data_inicio_real || 'N/A'}</span>
            </div>
            {/* Espaço para mais métricas calculadas que virão do banco futuramente */}
            <div className="text-xs text-muted-foreground pt-2">
              Após a finalização, nenhum apontamento novo poderá ser incluído neste processo.
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Justificativa / Parecer Final <span className="text-red-500">*</span></label>
            <Textarea
              placeholder="Descreva o resultado, eventuais problemas ou observações do processo..."
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              disabled={loading}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={loading || !justificativa.trim()} className="bg-green-600 hover:bg-green-700 text-white">
            {loading ? 'Finalizando...' : 'Confirmar Finalização'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
