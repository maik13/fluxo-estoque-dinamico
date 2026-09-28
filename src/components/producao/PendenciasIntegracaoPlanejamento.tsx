import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Link2, RefreshCw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';

type Pendencia = {
  id: string;
  data: string;
  turno: string | null;
  projeto_chave: string | null;
  frente: string | null;
  descricao: string | null;
  meta: string | null;
  responsavel: string | null;
  prioridade: string | null;
  project_group_id: string | null;
};

type Ordem = {
  id: string;
  numero: number;
  status: string;
  tarefa_nome_snapshot: string | null;
};

type Etapa = {
  etapa_id: string;
  codigo: string;
  etapa_nome: string;
  projeto_id: string;
  projeto_nome: string;
  ordens: Ordem[];
};

type Escolha = {
  processoId: string;
  ordemId: string;
};

const dataBR = (data: string) => new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR');

export const PendenciasIntegracaoPlanejamento = () => {
  const { canConfigurarProducao } = usePermissions();
  const podeConfigurar = canConfigurarProducao();
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({});
  const [loading, setLoading] = useState(true);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [pendenciasResult, ganttResult] = await Promise.all([
        (supabase as any)
          .from('producao_planejamento_agenda')
          .select('id,data,turno,projeto_chave,frente,descricao,meta,responsavel,prioridade,project_group_id')
          .eq('tipo', 'turno')
          .eq('integracao_status', 'pendente')
          .order('data')
          .order('fonte_linha'),
        (supabase.rpc as any)('listar_gantt_producao'),
      ]);
      if (pendenciasResult.error) throw pendenciasResult.error;
      if (ganttResult.error) throw ganttResult.error;
      setPendencias((pendenciasResult.data ?? []) as Pendencia[]);
      setEtapas(((ganttResult.data ?? []) as Etapa[]).map((etapa) => ({
        ...etapa,
        ordens: Array.isArray(etapa.ordens) ? etapa.ordens : [],
      })));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar as pendências de integração.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const etapaPorId = useMemo(
    () => new Map(etapas.map((etapa) => [etapa.etapa_id, etapa])),
    [etapas],
  );

  const selecionarEtapa = (pendenciaId: string, processoId: string) => {
    setEscolhas((atual) => ({
      ...atual,
      [pendenciaId]: { processoId, ordemId: '' },
    }));
  };

  const selecionarOrdem = (pendenciaId: string, ordemId: string) => {
    setEscolhas((atual) => ({
      ...atual,
      [pendenciaId]: {
        processoId: atual[pendenciaId]?.processoId ?? '',
        ordemId: ordemId === 'sem-op' ? '' : ordemId,
      },
    }));
  };

  const vincular = async (pendencia: Pendencia) => {
    const escolha = escolhas[pendencia.id];
    if (!escolha?.processoId) {
      toast.error('Selecione a Etapa antes de vincular.');
      return;
    }
    setSalvandoId(pendencia.id);
    try {
      const { error } = await (supabase.rpc as any)('vincular_programacao_planejamento_v1', {
        p_agenda_id: pendencia.id,
        p_processo_id: escolha.processoId,
        p_ordem_producao_id: escolha.ordemId || null,
      });
      if (error) throw error;
      toast.success('Programação vinculada ao fluxo oficial.');
      setEscolhas((atual) => {
        const proximo = { ...atual };
        delete proximo[pendencia.id];
        return proximo;
      });
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível vincular a programação.');
    } finally {
      setSalvandoId(null);
    }
  };

  const ignorar = async (pendencia: Pendencia) => {
    setSalvandoId(pendencia.id);
    try {
      const { error } = await (supabase.rpc as any)('ignorar_programacao_planejamento_v1', {
        p_agenda_id: pendencia.id,
      });
      if (error) throw error;
      toast.success('Linha marcada como ignorada. Nenhuma OP ou apontamento foi alterado.');
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível ignorar a linha.');
    } finally {
      setSalvandoId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <p className="font-medium">Pendências de integração da programação</p>
          <p className="text-sm text-muted-foreground">
            Revisão das linhas úteis importadas de Setembro/Outubro. Só entram no Plano Diário depois de vinculadas manualmente a uma Etapa e, quando aplicável, a uma OP existente.
          </p>
        </div>
        <Button variant="outline" onClick={() => void carregar()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Atualizar
        </Button>
      </div>

      {!podeConfigurar && (
        <Card className="border-dashed p-4 text-sm text-muted-foreground">
          Você possui acesso de leitura. A vinculação exige permissão de gestão da Produção.
        </Card>
      )}

      <div className="space-y-3">
        {pendencias.map((pendencia) => {
          const escolha = escolhas[pendencia.id];
          const etapa = escolha?.processoId ? etapaPorId.get(escolha.processoId) : undefined;
          return (
            <Card key={pendencia.id} className="p-4">
              <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr_1fr_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{dataBR(pendencia.data)}</span>
                    {pendencia.turno && <Badge variant="outline">{pendencia.turno}</Badge>}
                    {pendencia.prioridade && <Badge variant={pendencia.prioridade === 'Alta' ? 'destructive' : 'secondary'}>{pendencia.prioridade}</Badge>}
                  </div>
                  <p className="mt-2 font-medium">{pendencia.frente || pendencia.descricao || pendencia.meta}</p>
                  {pendencia.descricao && pendencia.frente && <p className="mt-1 text-sm text-muted-foreground">{pendencia.descricao}</p>}
                  {pendencia.meta && <p className="mt-1 text-xs text-muted-foreground">Meta: {pendencia.meta}</p>}
                  {pendencia.responsavel && <p className="mt-1 text-xs text-muted-foreground">Equipe prevista: {pendencia.responsavel}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>Etapa existente</Label>
                  <Select
                    value={escolha?.processoId || ''}
                    onValueChange={(valor) => selecionarEtapa(pendencia.id, valor)}
                    disabled={!podeConfigurar || salvandoId === pendencia.id}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione a Etapa" /></SelectTrigger>
                    <SelectContent>
                      {etapas.map((item) => (
                        <SelectItem key={item.etapa_id} value={item.etapa_id}>
                          {item.projeto_nome} · {item.codigo} · {item.etapa_nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>OP existente (opcional)</Label>
                  <Select
                    value={escolha?.ordemId || 'sem-op'}
                    onValueChange={(valor) => selecionarOrdem(pendencia.id, valor)}
                    disabled={!podeConfigurar || !etapa || salvandoId === pendencia.id}
                  >
                    <SelectTrigger><SelectValue placeholder="Sem OP específica" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sem-op">Vincular somente à Etapa</SelectItem>
                      {(etapa?.ordens ?? []).filter((ordem) => ordem.status !== 'cancelada').map((ordem) => (
                        <SelectItem key={ordem.id} value={ordem.id}>
                          OP {ordem.numero}{ordem.tarefa_nome_snapshot ? ` · ${ordem.tarefa_nome_snapshot}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 xl:flex-col xl:justify-center">
                  <Button
                    size="sm"
                    onClick={() => void vincular(pendencia)}
                    disabled={!podeConfigurar || !escolha?.processoId || salvandoId === pendencia.id}
                  >
                    <Link2 className="mr-1 h-4 w-4" />Vincular
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void ignorar(pendencia)}
                    disabled={!podeConfigurar || salvandoId === pendencia.id}
                  >
                    <XCircle className="mr-1 h-4 w-4" />Ignorar
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}

        {!loading && pendencias.length === 0 && (
          <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-emerald-600" />
            Nenhuma linha útil da programação está aguardando revisão.
          </Card>
        )}
      </div>
    </div>
  );
};
