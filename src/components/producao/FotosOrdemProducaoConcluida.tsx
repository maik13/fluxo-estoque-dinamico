import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, ImageIcon, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useProducaoAnexos } from '@/hooks/useProducaoAnexos';
import { supabase } from '@/integrations/supabase/client';
import type {
  ProducaoApontamento,
  ProducaoApontamentoAnexo,
  ProducaoOrdemProducao,
} from '@/types/producao';

interface Props {
  ordem: ProducaoOrdemProducao;
}

const TIPOS_ACEITOS = 'image/jpeg,image/png,image/webp';

export const FotosOrdemProducaoConcluida = ({ ordem }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [apontamentos, setApontamentos] = useState<ProducaoApontamento[]>([]);
  const [anexos, setAnexos] = useState<ProducaoApontamentoAnexo[]>([]);
  const [destinoId, setDestinoId] = useState<string | null>(null);
  const { listarAnexosPorApontamentos, anexarImagem, baixarAnexo } = useProducaoAnexos();

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data, error } = await supabase
        .from('producao_apontamentos')
        .select('*')
        .eq('ordem_producao_id', ordem.id)
        .neq('status', 'cancelado')
        .order('data', { ascending: true })
        .order('inicio', { ascending: true });
      if (error) throw error;

      const registros = (data ?? []) as ProducaoApontamento[];
      setApontamentos(registros);
      setAnexos(await listarAnexosPorApontamentos(registros.map((item) => item.id)));
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível carregar as fotos desta OP.');
    } finally {
      setCarregando(false);
    }
  }, [listarAnexosPorApontamentos, ordem.id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const anexosPorApontamento = useMemo(
    () => anexos.reduce<Record<string, ProducaoApontamentoAnexo[]>>((acc, anexo) => {
      acc[anexo.apontamento_id] = acc[anexo.apontamento_id] ?? [];
      acc[anexo.apontamento_id].push(anexo);
      return acc;
    }, {}),
    [anexos],
  );

  const selecionarFotos = (apontamentoId: string) => {
    setDestinoId(apontamentoId);
    inputRef.current?.click();
  };

  const enviarFotos = async (event: ChangeEvent<HTMLInputElement>) => {
    const arquivos = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!destinoId || arquivos.length === 0) return;

    setEnviando(true);
    let enviados = 0;
    try {
      for (const arquivo of arquivos) {
        await anexarImagem(destinoId, arquivo);
        enviados += 1;
      }
      await carregar();
      toast.success(`${enviados} foto(s) adicionada(s) à OP sem reabri-la.`);
    } catch (error) {
      console.error(error);
      toast.error(
        enviados > 0
          ? `${enviados} foto(s) foram salvas; uma das imagens não pôde ser enviada.`
          : 'Não foi possível adicionar as fotos.',
      );
    } finally {
      setEnviando(false);
      setDestinoId(null);
    }
  };

  if (carregando) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando fotos...</div>;
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={TIPOS_ACEITOS}
        multiple
        onChange={enviarFotos}
      />
      {apontamentos.map((apontamento) => {
        const fotos = anexosPorApontamento[apontamento.id] ?? [];
        return (
          <div key={apontamento.id} className="rounded-md border bg-background/60 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">
                  {new Date(`${apontamento.data}T12:00:00`).toLocaleDateString('pt-BR')}
                  {' · '}{apontamento.inicio.slice(0, 5)}–{apontamento.termino.slice(0, 5)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {fotos.length} foto(s) vinculada(s) a este ciclo
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={enviando}
                onClick={() => selecionarFotos(apontamento.id)}
              >
                {enviando && destinoId === apontamento.id
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <Upload className="mr-2 h-4 w-4" />}
                Adicionar fotos
              </Button>
            </div>

            {fotos.length > 0 && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {fotos.map((foto) => (
                  <div key={foto.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1.5">
                    <span className="min-w-0 truncate text-xs"><ImageIcon className="mr-1 inline h-3.5 w-3.5" />{foto.file_name}</span>
                    <Button type="button" size="icon" variant="ghost" title="Baixar foto" onClick={() => void baixarAnexo(foto)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
