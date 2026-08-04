import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ProducaoProcesso } from '@/types/producao';
import type { ResumoExclusaoProcessoProducao } from '@/hooks/useProcessosProducao';

interface ModalExcluirProcessoProps {
  processo: ProducaoProcesso | null;
  resumo: ResumoExclusaoProcessoProducao | null;
  carregandoResumo: boolean;
  excluindo: boolean;
  onClose: () => void;
  onConfirm: (codigo: string, justificativa: string) => Promise<void>;
}

export const ModalExcluirProcesso = ({
  processo,
  resumo,
  carregandoResumo,
  excluindo,
  onClose,
  onConfirm,
}: ModalExcluirProcessoProps) => {
  if (!processo) return null;

  const confirmar = async () => {
    await onConfirm(
      processo.codigo,
      'Exclusão administrativa confirmada pelo administrador do sistema.',
    );
  };

  return (
    <Dialog open={Boolean(processo)} onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Excluir etapa
          </DialogTitle>
          <DialogDescription>
            Tem certeza de que deseja excluir esta Etapa? A ação não poderá ser desfeita.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="font-semibold">{processo.codigo} · {processo.nome}</p>
            <p className="text-sm text-muted-foreground">
              Projeto: {processo.projeto?.nome ?? '—'} · Status: {processo.status.replace('_', ' ')}
            </p>
          </div>

          {carregandoResumo ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verificando os registros vinculados...
            </div>
          ) : resumo ? (
            <>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground">Apontamentos</p>
                  <p className="text-lg font-semibold">{resumo.total_apontamentos}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground">Conferidos</p>
                  <p className="text-lg font-semibold">{resumo.total_apontamentos_conferidos}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground">Eventos</p>
                  <p className="text-lg font-semibold">{resumo.total_eventos}</p>
                </div>
              </div>

              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Exclusão definitiva</AlertTitle>
                <AlertDescription>
                  A Etapa, suas Ordens de Produção, apontamentos — inclusive conferidos —,
                  vínculos de equipe, planejamento e eventos internos serão removidos.
                </AlertDescription>
              </Alert>
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={excluindo}>
            Não, manter
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void confirmar()}
            disabled={carregandoResumo || excluindo || !resumo}
          >
            {excluindo ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Sim, excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
