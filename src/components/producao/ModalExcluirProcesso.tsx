import { FormEvent, useEffect, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  const [codigo, setCodigo] = useState('');
  const [justificativa, setJustificativa] = useState('');

  useEffect(() => {
    setCodigo('');
    setJustificativa('');
  }, [processo?.id]);

  if (!processo) return null;

  const podeConfirmar = Boolean(
    resumo?.pode_excluir
    && codigo.trim() === processo.codigo
    && justificativa.trim().length >= 5,
  );

  const enviar = async (event: FormEvent) => {
    event.preventDefault();
    if (!podeConfirmar) return;
    await onConfirm(codigo.trim(), justificativa.trim());
  };

  return (
    <Dialog open={Boolean(processo)} onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Excluir etapa permanentemente
          </DialogTitle>
          <DialogDescription>
            Esta ação é exclusiva de administrador e não poderá ser desfeita.
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
              Verificando vínculos da etapa...
            </div>
          ) : resumo ? (
            <>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
                <div className="rounded-md border p-3"><p className="text-muted-foreground">Apontamentos</p><p className="text-lg font-semibold">{resumo.total_apontamentos}</p></div>
                <div className="rounded-md border p-3"><p className="text-muted-foreground">Eventos</p><p className="text-lg font-semibold">{resumo.total_eventos}</p></div>
                <div className="rounded-md border p-3"><p className="text-muted-foreground">Dependências</p><p className="text-lg font-semibold">{resumo.total_dependencias}</p></div>
                <div className="rounded-md border p-3"><p className="text-muted-foreground">Alocações</p><p className="text-lg font-semibold">{resumo.total_alocacoes}</p></div>
                <div className="rounded-md border p-3"><p className="text-muted-foreground">Alertas</p><p className="text-lg font-semibold">{resumo.total_alertas}</p></div>
              </div>

              {!resumo.pode_excluir ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Exclusão bloqueada</AlertTitle>
                  <AlertDescription>
                    {resumo.motivo_bloqueio ?? 'A etapa possui vínculos que precisam ser preservados.'}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>O que será removido</AlertTitle>
                  <AlertDescription>
                    A etapa, suas dependências, alocações, alertas e eventos técnicos serão removidos. Um snapshot da exclusão ficará salvo na auditoria administrativa.
                  </AlertDescription>
                </Alert>
              )}
            </>
          ) : null}

          <form id="form-excluir-processo" onSubmit={enviar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="justificativa-exclusao">Justificativa da exclusão *</Label>
              <Textarea
                id="justificativa-exclusao"
                value={justificativa}
                onChange={(event) => setJustificativa(event.target.value)}
                placeholder="Ex.: Etapa criada apenas para teste e sem apontamentos."
                disabled={!resumo?.pode_excluir || excluindo}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="codigo-confirmacao">
                Digite <span className="font-mono font-bold">{processo.codigo}</span> para confirmar
              </Label>
              <Input
                id="codigo-confirmacao"
                value={codigo}
                onChange={(event) => setCodigo(event.target.value)}
                autoComplete="off"
                disabled={!resumo?.pode_excluir || excluindo}
              />
            </div>
          </form>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={excluindo}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-excluir-processo"
            variant="destructive"
            disabled={!podeConfirmar || excluindo}
          >
            {excluindo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Excluir permanentemente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
