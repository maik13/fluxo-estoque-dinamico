import { AlertTriangle, CheckCircle2, Clock3, Loader2, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ProducaoOrdemProducao } from '@/types/producao';
import type {
  ContextoFechamentoJornadaOp,
  JornadaOpAberta,
} from '@/services/producao/jornadasOrdemProducao';

interface Props {
  ordem: ProducaoOrdemProducao;
  jornada: JornadaOpAberta | null;
  executando: boolean;
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

export const ControlesJornadaOp = ({
  ordem,
  jornada,
  executando,
  onIniciar,
  onFechar,
  onFinalizarLegado,
}: Props) => {
  if (ordem.status === 'liberada') {
    return (
      <Button size="sm" onClick={() => onIniciar(ordem)} disabled={executando}>
        {executando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
        Iniciar OP
      </Button>
    );
  }

  if (ordem.status !== 'em_execucao') return null;

  if (!jornada) {
    return (
      <>
        <Button size="sm" onClick={() => onIniciar(ordem)} disabled={executando}>
          {executando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          Iniciar trabalho
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onFinalizarLegado(ordem)}
          disabled={executando}
          title="Usado quando a OP já possui apontamentos encerrados e não há trabalho aberto neste momento"
        >
          <CheckCircle2 className="mr-2 h-4 w-4" /> Finalizar OP
        </Button>
      </>
    );
  }

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
          {jornada.pendente_dia_anterior ? 'Fechamento pendente' : 'Apontamento aberto'}
        </div>
        <div className="mt-0.5">Iniciado em {formatarInicio(jornada.iniciado_em)}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onFechar({
            jornadaId: jornada.id,
            ordemProducaoId: ordem.id,
            iniciadoEm: jornada.iniciado_em,
            concluirOp: false,
          })}
        >
          <Square className="mr-2 h-4 w-4" /> Encerrar trabalho
        </Button>
        <Button
          size="sm"
          onClick={() => onFechar({
            jornadaId: jornada.id,
            ordemProducaoId: ordem.id,
            iniciadoEm: jornada.iniciado_em,
            concluirOp: true,
          })}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" /> Concluir OP
        </Button>
      </div>
    </div>
  );
};
