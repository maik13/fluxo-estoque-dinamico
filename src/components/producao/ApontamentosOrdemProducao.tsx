import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Clock3, Loader2, Pencil, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import { notificarOrdensProducaoAlteradas } from '@/hooks/useOrdensProducao';
import { supabase } from '@/integrations/supabase/client';
import type {
  ProducaoApontamento,
  ProducaoApontamentoMembro,
  ProducaoMembro,
  ProducaoOrdemProducao,
} from '@/types/producao';
import { FormRetificarApontamentoProducao } from './FormRetificarApontamentoProducao';

interface Props {
  ordem: ProducaoOrdemProducao;
}

const statusLabel: Record<ProducaoApontamento['status'], string> = {
  lancado: 'Pendente',
  conferido: 'Conferido',
  cancelado: 'Cancelado',
};

const statusClassName: Record<ProducaoApontamento['status'], string> = {
  lancado: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  conferido: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  cancelado: 'border-muted-foreground/30 bg-muted text-muted-foreground',
};

const formatarQuantidade = (valor: number | null | undefined) =>
  valor == null
    ? '—'
    : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(Number(valor));

const formatarData = (data: string) =>
  new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR');

/**
 * Histórico completo da OP. Ele é diferente do resumo compacto usado nos cards:
 * na página da OP o usuário precisa conferir cada apontamento sem abrir outra tela.
 */
export const ApontamentosOrdemProducao = ({ ordem }: Props) => {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [apontamentos, setApontamentos] = useState<ProducaoApontamento[]>([]);
  const [membrosDisponiveis, setMembrosDisponiveis] = useState<ProducaoMembro[]>([]);
  const [membrosPorApontamento, setMembrosPorApontamento] = useState<
    Record<string, ProducaoApontamentoMembro[]>
  >({});
  const [retificando, setRetificando] = useState<ProducaoApontamento | null>(null);
  const { canApontarProducao } = usePermissions();
  const podeRetificar = canApontarProducao();

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    try {
      const [{ data: registros, error: apontamentosError }, { data: equipe, error: equipeError }] =
        await Promise.all([
          (supabase.from('producao_apontamentos') as any)
            .select('*')
            .eq('ordem_producao_id', ordem.id)
            .order('data', { ascending: false })
            .order('inicio', { ascending: false }),
          (supabase.from('producao_membros') as any)
            .select('*')
            .eq('ativo', true)
            .order('nome'),
        ]);

      if (apontamentosError) throw apontamentosError;
      if (equipeError) throw equipeError;

      const lista = (registros ?? []) as ProducaoApontamento[];
      const ids = lista.map((apontamento) => apontamento.id);
      let membros: ProducaoApontamentoMembro[] = [];

      if (ids.length > 0) {
        const { data, error: membrosError } = await (supabase.from(
          'producao_apontamento_membros',
        ) as any)
          .select('*')
          .in('apontamento_id', ids)
          .order('nome_snapshot');
        if (membrosError) throw membrosError;
        membros = (data ?? []) as ProducaoApontamentoMembro[];
      }

      setApontamentos(lista);
      setMembrosDisponiveis((equipe ?? []) as ProducaoMembro[]);
      setMembrosPorApontamento(
        membros.reduce<Record<string, ProducaoApontamentoMembro[]>>((porApontamento, membro) => {
          porApontamento[membro.apontamento_id] = porApontamento[membro.apontamento_id] ?? [];
          porApontamento[membro.apontamento_id].push(membro);
          return porApontamento;
        }, {}),
      );
    } catch (cause) {
      setApontamentos([]);
      setMembrosPorApontamento({});
      setErro(cause instanceof Error ? cause.message : 'Não foi possível carregar os apontamentos desta OP.');
    } finally {
      setCarregando(false);
    }
  }, [ordem.id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const tarefaNome = ordem.tarefa_nome_snapshot ?? 'Atividade da OP';

  return (
    <section className="mt-5 border-t pt-5" aria-labelledby="apontamentos-op-titulo">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h4 id="apontamentos-op-titulo" className="font-semibold">
              Apontamentos da OP
            </h4>
            {!carregando && <Badge variant="outline">{apontamentos.length}</Badge>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Histórico de produção registrado nesta ordem, incluindo apontamentos cancelados.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void carregar()} disabled={carregando}>
          {carregando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Atualizar apontamentos
        </Button>
      </div>

      {carregando ? (
        <div className="mt-4 flex min-h-28 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando apontamentos...
        </div>
      ) : erro ? (
        <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Não foi possível carregar os apontamentos desta OP. {erro}
        </div>
      ) : apontamentos.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
          Nenhum apontamento foi registrado nesta OP ainda.
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border">
          {apontamentos.map((apontamento, indice) => {
            const equipe = membrosPorApontamento[apontamento.id] ?? [];
            const retificado = Number((apontamento as any).retificacoes_count ?? 0) > 0;
            const quantidade = apontamento.quantidade_produzida == null
              ? null
              : Number(apontamento.quantidade_produzida);

            return (
              <article
                key={apontamento.id}
                className={`p-4 ${indice > 0 ? 'border-t' : ''} ${apontamento.status === 'cancelado' ? 'bg-muted/25' : 'bg-card'}`}
              >
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{formatarData(apontamento.data)}</span>
                      <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock3 className="h-3.5 w-3.5" />
                        {apontamento.inicio.slice(0, 5)}–{apontamento.termino.slice(0, 5)}
                      </span>
                      <Badge variant="outline" className={statusClassName[apontamento.status]}>
                        {statusLabel[apontamento.status]}
                      </Badge>
                      {apontamento.demao_numero != null && (
                        <Badge variant="outline">{apontamento.demao_numero}ª demão</Badge>
                      )}
                      {retificado && <Badge variant="outline"><Pencil className="mr-1 h-3 w-3" />Retificado</Badge>}
                      {apontamento.fechamento_retroativo && <Badge variant="outline">Lançamento retroativo</Badge>}
                    </div>

                    <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Quantidade</p>
                        <p className={apontamento.status === 'cancelado' ? 'font-semibold text-muted-foreground line-through' : 'font-semibold'}>
                          {formatarQuantidade(quantidade)}{ordem.unidade_medida ? ` ${ordem.unidade_medida}` : ''}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Tempo produtivo</p>
                        <p className="font-semibold">{apontamento.minutos_produtivos} min</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Tempo improdutivo</p>
                        <p className="font-semibold">{apontamento.minutos_improdutivos} min</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Users className="mt-0.5 h-4 w-4 shrink-0" />
                      <span><strong className="font-medium text-foreground">Equipe:</strong> {equipe.map((membro) => membro.nome_snapshot).join(', ') || 'Não informada'}</span>
                    </div>

                    {(apontamento.observacoes || apontamento.motivo_improdutivo || apontamento.motivo_cancelamento) && (
                      <div className="rounded-md bg-muted/45 px-3 py-2 text-sm text-muted-foreground">
                        {apontamento.observacoes && <p><strong className="text-foreground">Observações:</strong> {apontamento.observacoes}</p>}
                        {apontamento.motivo_improdutivo && <p><strong className="text-foreground">Motivo improdutivo:</strong> {apontamento.motivo_improdutivo}</p>}
                        {apontamento.motivo_cancelamento && <p><strong className="text-foreground">Motivo do cancelamento:</strong> {apontamento.motivo_cancelamento}</p>}
                      </div>
                    )}
                  </div>

                  {podeRetificar && apontamento.status !== 'cancelado' && (
                    <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setRetificando(apontamento)}>
                      <Pencil className="mr-2 h-4 w-4" /> Retificar apontamento
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <FormRetificarApontamentoProducao
        apontamento={retificando}
        ordem={ordem}
        tarefaNome={tarefaNome}
        membrosDisponiveis={membrosDisponiveis}
        membrosAtuais={retificando ? membrosPorApontamento[retificando.id] ?? [] : []}
        onClose={() => setRetificando(null)}
        onSuccess={async () => {
          await carregar();
          notificarOrdensProducaoAlteradas();
        }}
      />
    </section>
  );
};
