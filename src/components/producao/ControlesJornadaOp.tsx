import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Loader2, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ProducaoOrdemProducao } from '@/types/producao';
import {
  contextoFechamentoJornada,
  type ContextoFechamentoJornadaOp,
  type JornadaOpAberta,
} from '@/services/producao/jornadasOrdemProducao';
import { AjustarInicioJornadaOp } from './AjustarInicioJornadaOp';
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
  const [jornadaAjustada, setJornadaAjustada] = useState<JornadaOpAberta | null>(null);

  useEffect(() => {
    setJornadaAjustada(null);
  }, [jornada?.id, jornada?.iniciado_em]);

  const jornadaAtual =
    jornada && jornadaAjustada?.id === jornada.id ? jornadaAjustada : jornada;

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

  if (!jornadaAtual) {
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
              title="Concluir definitivamente a OP quando não houver apontamento aberto"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" /> Concluir OP
            </Button>
          )}
        </div>
        <ApontamentosEncerradosOp ordem={ordem} />
      </div>
    );
  }

  const abrirFechamento = (concluirOp: boolean) => {
    const contexto = contextoFechamentoJornada(
      jornadaAtual,
      concluirOp,
      ordem.responsavel_id,
      ordem.responsavel_nome_snapshot,
    );

    onFechar({
      ...contexto,
      tarefaId: contexto.tarefaId ?? ordem.tarefa_id ?? null,
    });
  };

  const quantidadeRascunho = jornadaAtual.quantidade_produzida_rascunho;

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto">
      <div className={`rounded-md border px-3 py-2 text-xs ${
        jornadaAtual.pendente_dia_anterior
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
          : 'border-primary/20 bg-primary/5 text-muted-foreground'
      }`}>
        <div className="flex items-center gap-1.5 font-medium">
          {jornadaAtual.pendente_dia_anterior
            ? <AlertTriangle className="h-3.5 w-3.5" />
            : <Clock3 className="h-3.5 w-3.5" />}
          {jornadaAtual.pendente_dia_anterior
            ? 'Apontamento pendente de fechamento'
            : 'Apontamento em andamento'}
        </div>
        <div className="mt-0.5">Início do apontamento: {formatarInicio(jornadaAtual.iniciado_em)}</div>
        {quantidadeRascunho != null && (
          <div className="mt-1 font-medium">
            Rascunho: {formatarQuantidade(Number(quantidadeRascunho))}{' '}
            {ordem.unidade_medida ?? ''}
            <span className="font-normal"> · ainda não contabilizado</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <AjustarInicioJornadaOp
          jornada={jornadaAtual}
          disabled={executando}
          onAjustado={setJornadaAjustada}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => abrirFechamento(false)}
        >
          <Square className="mr-2 h-4 w-4" /> Encerrar apontamento
        </Button>
        {podeConcluir && (
          <Button
            size="sm"
            onClick={() => abrirFechamento(true)}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" /> Concluir OP
          </Button>
        )}
      </div>
      <ApontamentosEncerradosOp ordem={ordem} />
    </div>
  );
};
