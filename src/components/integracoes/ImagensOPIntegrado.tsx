/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { addMonths, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Image as ImageIcon, Loader2, RefreshCw, Search } from "lucide-react";
import { appControleSupabase } from "@/integrations/appcontrole/client";
import { AppControleSessionGate } from "@/components/integracoes/AppControleSessionGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const ac = appControleSupabase as any;

type LogImagem = {
  id: string;
  funcionario: string | null;
  processo: string | null;
  projeto: string | null;
  scheduled_date: string | null;
  data_registro: string;
  image_url: string;
  codigo_op: string | null;
  atividade: string | null;
};

type ImagemOP = {
  id: string;
  logId: string;
  urlOriginal: string;
  previewUrl: string;
  data: string;
  codigoOp: string;
  projeto: string;
  processo: string;
  funcionario: string;
};

function splitImageUrls(value: string | null | undefined) {
  if (!value) return [];
  return Array.from(new Set(value.split(",").map((url) => url.trim()).filter(Boolean)));
}

function getStoragePath(url: string) {
  const clean = url.trim();
  if (!clean) return null;
  try {
    const pathname = clean.startsWith("http") ? new URL(clean).pathname : clean.split("?")[0];
    const marker = "/op-images/";
    const index = pathname.indexOf(marker);
    if (index >= 0) return decodeURIComponent(pathname.slice(index + marker.length));
    return decodeURIComponent(pathname.replace(/^\/+/, ""));
  } catch {
    return clean.split("?")[0].split("/").pop() || null;
  }
}

async function resolverUrls(urls: string[]) {
  const clean = urls.map((url) => url.trim()).filter(Boolean);
  const paths = clean.map(getStoragePath).filter((path): path is string => Boolean(path));
  if (!paths.length) return clean;

  const uniquePaths = Array.from(new Set(paths));
  const { data, error } = await appControleSupabase.storage
    .from("op-images")
    .createSignedUrls(uniquePaths, 60 * 60);

  if (error || !data) {
    if (error) console.warn("Erro ao assinar imagens de OP:", error);
    return clean;
  }

  const signed = new Map(
    data.filter((item) => item.signedUrl).map((item) => [item.path, item.signedUrl]),
  );

  return clean.map((url) => {
    const path = getStoragePath(url);
    return (path && signed.get(path)) || url;
  });
}

async function carregarImagens(mes: Date): Promise<ImagemOP[]> {
  const inicioRegistro = format(startOfMonth(mes), "yyyy-MM-dd") + "T00:00:00";
  const fimRegistro = format(endOfMonth(mes), "yyyy-MM-dd") + "T23:59:59";
  const inicioData = format(startOfMonth(mes), "yyyy-MM-dd");
  const fimData = format(endOfMonth(mes), "yyyy-MM-dd");

  const columns = "id,funcionario,processo,projeto,scheduled_date,data_registro,image_url,codigo_op,atividade";

  const [porRegistro, porProgramacao] = await Promise.all([
    ac.from("production_logs")
      .select(columns)
      .not("image_url", "is", null)
      .gte("data_registro", inicioRegistro)
      .lte("data_registro", fimRegistro),
    ac.from("production_logs")
      .select(columns)
      .not("image_url", "is", null)
      .gte("scheduled_date", inicioData)
      .lte("scheduled_date", fimData),
  ]);

  if (porRegistro.error) throw porRegistro.error;
  if (porProgramacao.error) throw porProgramacao.error;

  const logs = new Map<string, LogImagem>();
  [...(porRegistro.data || []), ...(porProgramacao.data || [])].forEach((row: LogImagem) => {
    logs.set(row.id, row);
  });

  const brutas: Omit<ImagemOP, "previewUrl">[] = [];
  const urls: string[] = [];
  const vistos = new Set<string>();

  Array.from(logs.values()).forEach((log) => {
    const data = log.scheduled_date || format(new Date(log.data_registro), "yyyy-MM-dd");
    splitImageUrls(log.image_url).forEach((url, index) => {
      const key = (getStoragePath(url) || url.split("?")[0]).toLowerCase();
      if (vistos.has(key)) return;
      vistos.add(key);
      brutas.push({
        id: `${log.id}-${index}`,
        logId: log.id,
        urlOriginal: url,
        data,
        codigoOp: log.codigo_op || "Sem OP",
        projeto: log.projeto || "Projeto não informado",
        processo: log.processo || "Processo não informado",
        funcionario: log.funcionario || "Não informado",
      });
      urls.push(url);
    });
  });

  const resolvidas = await resolverUrls(urls);
  return brutas
    .map((imagem, index) => ({ ...imagem, previewUrl: resolvidas[index] || imagem.urlOriginal }))
    .sort((a, b) => b.data.localeCompare(a.data) || a.codigoOp.localeCompare(b.codigoOp, "pt-BR"));
}

function Inner() {
  const [mes, setMes] = useState(new Date());
  const [imagens, setImagens] = useState<ImagemOP[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [selecionada, setSelecionada] = useState<ImagemOP | null>(null);

  const carregar = async () => {
    setCarregando(true);
    setErro("");
    try {
      setImagens(await carregarImagens(mes));
    } catch (error: any) {
      console.error("Erro ao carregar Imagens OP:", error);
      setErro(error?.message || "Não foi possível carregar as imagens das OPs.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, [mes]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return imagens;
    return imagens.filter((imagem) =>
      [imagem.codigoOp, imagem.projeto, imagem.processo, imagem.funcionario]
        .some((valor) => valor.toLocaleLowerCase("pt-BR").includes(termo)),
    );
  }, [busca, imagens]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, ImagemOP[]>();
    filtradas.forEach((imagem) => {
      const atual = mapa.get(imagem.data) || [];
      atual.push(imagem);
      mapa.set(imagem.data, atual);
    });
    return Array.from(mapa.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [filtradas]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Imagens OP</h2>
          <p className="text-sm text-muted-foreground">
            Fotos capturadas nos apontamentos do Web Controle, em modo de visualização.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void carregar()} disabled={carregando}>
          <RefreshCw className={`mr-2 h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 md:flex-row md:items-center">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMes((atual) => subMonths(atual, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-40 text-center font-semibold capitalize">
            {format(mes, "MMMM 'de' yyyy", { locale: ptBR })}
          </div>
          <Button variant="outline" size="icon" onClick={() => setMes((atual) => addMonths(atual, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar por OP, projeto, processo ou responsável..."
            className="pl-9"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {filtradas.length} imagem(ns)
        </div>
      </div>

      {erro && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {erro}
        </div>
      )}

      {carregando ? (
        <div className="flex min-h-64 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando Imagens OP...
        </div>
      ) : grupos.length === 0 ? (
        <div className="rounded-lg border border-dashed py-14 text-center text-muted-foreground">
          <ImageIcon className="mx-auto mb-3 h-10 w-10 opacity-50" />
          Nenhuma imagem encontrada para o período e filtros selecionados.
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.map(([data, fotos]) => (
            <section key={data} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  {new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </h3>
                <span className="text-xs text-muted-foreground">{fotos.length} imagem(ns)</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {fotos.map((imagem) => (
                  <Card
                    key={imagem.id}
                    className="cursor-pointer overflow-hidden transition hover:border-primary/40"
                    onClick={() => setSelecionada(imagem)}
                  >
                    <div className="aspect-video bg-muted">
                      <img
                        src={imagem.previewUrl}
                        alt={`${imagem.codigoOp} - ${imagem.processo}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <CardContent className="space-y-1 p-3">
                      <div className="font-semibold">{imagem.codigoOp}</div>
                      <div className="truncate text-sm">{imagem.projeto}</div>
                      <div className="truncate text-xs text-muted-foreground">{imagem.processo}</div>
                      <div className="truncate text-xs text-muted-foreground">{imagem.funcionario}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Dialog open={!!selecionada} onOpenChange={(aberto) => !aberto && setSelecionada(null)}>
        <DialogContent className="max-w-5xl">
          {selecionada && (
            <>
              <DialogHeader>
                <DialogTitle>{selecionada.codigoOp} · {selecionada.processo}</DialogTitle>
              </DialogHeader>
              <div className="overflow-hidden rounded-lg bg-black">
                <img
                  src={selecionada.previewUrl}
                  alt={`${selecionada.codigoOp} - ${selecionada.processo}`}
                  className="max-h-[70vh] w-full object-contain"
                />
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div><span className="text-muted-foreground">Projeto:</span> {selecionada.projeto}</div>
                <div><span className="text-muted-foreground">Responsável:</span> {selecionada.funcionario}</div>
                <div><span className="text-muted-foreground">Data:</span> {new Date(`${selecionada.data}T12:00:00`).toLocaleDateString("pt-BR")}</div>
                <div><span className="text-muted-foreground">OP:</span> {selecionada.codigoOp}</div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ImagensOPIntegrado() {
  return (
    <AppControleSessionGate moduleName="Imagens OP">
      <Inner />
    </AppControleSessionGate>
  );
}
