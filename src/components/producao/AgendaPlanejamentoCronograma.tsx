import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Flag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

type Marco = {
  id: string;
  data: string;
  tipo: 'marco' | 'gargalo';
  titulo: string;
  descricao: string | null;
  prioridade: string | null;
  status: string | null;
};

interface Props {
  inicio?: string | null;
  fim?: string | null;
  somenteMarcos?: boolean;
  compacto?: boolean;
}

const formatarData = (data: string) =>
  new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });

export const AgendaPlanejamentoCronograma = ({
  inicio = null,
  fim = null,
  compacto = false,
}: Props) => {
  const [itens, setItens] = useState<Marco[]>([]);

  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      let query = (supabase as any)
        .from('producao_cronograma_marcos')
        .select('id,data,tipo,titulo,descricao,prioridade,status')
        .order('data');

      if (inicio) query = query.gte('data', inicio);
      if (fim) query = query.lte('data', fim);

      const { data, error } = await query;
      if (!ativo || error) return;
      setItens((data ?? []) as Marco[]);
    };
    void carregar();
    return () => { ativo = false; };
  }, [fim, inicio]);

  const visiveis = useMemo(
    () => compacto ? itens.slice(0, 8) : itens,
    [compacto, itens],
  );

  if (visiveis.length === 0) return null;

  if (compacto) {
    return (
      <div className="border-b bg-muted/10 px-4 py-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <Flag className="h-4 w-4" />Marcos e riscos no período
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {visiveis.map((item) => (
            <div key={item.id} className="min-w-[220px] rounded-lg border bg-card px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{formatarData(item.data)}</span>
                <Badge variant={item.tipo === 'gargalo' ? 'destructive' : 'outline'} className="text-[10px]">
                  {item.tipo === 'gargalo' ? 'Risco' : 'Marco'}
                </Badge>
              </div>
              <p className="mt-1 line-clamp-2 font-medium">{item.titulo}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {visiveis.map((item) => (
        <Card key={item.id} className="p-4">
          <div className="flex flex-col justify-between gap-3 md:flex-row">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {item.tipo === 'gargalo'
                  ? <AlertTriangle className="h-4 w-4 text-amber-600" />
                  : <CalendarClock className="h-4 w-4" />}
                <p className="font-medium">{item.titulo}</p>
                <Badge variant="outline">{item.tipo}</Badge>
                {item.prioridade && (
                  <Badge variant={item.prioridade === 'Alta' ? 'destructive' : 'secondary'}>
                    {item.prioridade}
                  </Badge>
                )}
              </div>
              {item.descricao && <p className="mt-1 text-sm text-muted-foreground">{item.descricao}</p>}
            </div>
            <div className="shrink-0 text-sm md:text-right">
              <p className="font-semibold">{formatarData(item.data)}</p>
              {item.status && <p className="text-xs text-muted-foreground">{item.status}</p>}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
