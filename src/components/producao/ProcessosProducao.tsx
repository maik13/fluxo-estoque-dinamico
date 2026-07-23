import { useEffect, useMemo, useState } from 'react';
import { Search, Activity, Play, CheckCircle, Clock, Ban, RotateCcw, Unlock, Pause, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProcessosProducao } from '@/hooks/useProcessosProducao';
import { FormProcessoProducao } from './FormProcessoProducao';
import { ModalFinalizarProcesso } from './ModalFinalizarProcesso';
import type { ProducaoProcesso } from '@/types/producao';

const pedirJustificativa = (texto: string) => window.prompt(texto)?.trim() || null;

export const ProcessosProducao = () => {
  const [busca, setBusca] = useState('');
  const [mostrarEncerrados, setMostrarEncerrados] = useState(false);
  const [processoParaFinalizar, setProcessoParaFinalizar] = useState<ProducaoProcesso | null>(null);
  const { processos, loading, listarProcessos, transicaoProcesso, obterResumoFinalizacao } = useProcessosProducao();

  useEffect(() => { void listarProcessos(); }, [listarProcessos]);

  const processosFiltrados = useMemo(() => processos.filter((p) => {
    const aberto = ['planejado', 'em_andamento', 'pausado', 'bloqueado'].includes(p.status);
    if (!mostrarEncerrados && !aberto) return false;
    const termo = busca.toLocaleLowerCase('pt-BR');
    return [p.codigo, p.nome, p.projeto?.nome, p.projeto?.cidade, p.projeto?.uf,
      p.local_operacional?.nome, p.local_operacional?.tipo, p.local_operacional?.cidade]
      .filter(Boolean).some((valor) => String(valor).toLocaleLowerCase('pt-BR').includes(termo));
  }), [busca, mostrarEncerrados, processos]);

  const executarComJustificativa = async (processo: ProducaoProcesso, acao: 'pausar' | 'bloquear' | 'desbloquear' | 'cancelar' | 'reabrir', pergunta: string) => {
    const justificativa = pedirJustificativa(pergunta);
    if (!justificativa) return;
    await transicaoProcesso(processo.id, acao, justificativa);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><h3 className="text-lg font-medium">Etapas de Produção</h3><p className="text-sm text-muted-foreground">Cada etapa pertence a um projeto e ao local onde será executada.</p></div>
        <FormProcessoProducao onSuccess={() => void listarProcessos()} />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por etapa, projeto, local ou cidade..." className="pl-8" /></div><Button variant="outline" onClick={() => setMostrarEncerrados((v) => !v)}>{mostrarEncerrados ? 'Ocultar encerradas' : 'Mostrar encerradas'}</Button></div>

      {loading ? <div className="rounded-md border p-8 text-center text-muted-foreground">Carregando etapas...</div> : processosFiltrados.length === 0 ? <div className="rounded-md border p-8 text-center text-muted-foreground"><Activity className="mx-auto mb-3 h-8 w-8 opacity-50" />Nenhuma etapa encontrada.</div> : (
        <div className="grid gap-4">{processosFiltrados.map((processo) => (
          <div key={processo.id} className="flex flex-col justify-between gap-4 rounded-lg border bg-card p-5 shadow-sm sm:flex-row">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2"><span className="rounded bg-muted px-2 py-1 text-xs font-medium">{processo.codigo}</span><h4 className="text-lg font-semibold">{processo.nome}</h4><span className="rounded-full border px-2.5 py-0.5 text-xs font-semibold">{processo.status.replace('_', ' ')}</span><span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{processo.prioridade}</span></div>
              <p className="text-sm text-muted-foreground">Projeto: <span className="font-medium text-foreground">{processo.projeto?.nome ?? '—'}</span>{processo.projeto?.cidade ? ` · destino ${processo.projeto.cidade}/${processo.projeto.uf ?? ''}` : ''}</p>
              <p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />Local da etapa: <span className="font-medium text-foreground">{processo.local_operacional?.nome ?? 'Não definido'}</span>{processo.local_operacional?.cidade ? ` · ${processo.local_operacional.cidade}/${processo.local_operacional.uf ?? ''}` : ''}</p>
              {processo.descricao && <p className="text-sm text-muted-foreground">{processo.descricao}</p>}
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Clock className="h-3 w-3" />Criada em {new Date(processo.created_at).toLocaleString('pt-BR')}</span>{processo.data_inicio_real && <span>Iniciada em {new Date(`${processo.data_inicio_real}T12:00:00`).toLocaleDateString('pt-BR')}</span>}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {processo.status === 'planejado' && <Button size="sm" onClick={() => void transicaoProcesso(processo.id, 'iniciar')}><Play className="mr-2 h-4 w-4" />Iniciar</Button>}
              {processo.status === 'em_andamento' && <><Button size="sm" variant="outline" onClick={() => void executarComJustificativa(processo, 'pausar', 'Justificativa para pausar a etapa:')}><Pause className="mr-2 h-4 w-4" />Pausar</Button><Button size="sm" variant="outline" onClick={() => void executarComJustificativa(processo, 'bloquear', 'Justificativa para bloquear a etapa:')}><Ban className="mr-2 h-4 w-4" />Bloquear</Button><Button size="sm" onClick={() => setProcessoParaFinalizar(processo)}><CheckCircle className="mr-2 h-4 w-4" />Finalizar</Button></>}
              {processo.status === 'pausado' && <Button size="sm" onClick={() => void transicaoProcesso(processo.id, 'retomar')}><Play className="mr-2 h-4 w-4" />Retomar</Button>}
              {processo.status === 'bloqueado' && <Button size="sm" onClick={() => void executarComJustificativa(processo, 'desbloquear', 'Justificativa para desbloquear a etapa:')}><Unlock className="mr-2 h-4 w-4" />Desbloquear</Button>}
              {['planejado', 'em_andamento', 'pausado', 'bloqueado'].includes(processo.status) && <Button size="sm" variant="destructive" onClick={() => void executarComJustificativa(processo, 'cancelar', 'Justificativa para cancelar a etapa:')}>Cancelar</Button>}
              {['finalizado', 'cancelado'].includes(processo.status) && <Button size="sm" variant="outline" onClick={() => void executarComJustificativa(processo, 'reabrir', 'Justificativa para reabrir a etapa:')}><RotateCcw className="mr-2 h-4 w-4" />Reabrir</Button>}
            </div>
          </div>
        ))}</div>
      )}
      <ModalFinalizarProcesso processo={processoParaFinalizar} obterResumo={obterResumoFinalizacao} onClose={() => setProcessoParaFinalizar(null)} onConfirm={async (justificativa) => { if (!processoParaFinalizar) return; await transicaoProcesso(processoParaFinalizar.id, 'finalizar', justificativa); setProcessoParaFinalizar(null); }} />
    </div>
  );
};
