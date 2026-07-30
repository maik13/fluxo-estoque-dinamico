import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Calculator, Loader2, Paintbrush, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePresetsPintura } from '@/hooks/usePresetsPintura';
import type { ProducaoPresetPintura } from '@/types/producao';

const numero = (valor: string) => Number(valor.replace(',', '.'));
const exibir = (valor: number, casas = 4) => valor.toLocaleString('pt-BR', { maximumFractionDigits: casas });

const valoresIniciais = {
  nome: 'Ripa 40 x 2.000 mm — padrão',
  comprimento: '2',
  largura: '4',
  ripasPainel: '25',
  miolo: '6,7',
  casca: '4,316',
  ativo: true,
};

export const PresetsPinturaProducao = () => {
  const { presets, loading, listarPresets, salvarPreset } = usePresetsPintura();
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<ProducaoPresetPintura | null>(null);
  const [nome, setNome] = useState(valoresIniciais.nome);
  const [comprimento, setComprimento] = useState(valoresIniciais.comprimento);
  const [largura, setLargura] = useState(valoresIniciais.largura);
  const [ripasPainel, setRipasPainel] = useState(valoresIniciais.ripasPainel);
  const [miolo, setMiolo] = useState(valoresIniciais.miolo);
  const [casca, setCasca] = useState(valoresIniciais.casca);
  const [ativo, setAtivo] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    void listarPresets(false).catch((error) => {
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar os presets de pintura.');
    });
  }, [listarPresets]);

  const consumoPainel = useMemo(() => {
    const ripas = numero(ripasPainel);
    const consumoCasca = numero(casca);
    return Number.isFinite(ripas) && Number.isFinite(consumoCasca) ? ripas * consumoCasca : 0;
  }, [casca, ripasPainel]);

  const abrirNovo = () => {
    setEditando(null);
    setNome(valoresIniciais.nome);
    setComprimento(valoresIniciais.comprimento);
    setLargura(valoresIniciais.largura);
    setRipasPainel(valoresIniciais.ripasPainel);
    setMiolo(valoresIniciais.miolo);
    setCasca(valoresIniciais.casca);
    setAtivo(true);
    setAberto(true);
  };

  const abrirEdicao = (preset: ProducaoPresetPintura) => {
    setEditando(preset);
    setNome(preset.nome);
    setComprimento(String(preset.comprimento_ripa_m).replace('.', ','));
    setLargura(String(preset.largura_ripa_cm).replace('.', ','));
    setRipasPainel(String(preset.ripas_por_painel).replace('.', ','));
    setMiolo(String(preset.consumo_miolo_ml_por_ripa).replace('.', ','));
    setCasca(String(preset.consumo_casca_ml_por_ripa).replace('.', ','));
    setAtivo(preset.ativo);
    setAberto(true);
  };

  const salvar = async (event: FormEvent) => {
    event.preventDefault();
    const dados = {
      id: editando?.id ?? null,
      nome: nome.trim(),
      comprimento_ripa_m: numero(comprimento),
      largura_ripa_cm: numero(largura),
      ripas_por_painel: numero(ripasPainel),
      consumo_miolo_ml_por_ripa: numero(miolo),
      consumo_casca_ml_por_ripa: numero(casca),
      ativo,
    };

    if (!dados.nome || [
      dados.comprimento_ripa_m,
      dados.largura_ripa_cm,
      dados.ripas_por_painel,
      dados.consumo_miolo_ml_por_ripa,
      dados.consumo_casca_ml_por_ripa,
    ].some((valor) => !Number.isFinite(valor) || valor <= 0)) {
      toast.error('Preencha todos os parâmetros técnicos com valores maiores que zero.');
      return;
    }

    setSalvando(true);
    try {
      await salvarPreset(dados);
      setAberto(false);
      toast.success('Preset de pintura salvo. Novas OPs usarão esses parâmetros como snapshot.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o preset.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card className="xl:col-span-2">
      <CardHeader>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2"><Paintbrush className="h-5 w-5 text-primary" /></div>
            <div>
              <CardTitle>Presets técnicos de pintura</CardTitle>
              <CardDescription>
                Parâmetros independentes do painel. A OP calcula ripas e consumo de tinta automaticamente.
              </CardDescription>
            </div>
          </div>
          <Button type="button" onClick={abrirNovo}><Plus className="mr-2 h-4 w-4" />Novo preset</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
          <div className="flex items-start gap-3">
            <Calculator className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">Cálculo automático — sem volume manual na OP</p>
              <p className="mt-1 text-muted-foreground">
                Miolo e casca usam mL por ripa. Pintura de painel usa somente a casca: quantidade de painéis × ripas por painel × mL de casca por ripa.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando presets...
          </div>
        ) : presets.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum preset cadastrado.</div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {presets.map((preset) => {
              const porPainel = preset.ripas_por_painel * preset.consumo_casca_ml_por_ripa;
              return (
                <div key={preset.id} className="rounded-lg border bg-muted/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{preset.nome}</p>
                        <Badge variant={preset.ativo ? 'secondary' : 'outline'}>{preset.ativo ? 'Ativo' : 'Inativo'}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Ripa {exibir(preset.largura_ripa_cm, 3)} cm × {exibir(preset.comprimento_ripa_m, 3)} m · {exibir(preset.ripas_por_painel, 3)} ripas/painel
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => abrirEdicao(preset)}>
                      <Pencil className="mr-2 h-4 w-4" />Editar
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-md border bg-background/70 p-3"><p className="text-xs text-muted-foreground">Miolo por ripa</p><p className="font-bold">{exibir(preset.consumo_miolo_ml_por_ripa)} mL</p></div>
                    <div className="rounded-md border bg-background/70 p-3"><p className="text-xs text-muted-foreground">Casca por ripa</p><p className="font-bold">{exibir(preset.consumo_casca_ml_por_ripa)} mL</p></div>
                    <div className="rounded-md border bg-background/70 p-3"><p className="text-xs text-muted-foreground">Casca por painel</p><p className="font-bold">{exibir(porPainel)} mL</p></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={aberto} onOpenChange={(open) => !salvando && setAberto(open)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar preset de pintura' : 'Novo preset de pintura'}</DialogTitle>
            <DialogDescription>
              Defina a referência técnica. Esses números serão congelados nas novas Ordens de Produção.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-5">
            <div className="space-y-2"><Label>Nome do preset *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} required /></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2"><Label>Comprimento da ripa (m) *</Label><Input inputMode="decimal" value={comprimento} onChange={(e) => setComprimento(e.target.value)} /></div>
              <div className="space-y-2"><Label>Largura da ripa (cm) *</Label><Input inputMode="decimal" value={largura} onChange={(e) => setLargura(e.target.value)} /></div>
              <div className="space-y-2"><Label>Ripas por painel *</Label><Input inputMode="decimal" value={ripasPainel} onChange={(e) => setRipasPainel(e.target.value)} /></div>
              <div className="space-y-2"><Label>Miolo — mL por ripa *</Label><Input inputMode="decimal" value={miolo} onChange={(e) => setMiolo(e.target.value)} /></div>
              <div className="space-y-2"><Label>Casca — mL por ripa *</Label><Input inputMode="decimal" value={casca} onChange={(e) => setCasca(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Consumo calculado por painel</Label>
                <div className="flex h-10 items-center rounded-lg border bg-muted/20 px-3 font-semibold">{exibir(consumoPainel)} mL</div>
              </div>
            </div>
            <label className="flex items-center gap-3 rounded-lg border p-3 text-sm">
              <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-4 w-4" />
              Preset ativo para novas Ordens de Produção
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAberto(false)} disabled={salvando}>Cancelar</Button>
              <Button type="submit" disabled={salvando}>
                {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Paintbrush className="mr-2 h-4 w-4" />}
                Salvar preset
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
