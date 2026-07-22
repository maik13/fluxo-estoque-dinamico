import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { ProducaoProcesso } from '@/types/producao';

interface ResumoFinalizacao {
  quantidade_planejada: number | null;
  quantidade_realizada: number;
  percentual_conclusao: number | null;
  total_apontamentos: number;
  apontamentos_pendentes: number;
  minutos_totais: number;
  minutos_produtivos: number;
  minutos_improdutivos: number;
  horas_homem: number;
}

interface Props {
  processo: ProducaoProcesso | null;
  onClose: () => void;
  onConfirm: (justificativa: string) => Promise<void>;
  obterResumo: (id: string) => Promise<ResumoFinalizacao | null>;
}

const horas = (minutos: number) => `${(Number(minutos || 0) / 60).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} h`;

export const ModalFinalizarProcesso = ({ processo, onClose, onConfirm, obterResumo }: Props) => {
  const [justificativa, setJustificativa] = useState('');
  const [loading, setLoading] = useState(false);
  const [resumo, setResumo] = useState<ResumoFinalizacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!processo) return;
    setResumo(null);
    setErro(null);
    void obterResumo(processo.id)
      .then(setResumo)
      .catch((error: unknown) => setErro(error instanceof Error ? error.message : 'Erro ao calcular resumo'));
  }, [processo, obterResumo]);

  if (!processo) return null;

  const handleConfirm = async () => {
    if (!justificativa.trim()) return;
    setLoading(true);
    try {
      await onConfirm(justificativa.trim());
      setJustificativa('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>Finalizar Processo: {processo.nome}</DialogTitle>
          <DialogDescription>O resumo é recalculado no banco antes da finalização.</DialogDescription>
        </DialogHeader>

        {erro && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
        {!resumo && !erro ? <p className="py-6 text-center text-sm text-muted-foreground">Calculando resumo...</p> : null}
        {resumo && (
          <div className="grid grid-cols-2 gap-3 py-3 sm:grid-cols-3">
            <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Planejado</p><p className="font-semibold">{resumo.quantidade_planejada ?? 'Não definido'}</p></div>
            <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Realizado</p><p className="font-semibold">{resumo.quantidade_realizada}</p></div>
            <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Conclusão</p><p className="font-semibold">{resumo.percentual_conclusao === null ? 'N/A' : `${resumo.percentual_conclusao}%`}</p></div>
            <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Apontamentos</p><p className="font-semibold">{resumo.total_apontamentos}</p></div>
            <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Pendentes</p><p className="font-semibold">{resumo.apontamentos_pendentes}</p></div>
            <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Horas-homem</p><p className="font-semibold">{Number(resumo.horas_homem || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</p></div>
            <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Tempo total</p><p className="font-semibold">{horas(resumo.minutos_totais)}</p></div>
            <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Produtivo</p><p className="font-semibold">{horas(resumo.minutos_produtivos)}</p></div>
            <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Improdutivo</p><p className="font-semibold">{horas(resumo.minutos_improdutivos)}</p></div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Parecer final *</label>
          <Textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} rows={4} disabled={loading} placeholder="Descreva o resultado e eventuais divergências..." />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={loading || !justificativa.trim() || !resumo || resumo.apontamentos_pendentes > 0}>
            {resumo?.apontamentos_pendentes ? 'Resolva os apontamentos pendentes' : loading ? 'Finalizando...' : 'Confirmar Finalização'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
