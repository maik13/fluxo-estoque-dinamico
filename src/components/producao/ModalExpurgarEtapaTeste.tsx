import { FormEvent, useEffect, useState } from 'react';
import { AlertTriangle, Eraser, Loader2 } from 'lucide-react';
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
import type { ResumoExpurgoEtapaTeste } from '@/hooks/useExpurgoEtapaTeste';
import type { ProducaoProcesso } from '@/types/producao';

interface ModalExpurgarEtapaTesteProps {
  processo: ProducaoProcesso | null;
  resumo: ResumoExpurgoEtapaTeste | null;
  carregandoResumo: boolean;
  expurgando: boolean;
  onClose: () => void;
  onConfirm: (
    codigo: string,
    confirmacaoExpurgo: string,
    justificativa: string,
  ) => Promise<void>;
}

export const ModalExpurgarEtapaTeste = ({
  processo,
  resumo,
  carregandoResumo,
  expurgando,
  onClose,
  onConfirm,
}: ModalExpurgarEtapaTesteProps) => {
  const [codigo, setCodigo] = useState('');
  const [confirmacaoExpurgo, setConfirmacaoExpurgo] = useState('');
  const [justificativa, setJustificativa] = useState('');

  useEffect(() => {
    setCodigo('');
    setConfirmacaoExpurgo('');
    setJustificativa('');
  }, [processo?.id]);

  if (!processo) return null;

  const podeConfirmar = Boolean(
    resumo?.pode_expurgar &&
      codigo.trim() === processo.codigo &&
      confirmacaoExpurgo.trim() === 'EXPURGAR TESTE' &&
      justificativa.trim().length >= 10,
  );

  const enviar = async (event: FormEvent) => {
    event.preventDefault();
    if (!podeConfirmar) return;
    await onConfirm(
      codigo.trim(),
      confirmacaoExpurgo.trim(),
      justificativa.trim(),
    );
  };

  return (
    <Dialog
      open={Boolean(processo)}
      onOpenChange={(aberto) => !aberto && onClose()}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Eraser className="h-5 w-5" />
            Expurgar Etapa de teste
          </DialogTitle>
          <DialogDescription>
            Esta rotina administrativa apaga a Etapa, suas OPs e seus
            apontamentos. Use somente para cadastros criados para teste.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="font-semibold">
              {processo.codigo} · {processo.nome}
            </p>
            <p className="text-sm text-muted-foreground">
              Projeto: {processo.projeto?.nome ?? '—'} · Status:{' '}
              {processo.status.replace('_', ' ')}
            </p>
          </div>

          {carregandoResumo ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verificando vínculos oficiais...
            </div>
          ) : resumo ? (
            <>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground">OPs</p>
                  <p className="text-lg font-semibold">{resumo.total_ops}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground">Apontamentos</p>
                  <p className="text-lg font-semibold">
                    {resumo.total_apontamentos}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground">Conferidos</p>
                  <p className="text-lg font-semibold">
                    {resumo.total_apontamentos_conferidos}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground">Materiais PCP/OP</p>
                  <p className="text-lg font-semibold">
                    {resumo.total_materiais_etapa + resumo.total_materiais_op}
                  </p>
                </div>
              </div>

              {!resumo.pode_expurgar ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Expurgo bloqueado</AlertTitle>
                  <AlertDescription>
                    {resumo.motivo_bloqueio ??
                      'Existem vínculos oficiais que precisam ser preservados.'}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Remoção definitiva</AlertTitle>
                  <AlertDescription>
                    Serão removidos {resumo.total_ops} OP(s),{' '}
                    {resumo.total_apontamentos} apontamento(s), eventos,
                    dependências, planejamento e materiais internos. Um snapshot
                    ficará registrado na auditoria administrativa. Nenhum estoque
                    será movimentado.
                  </AlertDescription>
                </Alert>
              )}
            </>
          ) : null}

          <form
            id="form-expurgar-etapa-teste"
            onSubmit={enviar}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="justificativa-expurgo">
                Justificativa do expurgo *
              </Label>
              <Textarea
                id="justificativa-expurgo"
                value={justificativa}
                onChange={(event) => setJustificativa(event.target.value)}
                placeholder="Ex.: Etapa e OP criadas somente para homologação do módulo."
                disabled={!resumo?.pode_expurgar || expurgando}
              />
              <p className="text-xs text-muted-foreground">
                Mínimo de 10 caracteres. A justificativa ficará na auditoria.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="codigo-expurgo">
                Digite o código{' '}
                <span className="font-mono font-bold">{processo.codigo}</span>
              </Label>
              <Input
                id="codigo-expurgo"
                value={codigo}
                onChange={(event) => setCodigo(event.target.value)}
                autoComplete="off"
                disabled={!resumo?.pode_expurgar || expurgando}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="frase-expurgo">
                Digite <span className="font-mono font-bold">EXPURGAR TESTE</span>
              </Label>
              <Input
                id="frase-expurgo"
                value={confirmacaoExpurgo}
                onChange={(event) => setConfirmacaoExpurgo(event.target.value)}
                autoComplete="off"
                disabled={!resumo?.pode_expurgar || expurgando}
              />
            </div>
          </form>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={expurgando}
          >
            Voltar
          </Button>
          <Button
            type="submit"
            form="form-expurgar-etapa-teste"
            variant="destructive"
            disabled={!podeConfirmar || expurgando}
          >
            {expurgando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Eraser className="mr-2 h-4 w-4" />
            )}
            Expurgar definitivamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
