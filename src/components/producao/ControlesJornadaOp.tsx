import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  Play,
  Square,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { ordemProducaoEDePintura } from '@/hooks/useOrdensProducao';
import { Button } from '@/components/ui/button';
import type { ProducaoOrdemProducao } from '@/types/producao';
import { descartarJornadaOp } from '@/services/producao/descartarJornadaOp';
import {
  contextoFechamentoJornada,
  type ContextoFechamentoJornadaOp,
  type JornadaOpAberta,
} from '@/services/producao/jornadasOrdemProducao';
import { ApontamentosEncerradosOp } from './ApontamentosEncerradosOp';

interface Props {
  ordem: ProducaoOrdemProducao;
  jornada: JornadaOpAberta | null;
  executando: boolean;
  podeConcluir?: boolean;
  onIniciar: (ordem: ProducaoOrdemProducao) => void;
  onFechar: (contexto: ContextoFechamentoJornadaOp) => void;
  onFinalizarLegado: (ordem: ProducaoOrdemProducao) => void;
}

const formatarInicio = (valor: string) =>
  new Date(valor).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const formatarQuantidade = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(valor);

const PainelExecucao = ({ children }: { children: React.ReactNode }) => (
  <div className="min-w-0 rounded-lg border border-border/70 bg-muted/15 p-3">
    {children}
  </div>
);

export const ControlesJornadaOp = ({
  ordem,
  jornada,
  executando,
  podeConcluir = true,
  onIniciar,
  onFechar,
  onFinalizarLegado,
}: Props) => {
  const [descartando, setDescartando] = useState(false);

  if (ordem.status === 'liberada') {
    return (
      <div className="w-full min-w-0 space-y-2 sm:w-[280px] sm:max-w-[280px] sm:shrink-0">
        <PainelExecucao>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Execução da OP
          </p>
          <p className="mt-1 text-sm font-medium">Aguardando início</p>
          <Button
            size="sm"
            className="mt-3 w-full justify-center"
            onClick={() => onIniciar(ordem)}
            disabled={executando}
          >
            {executando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Iniciar apontamento
          </Button>
        </PainelExecucao>
        <ApontamentosEncerradosOp ordem={ordem} />
      </div>
    );
  }

  if (ordem.status !== 'em_execucao') return null;

  if (!jornada) {
    return (
      <div className="w-full min-w-0 space-y-2 sm:w-[280px] sm:max-w-[280px] sm:shrink-0">
        <PainelExecucao>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Execução da OP
              </p>
              <p className="mt-0.5 text-sm font-medium">Sem apontamento em andamento</p>
            </div>
          </div>

          <div className="mt-3 grid gap-2">
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-center"
              onClick={() => onIniciar(ordem)}
              disabled={executando}
            >
              {executando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Iniciar novo apontamento
            </Button>

            {podeConcluir && (
              <Button
                size="sm"
                className="w-full justify-center"
                onClick={() => onFinalizarLegado(ordem)}
                disabled={executando}
                title="Concluir definitivamente a OP usando os apontamentos já encerrados"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Concluir OP
              </Button>
            )}
          </div>
        </PainelExecucao>
        <ApontamentosEncerradosOp ordem={ordem} />
      </div>
    );
  }

  const abrirFechamento = () => {
    const contexto = contextoFechamentoJornada(
      jornada,
      false,
      ordem.responsavel_id,
      ordem.responsavel_nome_snapshot,
    );

    onFechar({
      ...contexto,
      tarefaId: contexto.tarefaId ?? ordem.tarefa_id ?? null,
      concluirOp: false,
    });
  };

  const descartarAberto = async () => {
    const motivo = window.prompt(
      'Este registro aberto será descartado sem apagar os apontamentos já encerrados nem gerar nova produção. Informe o motivo:',
    )?.trim();
    if (!motivo) return;

    setDescartando(true);
    try {
      await descartarJornadaOp(jornada.id, motivo);
      toast.success(
        'Registro aberto descartado. Os apontamentos encerrados foram preservados e a OP foi liberada.',
      );
      window.location.reload();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível descartar o registro aberto.',
      );
    } finally {
      setDescartando(false);
    }
  };

  const quantidadeRascunho = jornada.quantidade_produzida_rascunho;
  const opDePintura = ordemProducaoEDePintura(ordem);
  const producaoCompleta =
    Number(ordem.quantidade_planejada ?? 0) > 0 &&
    Number(ordem.quantidade_realizada ?? 0) >= Number(ordem.quantidade_planejada ?? 0);

  return (
    <div className="w-full min-w-0 space-y-2 sm:w-[280px] sm:max-w-[280px] sm:shrink-0">
      <PainelExecucao>
        <div className="flex items-start gap-2">
          {jornada.pendente_dia_anterior ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          ) : (
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Execução atual
            </p>
            <p className="mt-0.5 text-sm font-medium">
              {jornada.pendente_dia_anterior
                ? 'Registro pendente de fechamento'
                : 'Apontamento em andamento'}
            </p>
          </div>
        </div>

        <div className="mt-3 space-y-1 border-t border-border/60 pt-2 text-xs">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Início</span>
            <span className="text-right font-medium">{formatarInicio(jornada.iniciado_em)}</span>
          </div>
          {quantidadeRascunho != null && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Rascunho</span>
              <span className="text-right font-medium">
                {formatarQuantidade(Number(quantidadeRascunho))} {ordem.unidade_medida ?? ''}
              </span>
            </div>
          )}
        </div>

        {producaoCompleta && (
          <div className="mt-3 rounded-md border border-amber-500/35 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-700 dark:text-amber-300">
            {opDePintura ? (
              <>
                <strong>Quantidade de peças coberta.</strong> Em pintura, novos apontamentos continuam permitidos
                e serão registrados como novas demãos até a OP ser concluída.
              </>
            ) : (
              <>
                <strong>OP já está em 100%.</strong> Se este registro ficou aberto por engano ou é duplicado,
                descarte-o. Não lance produção novamente.
              </>
            )}
          </div>
        )}

        <div className="mt-3 grid gap-2">
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-center"
            onClick={abrirFechamento}
            disabled={descartando}
          >
            <Square className="mr-2 h-4 w-4" />
            Encerrar apontamento
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-center border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => void descartarAberto()}
            disabled={executando || descartando}
          >
            {descartando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Descartar registro aberto
          </Button>
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Encerrar cria um apontamento deste período. Descartar remove somente a abertura residual e preserva os apontamentos já salvos.
        </p>
      </PainelExecucao>

      <ApontamentosEncerradosOp ordem={ordem} />
    </div>
  );
};
