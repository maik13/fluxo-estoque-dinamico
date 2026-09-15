import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Loader2, Play, Square, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
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
      <div className="flex w-full flex-col gap-2 sm:w-auto">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onIniciar(ordem)} disabled={executando}>
            {executando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Iniciar apontamento
          </Button>
        </div>
        <ApontamentosEncerradosOp ordem={ordem} />
      </div>
    );
  }

  if (ordem.status !== 'em_execucao') return null;

  if (!jornada) {
    return (
      <div className="flex w-full flex-col gap-2 sm:w-auto">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onIniciar(ordem)} disabled={executando}>
            {executando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Iniciar novo apontamento
          </Button>
          {podeConcluir && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onFinalizarLegado(ordem)}
              disabled={executando}
              title="Concluir definitivamente a OP usando os apontamentos já encerrados"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" /> Concluir OP
            </Button>
          )}
        </div>
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
      'Este apontamento aberto será descartado sem gerar produção nem novo histórico. Informe o motivo:',
    )?.trim();
    if (!motivo) return;

    setDescartando(true);
    try {
      await descartarJornadaOp(jornada.id, motivo);
      toast.success('Apontamento aberto descartado. A OP foi liberada para concluir ou iniciar novo apontamento.');
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível descartar o apontamento aberto.');
    } finally {
      setDescartando(false);
    }
  };

  const quantidadeRascunho = jornada.quantidade_produzida_rascunho;
  const producaoCompleta =
    Number(ordem.quantidade_planejada ?? 0) > 0 &&
    Number(ordem.quantidade_realizada ?? 0) >= Number(ordem.quantidade_planejada ?? 0);

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto">
      <div className={`rounded-md border px-3 py-2 text-xs ${
        jornada.pendente_dia_anterior
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
          : 'border-primary/20 bg-primary/5 text-muted-foreground'
      }`}>
        <div className="flex items-center gap-1.5 font-medium">
          {jornada.pendente_dia_anterior
            ? <AlertTriangle className="h-3.5 w-3.5" />
            : <Clock3 className="h-3.5 w-3.5" />}
          {jornada.pendente_dia_anterior
            ? 'Apontamento pendente de fechamento'
            : 'Apontamento em andamento'}
        </div>
        <div className="mt-0.5">Início do apontamento: {formatarInicio(jornada.iniciado_em)}</div>
        {quantidadeRascunho != null && (
          <div className="mt-1 font-medium">
            Rascunho: {formatarQuantidade(Number(quantidadeRascunho))}{' '}
            {ordem.unidade_medida ?? ''}
            <span className="font-normal"> · ainda não contabilizado</span>
          </div>
        )}
        {producaoCompleta && (
          <div className="mt-2 border-t border-current/20 pt-2 font-medium">
            A produção já atingiu 100% da OP. Se este apontamento aberto for residual ou duplicado, descarte-o em vez de lançar produção novamente.
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={abrirFechamento} disabled={descartando}>
          <Square className="mr-2 h-4 w-4" /> Encerrar apontamento
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={() => void descartarAberto()}
          disabled={executando || descartando}
        >
          {descartando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
          Descartar apontamento aberto
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Encerre o apontamento se o trabalho realmente ocorreu neste período. Se ele for duplicado ou aberto por engano, descarte-o. Depois disso, “Concluir OP” ficará disponível no mesmo card.
      </p>
      <ApontamentosEncerradosOp ordem={ordem} />
    </div>
  );
};
