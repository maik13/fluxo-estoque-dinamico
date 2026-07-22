import { useState, useEffect } from 'react';
import { Search, Filter, Activity, Play, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProcessosProducao } from '@/hooks/useProcessosProducao';
import { FormProcessoProducao } from './FormProcessoProducao';
import { ModalFinalizarProcesso } from './ModalFinalizarProcesso';
import { format } from 'date-fns';
import type { ProducaoProcesso } from '@/types/producao';
import { ptBR } from 'date-fns/locale';

export const ProcessosProducao = () => {
  const [busca, setBusca] = useState('');
  const [processoParaFinalizar, setProcessoParaFinalizar] = useState<ProducaoProcesso | null>(null);
  const { processos, loading, listarProcessos, transicaoProcesso } = useProcessosProducao();

  useEffect(() => {
    void listarProcessos();
  }, [listarProcessos]);

  const processosEmAberto = processos.filter(p => ['planejado', 'em_andamento', 'pausado', 'bloqueado'].includes(p.status));

  const processosFiltrados = processosEmAberto.filter((p) =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (p.projeto?.nome || '').toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-lg font-medium">Processos em Aberto</h3>
        <FormProcessoProducao onSuccess={() => listarProcessos()} />
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar processos..."
            className="pl-8"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Button variant="outline" className="w-full sm:w-auto">
          <Filter className="mr-2 h-4 w-4" />
          Filtros
        </Button>
      </div>

      {loading ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          <p>Carregando processos...</p>
        </div>
      ) : processosFiltrados.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          <Activity className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
          <p>Nenhum processo encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {processosFiltrados.map((processo) => (
            <div key={processo.id} className="rounded-lg border bg-card text-card-foreground shadow-sm p-5 space-y-4 flex flex-col sm:flex-row justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-lg">{processo.nome}</h4>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    processo.status === 'planejado' ? 'bg-secondary text-secondary-foreground' : 
                    processo.status === 'em_andamento' ? 'bg-primary/10 text-primary' : 
                    processo.status === 'finalizado' ? 'bg-green-100 text-green-700' : 
                    'bg-destructive/10 text-destructive'
                  }`}>
                    {processo.status === 'planejado' ? 'Planejado' : 
                     processo.status === 'em_andamento' ? 'Em andamento' : 
                     processo.status === 'finalizado' ? 'Finalizado' : processo.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Projeto: <span className="font-medium text-foreground">{processo.projeto?.nome}</span></p>
                {processo.descricao && (
                  <p className="text-sm text-muted-foreground">{processo.descricao}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Criado em {format(new Date(processo.created_at), "dd/MM/yyyy HH:mm")}
                  </span>
                  {processo.data_inicio_real && (
                    <span className="flex items-center gap-1">
                      <Play className="h-3 w-3" />
                      Iniciado em {format(new Date(processo.data_inicio_real + 'T00:00:00'), "dd/MM/yyyy")}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-4 sm:mt-0">
                {processo.status === 'planejado' && (
                  <Button variant="default" size="sm" onClick={() => transicaoProcesso(processo.id, 'iniciar')}>
                    <Play className="mr-2 h-4 w-4" />
                    Iniciar
                  </Button>
                )}
                {processo.status === 'em_andamento' && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => {
                      const just = window.prompt("Justificativa para pausar:");
                      if (just) transicaoProcesso(processo.id, 'pausar', just);
                    }}>
                      Pausar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => {
                      const just = window.prompt("Justificativa para bloquear:");
                      if (just) transicaoProcesso(processo.id, 'bloquear', just);
                    }}>
                      Bloquear
                    </Button>
                    <Button variant="default" className="bg-green-600 hover:bg-green-700 text-white" size="sm" onClick={() => {
                      setProcessoParaFinalizar(processo);
                    }}>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Finalizar
                    </Button>
                  </>
                )}
                {(processo.status === 'pausado' || processo.status === 'bloqueado') && (
                  <Button variant="default" size="sm" onClick={() => transicaoProcesso(processo.id, 'retomar')}>
                    <Play className="mr-2 h-4 w-4" />
                    Retomar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ModalFinalizarProcesso 
        processo={processoParaFinalizar} 
        onClose={() => setProcessoParaFinalizar(null)} 
        onConfirm={async (justificativa) => {
          if (processoParaFinalizar) {
            await transicaoProcesso(processoParaFinalizar.id, 'finalizar', justificativa);
            setProcessoParaFinalizar(null);
          }
        }} 
      />
    </div>
  );
};
