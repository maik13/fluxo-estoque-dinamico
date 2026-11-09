import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Clock3, Loader2, LockKeyhole, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { formatarIdentificacaoOrdemProducao } from '@/hooks/useOrdensProducao';
import { ApontamentosEncerradosOp } from './ApontamentosEncerradosOp';
import type {
  ProducaoApontamento,
  ProducaoApontamentoMembro,
  ProducaoOrdemProducao,
} from '@/types/producao';

interface Props {
  ordem: ProducaoOrdemProducao;
  onVoltar: () => void;
}

const statusLabel: Record<string, string> = {
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  lancado: 'Pendente',
  conferido: 'Conferido',
  cancelado: 'Cancelado',
};

const formatarQuantidade = (valor: number | null | undefined) =>
  valor == null
    ? '—'
    : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(Number(valor));

const formatarDuracao = (minutos: number | null | undefined) => {
  if (minutos == null || !Number.isFinite(Number(minutos))) return '—';
  const total = Math.max(0, Math.round(Number(minutos)));
  const horas = Math.floor(total / 60);
  const restante = total % 60;
  if (horas === 0) return `${restante} min`;
  return `${horas}h ${String(restante).padStart(2, '0')}min`;
};

const formatarDataHora = (valor: Date | null) =>
  valor
    ? valor.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

const dataHoraDoApontamento = (
  apontamento: ProducaoApontamento,
  campo: 'inicio' | 'termino',
) => {
  const horario = apontamento[campo];
  const data = new Date(`${apontamento.data}T${horario}`);
  if (Number.isNaN(data.getTime())) return null;

  if (campo === 'termino') {
    const inicio = new Date(`${apontamento.data}T${apontamento.inicio}`);
    if (!Number.isNaN(inicio.getTime()) && data < inicio) data.setDate(data.getDate() + 1);
  }
  return data;
};

export const VisualizacaoOrdemProducaoConcluida = ({ ordem, onVoltar }: Props) => {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [apontamentos, setApontamentos] = useState<ProducaoApontamento[]>([]);
  const [membros, setMembros] = useState<ProducaoApontamentoMembro[]>([]);

  useEffect(() => {
    let ativo = true;

    const carregar = async () => {
      setCarregando(true);
      setErro(null);
      try {
        const { data: registros, error: apontamentosError } = await supabase
          .from('producao_apontamentos')
          .select('*')
          .eq('ordem_producao_id', ordem.id)
          .order('data', { ascending: true })
          .order('inicio', { ascending: true });

        if (apontamentosError) throw apontamentosError;
        const lista = ((registros ?? []) as ProducaoApontamento[]).filter(
          (apontamento) => apontamento.status !== 'cancelado',
        );

        let equipe: ProducaoApontamentoMembro[] = [];
        if (lista.length > 0) {
          const { data: vinculos, error: membrosError } = await supabase
            .from('producao_apontamento_membros')
            .select('*')
            .in('apontamento_id', lista.map((apontamento) => apontamento.id))
            .order('nome_snapshot');
          if (membrosError) throw membrosError;
          equipe = (vinculos ?? []) as ProducaoApontamentoMembro[];
        }

        if (!ativo) return;
        setApontamentos(lista);
        setMembros(equipe);
      } catch (error) {
        if (!ativo) return;
        setApontamentos([]);
        setMembros([]);
        setErro(error instanceof Error ? error.message : 'Não foi possível carregar a execução da OP.');
      } finally {
        if (ativo) setCarregando(false);
      }
    };

    void carregar();
    return () => {
      ativo = false;
    };
  }, [ordem.id]);

  const resumo = useMemo(() => {
    const inicios = apontamentos
      .map((apontamento) => dataHoraDoApontamento(apontamento, 'inicio'))
      .filter((valor): valor is Date => Boolean(valor));
    const finais = apontamentos
      .map((apontamento) => dataHoraDoApontamento(apontamento, 'termino'))
      .filter((valor): valor is Date => Boolean(valor));
    const executores = Array.from(
      new Set(membros.map((membro) => membro.nome_snapshot?.trim()).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const tempoApontado = apontamentos.reduce(
      (total, apontamento) => total + Number(apontamento.duracao_minutos || 0),
      0,
    );
    const horasHomem = membros.reduce(
      (total, membro) =>
        total + Number(membro.duracao_minutos_snapshot ?? membro.minutos_produtivos_snapshot ?? 0),
      0,
    );

    return {
      inicio: inicios.length > 0 ? new Date(Math.min(...inicios.map((data) => data.getTime()))) : null,
      fim: finais.length > 0 ? new Date(Math.max(...finais.map((data) => data.getTime()))) : null,
      executores,
      tempoApontado,
      horasHomem,
    };
  }, [apontamentos, membros]);

  const membrosPorApontamento = useMemo(() => {
    const resultado: Record<string, ProducaoApontamentoMembro[]> = {};
    membros.forEach((membro) => {
      resultado[membro.apontamento_id] = [...(resultado[membro.apontamento_id] ?? []), membro];
    });
    return resultado;
  }, [membros]);

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={onVoltar}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a etapa
      </Button>

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <header className="border-b bg-muted/20 p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold">{formatarIdentificacaoOrdemProducao(ordem)}</h3>
                <Badge variant="outline">{statusLabel[ordem.status] ?? ordem.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {ordem.projeto_nome} · {ordem.processo_nome}
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
              <LockKeyhole className="h-4 w-4" />
              Somente consulta — a OP não será reaberta
            </div>
          </div>
        </header>

        {carregando ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
            Carregando informações reais da execução...
          </div>
        ) : (
          <div className="space-y-5 p-5">
            {erro && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {erro}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Quantidade</p>
                <p className="mt-1 text-lg font-semibold">
                  {formatarQuantidade(ordem.quantidade_realizada)} de {formatarQuantidade(ordem.quantidade_planejada)} {ordem.unidade_medida ?? ''}
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" /> Tempo apontado
                </p>
                <p className="mt-1 text-lg font-semibold">{formatarDuracao(resumo.tempoApontado)}</p>
                {resumo.horasHomem > 0 && (
                  <p className="text-xs text-muted-foreground">{formatarDuracao(resumo.horasHomem)} de mão de obra</p>
                )}
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Início real</p>
                <p className="mt-1 font-semibold">{formatarDataHora(resumo.inicio)}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Fim real</p>
                <p className="mt-1 font-semibold">{formatarDataHora(resumo.fim)}</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border p-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Users className="h-4 w-4" /> Quem executou
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {resumo.executores.length > 0
                    ? resumo.executores.join(', ')
                    : ordem.responsavel_nome_snapshot ?? 'Nenhum executor identificado nos apontamentos.'}
                </p>
              </div>
              <div className="rounded-lg border p-4 text-sm">
                <p><span className="text-muted-foreground">Atividade:</span> {ordem.tarefa_nome_snapshot ?? ordem.descricao ?? 'Não informada'}</p>
                <p className="mt-1"><span className="text-muted-foreground">Responsável previsto:</span> {ordem.responsavel_nome_snapshot ?? 'Não definido'}</p>
                <p className="mt-1"><span className="text-muted-foreground">Ciclos registrados:</span> {apontamentos.length}</p>
              </div>
            </div>

            <div>
              <h4 className="mb-3 text-base font-semibold">Execução registrada</h4>
              {apontamentos.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Esta OP não possui apontamentos válidos vinculados.
                </div>
              ) : (
                <div className="space-y-2">
                  {apontamentos.map((apontamento) => {
                    const equipe = membrosPorApontamento[apontamento.id] ?? [];
                    return (
                      <div key={apontamento.id} className="grid gap-2 rounded-lg border p-3 text-sm md:grid-cols-[1.1fr_0.7fr_0.7fr_1.5fr] md:items-center">
                        <div>
                          <p className="font-medium">
                            {new Date(`${apontamento.data}T12:00:00`).toLocaleDateString('pt-BR')} · {apontamento.inicio.slice(0, 5)}–{apontamento.termino.slice(0, 5)}
                          </p>
                          <Badge variant="outline" className="mt-1 text-[10px]">
                            {statusLabel[apontamento.status] ?? apontamento.status}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Duração</p>
                          <p className="font-medium">{formatarDuracao(apontamento.duracao_minutos)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Quantidade</p>
                          <p className="font-medium">{formatarQuantidade(apontamento.quantidade_produzida)} {ordem.unidade_medida ?? ''}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Equipe</p>
                          <p className="font-medium">{equipe.map((membro) => membro.nome_snapshot).join(', ') || 'Não identificada'}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-lg border p-4">
              <h4 className="text-base font-semibold">Evidências e retificações</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Abra os apontamentos encerrados para consultar ou adicionar fotos sem reabrir a OP.
              </p>
              <div className="mt-3">
                <ApontamentosEncerradosOp ordem={ordem} />
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
