import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';

type Divergencia = {
  id: string;
  planejamento_item_id: string;
  item_nome: string;
  tipo: string;
  valor_anterior: number | null;
  valor_novo: number | null;
  diferenca: number | null;
  status: 'pendente' | 'resolvida' | 'ignorada';
  detalhes: Record<string, unknown>;
  created_at: string;
};

export const DivergenciasPlanejamento = () => {
  const { canConfigurarProducao } = usePermissions();
  const podeResolver = canConfigurarProducao();
  const [itens, setItens] = useState<Divergencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [acaoId, setAcaoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)('listar_divergencias_planejamento_v1');
      if (error) throw error;
      setItens((data ?? []) as Divergencia[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar divergências.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const resolver = async (id: string, acao: 'revisada' | 'ignorada') => {
    setAcaoId(id);
    try {
      const { error } = await (supabase.rpc as any)('resolver_divergencia_planejamento_v1', {
        p_divergencia_id: id,
        p_acao: acao,
      });
      if (error) throw error;
      toast.success(acao === 'ignorada' ? 'Divergência marcada como ignorada.' : 'Divergência marcada como revisada.');
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível resolver a divergência.');
    } finally {
      setAcaoId(null);
    }
  };

  const pendentes = itens.filter((item) => item.status === 'pendente');

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">Divergências de planejamento</p>
          <p className="text-sm text-muted-foreground">
            Mudanças de necessidade não alteram OP ou quantidade já programada automaticamente.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void carregar()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Atualizar
        </Button>
      </div>

      {pendentes.map((item) => {
        const diferenca = Number(item.diferenca ?? 0);
        const mensagem =
          typeof item.detalhes?.mensagem === 'string'
            ? item.detalhes.mensagem
            : `Necessidade alterada: ${diferenca >= 0 ? '+' : ''}${diferenca}`;

        return (
          <Card key={item.id} className="border-amber-300 p-4">
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <p className="font-semibold">{item.item_nome}</p>
                  <Badge variant="outline">{mensagem}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Necessidade anterior: {Number(item.valor_anterior ?? 0)} · necessidade recalculada: {Number(item.valor_novo ?? 0)}.
                  A OP/necessidade existente permanece inalterada até decisão humana.
                </p>
              </div>
              {podeResolver && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void resolver(item.id, 'revisada')} disabled={acaoId === item.id}>
                    <CheckCircle2 className="mr-1 h-4 w-4" />Revisada
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void resolver(item.id, 'ignorada')} disabled={acaoId === item.id}>
                    Ignorar
                  </Button>
                </div>
              )}
            </div>
          </Card>
        );
      })}

      {!loading && pendentes.length === 0 && (
        <Card className="border-dashed p-5 text-center text-sm text-muted-foreground">
          Nenhuma divergência de necessidade aguardando decisão.
        </Card>
      )}
    </div>
  );
};
