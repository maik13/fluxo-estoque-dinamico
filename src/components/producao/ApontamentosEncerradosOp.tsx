import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import {
  notificarOrdensProducaoAlteradas,
} from '@/hooks/useOrdensProducao';
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

const statusLabel: Record<string, string> = {
  lancado: 'Pendente',
  conferido: 'Conferido',
  cancelado: 'Cancelado',
};

const formatarQuantidade = (valor: number | null | undefined) =>
  valor == null
    ? '—'
    : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(valor);

export const ApontamentosEncerradosOp = ({ ordem }: Props) => {
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
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
      setApontamentos(lista);
      setMembrosDisponiveis((equipe ?? []) as ProducaoMembro[]);

      const pares = await Promise.all(
        lista.map(async (apontamento) => {
          const { data, error } = await (supabase.from('producao_apontamento_membros') as any)
            .select('*')
            .eq('apontamento_id', apontamento.id)
            .order('nome_snapshot');
          if (error) throw error;
          return [apontamento.id, (data ?? []) as ProducaoApontamentoMembro[]] as const;
        }),
      );
      setMembrosPorApontamento(Object.fromEntries(pares));
    } catch {
      setApontamentos([]);
      setMembrosPorApontamento({});
    } finally {
      setCarregando(false);
    }
  }, [ordem.id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const encerrados = useMemo(
    () => apontamentos.filter((apontamento) => apontamento.status !== 'cancelado'),
    [apontamentos],
  );

  const tarefaNome =
    retificando?.tarefa_id && retificando.tarefa_id === ordem.tarefa_id
      ? ordem.tarefa_nome_snapshot ?? 'Atividade da OP'
      : ordem.tarefa_nome_snapshot ?? 'Atividade da OP';

  if (!carregando && encerrados.length === 0) return null;

  return (
    <div className="w-full border-t border-border/60 pt-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs"
        onClick={() => setAberto((valor) => !valor)}
      >
        {carregando ? (
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
        ) : aberto ? (
          <ChevronUp className="mr-2 h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="mr-2 h-3.5 w-3.5" />
        )}
        Apontamentos encerrados ({encerrados.length})
      </Button>

      {aberto && encerrados.length > 0 && (
        <div className="mt-2 space-y-1.5 rounded-md border bg-muted/10 p-2">
          {encerrados.map((apontamento) => {
            const equipe = membrosPorApontamento[apontamento.id] ?? [];
            const retificado = Number((apontamento as any).retificacoes_count || 0) > 0;
            return (
              <div
                key={apontamento.id}
                className="flex flex-col gap-2 rounded-md border bg-background/60 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 font-medium">
                    <span>
                      {new Date(`${apontamento.data}T12:00:00`).toLocaleDateString('pt-BR')}
                      {' · '}
                      {apontamento.inicio.slice(0, 5)}–{apontamento.termino.slice(0, 5)}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {statusLabel[apontamento.status] ?? apontamento.status}
                    </Badge>
                    {retificado && (
                      <Badge variant="outline" className="text-[10px]">
                        Retificado
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    Quantidade: {formatarQuantidade(
                      apontamento.quantidade_produzida == null
                        ? null
                        : Number(apontamento.quantidade_produzida),
                    )}
                    {ordem.unidade_medida ? ` ${ordem.unidade_medida}` : ''}
                    {' · '}Equipe: {equipe.map((membro) => membro.nome_snapshot).join(', ') || '—'}
                  </div>
                </div>

                {podeRetificar && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0"
                    onClick={() => setRetificando(apontamento)}
                    title="Retificar este apontamento"
                  >
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Retificar
                  </Button>
                )}
              </div>
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
    </div>
  );
};
