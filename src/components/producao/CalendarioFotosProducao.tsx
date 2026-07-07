import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useProducaoAnexos } from '@/hooks/useProducaoAnexos';
import type {
  FiltrosProducaoGerencial,
  ProducaoApontamento,
  ProducaoApontamentoAnexo,
  ProducaoApontamentoMembro,
  ProducaoTarefa,
} from '@/types/producao';
import type { LocalUtilizacaoConfig } from '@/hooks/useConfiguracoes';
import { cn } from '@/lib/utils';

interface FotoCalendario {
  anexo: ProducaoApontamentoAnexo;
  apontamento: ProducaoApontamento;
  tarefa?: ProducaoTarefa;
  local?: LocalUtilizacaoConfig;
  membros: ProducaoApontamentoMembro[];
}

interface CalendarioFotosProducaoProps {
  filtros: FiltrosProducaoGerencial;
}

const inicioMes = (data: Date) => new Date(data.getFullYear(), data.getMonth(), 1);
const fimMes = (data: Date) => new Date(data.getFullYear(), data.getMonth() + 1, 0);
const chaveData = (data: Date) => data.toISOString().slice(0, 10);

const MiniaturaFoto = ({
  anexo,
  obterUrl,
}: {
  anexo: ProducaoApontamentoAnexo;
  obterUrl: (path: string) => Promise<string>;
}) => {
  const [url, setUrl] = useState('');

  useEffect(() => {
    let ativo = true;
    void obterUrl(anexo.file_path)
      .then((signedUrl) => {
        if (ativo) setUrl(signedUrl);
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [anexo.file_path, obterUrl]);

  return url ? (
    <img src={url} alt={anexo.file_name} className="h-full w-full object-cover" />
  ) : (
    <ImageIcon className="h-4 w-4 text-muted-foreground" />
  );
};

export const CalendarioFotosProducao = ({ filtros }: CalendarioFotosProducaoProps) => {
  const [mesAtual, setMesAtual] = useState(() => inicioMes(new Date()));
  const [fotos, setFotos] = useState<FotoCalendario[]>([]);
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const { obterUrlAnexo, baixarAnexo } = useProducaoAnexos();

  useEffect(() => {
    let ativo = true;

    const carregar = async () => {
      const inicio = chaveData(inicioMes(mesAtual));
      const fim = chaveData(fimMes(mesAtual));
      let consulta = supabase
        .from('producao_apontamentos')
        .select('*')
        .gte('data', inicio)
        .lte('data', fim);

      if (filtros.projeto_local_id) {
        consulta = consulta.eq('projeto_local_id', filtros.projeto_local_id);
      }
      if (filtros.tarefa_id) {
        consulta = consulta.eq('tarefa_id', filtros.tarefa_id);
      }
      if (filtros.local_tipo) {
        consulta = consulta.eq('local_tipo', filtros.local_tipo);
      }

      const [
        apontamentosResult,
        anexosResult,
        membrosResult,
        tarefasResult,
        locaisResult,
      ] = await Promise.all([
        consulta,
        supabase.from('producao_apontamento_anexos').select('*'),
        supabase.from('producao_apontamento_membros').select('*'),
        supabase.from('producao_tarefas').select('*'),
        supabase.from('locais_utilizacao').select('*'),
      ]);

      const error =
        apontamentosResult.error ??
        anexosResult.error ??
        membrosResult.error ??
        tarefasResult.error ??
        locaisResult.error;
      if (error) throw error;

      let apontamentos = (apontamentosResult.data ?? []) as ProducaoApontamento[];
      const membrosTodos = (membrosResult.data ?? []) as ProducaoApontamentoMembro[];
      if (filtros.membro_id) {
        const ids = new Set(
          membrosTodos
            .filter((membro) => membro.membro_id === filtros.membro_id)
            .map((membro) => membro.apontamento_id),
        );
        apontamentos = apontamentos.filter((apontamento) => ids.has(apontamento.id));
      }

      const apontamentosPorId = new Map(apontamentos.map((item) => [item.id, item]));
      const tarefasPorId = new Map(
        ((tarefasResult.data ?? []) as ProducaoTarefa[]).map((item) => [item.id, item]),
      );
      const locaisPorId = new Map(
        ((locaisResult.data ?? []) as LocalUtilizacaoConfig[]).map((item) => [item.id, item]),
      );
      const membrosPorApontamento = membrosTodos.reduce<
        Record<string, ProducaoApontamentoMembro[]>
      >((acc, membro) => {
        acc[membro.apontamento_id] = acc[membro.apontamento_id] ?? [];
        acc[membro.apontamento_id].push(membro);
        return acc;
      }, {});

      const registros = ((anexosResult.data ?? []) as ProducaoApontamentoAnexo[])
        .map((anexo) => {
          const apontamento = apontamentosPorId.get(anexo.apontamento_id);
          if (!apontamento) return null;
          return {
            anexo,
            apontamento,
            tarefa: tarefasPorId.get(apontamento.tarefa_id),
            local: locaisPorId.get(apontamento.projeto_local_id),
            membros: membrosPorApontamento[apontamento.id] ?? [],
          };
        })
        .filter((item): item is FotoCalendario => Boolean(item));

      if (ativo) setFotos(registros);
    };

    void carregar().catch(() => {
      if (ativo) setFotos([]);
    });

    return () => {
      ativo = false;
    };
  }, [filtros, mesAtual]);

  const dias = useMemo(() => {
    const primeiro = inicioMes(mesAtual);
    const ultimo = fimMes(mesAtual);
    const inicioGrade = new Date(primeiro);
    inicioGrade.setDate(primeiro.getDate() - primeiro.getDay());
    const total = 42;
    return Array.from({ length: total }, (_, indice) => {
      const data = new Date(inicioGrade);
      data.setDate(inicioGrade.getDate() + indice);
      return data;
    });
  }, [mesAtual]);

  const fotosPorDia = useMemo(
    () =>
      fotos.reduce<Record<string, FotoCalendario[]>>((acc, foto) => {
        acc[foto.apontamento.data] = acc[foto.apontamento.data] ?? [];
        acc[foto.apontamento.data].push(foto);
        return acc;
      }, {}),
    [fotos],
  );
  const fotosDia = diaSelecionado ? fotosPorDia[diaSelecionado] ?? [] : [];
  const hoje = chaveData(new Date());

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Calendário de fotos</CardTitle>
          <CardDescription>
            Fotos da Produção organizadas por dia. As imagens continuam no bucket privado.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMesAtual(inicioMes(new Date()))}>
            Hoje
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-center text-lg font-semibold">
          {mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </p>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia) => (
            <div key={dia}>{dia}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {dias.map((dia) => {
            const chave = chaveData(dia);
            const fotosDoDia = fotosPorDia[chave] ?? [];
            const foraDoMes = dia.getMonth() !== mesAtual.getMonth();
            return (
              <button
                key={chave}
                type="button"
                disabled={fotosDoDia.length === 0}
                onClick={() => setDiaSelecionado(chave)}
                className={cn(
                  'min-h-24 rounded-lg border p-1 text-left transition hover:border-primary',
                  foraDoMes && 'opacity-40',
                  chave === hoje && 'border-primary',
                  fotosDoDia.length === 0 && 'bg-muted/10 text-muted-foreground hover:border-border',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{dia.getDate()}</span>
                  {fotosDoDia.length > 0 && (
                    <span className="rounded-full bg-primary/10 px-1.5 text-xs text-primary">
                      {fotosDoDia.length}
                    </span>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1">
                  {fotosDoDia.slice(0, 3).map((foto) => (
                    <div key={foto.anexo.id} className="h-10 overflow-hidden rounded border bg-background">
                      <MiniaturaFoto anexo={foto.anexo} obterUrl={obterUrlAnexo} />
                    </div>
                  ))}
                </div>
                {fotosDoDia.length > 3 && (
                  <p className="mt-1 text-xs text-muted-foreground">+{fotosDoDia.length - 3}</p>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>

      <Dialog open={Boolean(diaSelecionado)} onOpenChange={(aberto) => !aberto && setDiaSelecionado(null)}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fotos do dia</DialogTitle>
            <DialogDescription>
              {diaSelecionado
                ? new Date(`${diaSelecionado}T12:00:00`).toLocaleDateString('pt-BR')
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fotosDia.map((foto) => (
              <div key={foto.anexo.id} className="rounded-lg border p-3">
                <div className="mb-3 aspect-video overflow-hidden rounded-md border bg-muted/20">
                  <MiniaturaFoto anexo={foto.anexo} obterUrl={obterUrlAnexo} />
                </div>
                <p className="text-sm font-medium">{foto.local?.nome ?? 'Projeto não encontrado'}</p>
                <p className="text-xs text-muted-foreground">{foto.tarefa?.nome ?? 'Tarefa não encontrada'}</p>
                <p className="text-xs text-muted-foreground">
                  {foto.apontamento.inicio.slice(0, 5)}–{foto.apontamento.termino.slice(0, 5)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {foto.membros.map((membro) => membro.nome_snapshot).join(', ') || 'Sem membros'}
                </p>
                <p className="mt-2 truncate text-xs">{foto.anexo.file_name}</p>
                <div className="mt-3 flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => void baixarAnexo(foto.anexo)}>
                    <Download className="mr-2 h-4 w-4" />
                    Baixar
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => window.dispatchEvent(new CustomEvent('producao-historico-detalhes', { detail: foto.apontamento.id }))}>
                    Ver detalhes
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
