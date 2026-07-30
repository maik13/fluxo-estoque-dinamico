import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Calculator, ClipboardList, Loader2, Paintbrush, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePresetsPintura } from '@/hooks/usePresetsPintura';
import type {
  NovaOrdemProducao,
  ProducaoLocalTipo,
  ProducaoOrdemProducao,
  ProducaoPinturaTipo,
  ProducaoPrioridade,
  ProducaoProcesso,
} from '@/types/producao';

interface Props {
  processo: ProducaoProcesso;
  ordens: ProducaoOrdemProducao[];
  onEmitir: (dados: NovaOrdemProducao) => Promise<unknown>;
}

const numero = (value: string) => Number(value.replace(',', '.'));
const formatar = (value: number, casas = 4) => value.toLocaleString('pt-BR', { maximumFractionDigits: casas });

const normalizarNome = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/\s+/g, ' ')
  .trim();

const detectarTipoPintura = (nome: string): ProducaoPinturaTipo | null => {
  const valor = normalizarNome(nome);
  if (/pintura (de )?miolo/.test(valor)) return 'miolo';
  if (/pintura (de )?casca/.test(valor)) return 'casca';
  if (/pintura (de )?paine(l|is)/.test(valor)) return 'painel';
  return null;
};

const pinturaLabel: Record<ProducaoPinturaTipo, string> = {
  miolo: 'Pintura de miolo — ripas isoladas',
  casca: 'Pintura de casca — ripas isoladas',
  painel: 'Pintura de painel — somente casca',
};

export const FormOrdemProducao = ({ processo, ordens, onEmitir }: Props) => {
  const [aberto, setAberto] = useState(false);
  const [quantidade, setQuantidade] = useState('');
  const [inicio, setInicio] = useState(processo.data_inicio_prevista ?? processo.data_inicio_desejada ?? '');
  const [fim, setFim] = useState(processo.data_fim_prevista ?? processo.data_limite ?? '');
  const [localTipo, setLocalTipo] = useState<ProducaoLocalTipo>('Fábrica');
  const [responsavel, setResponsavel] = useState(processo.responsavel_nome_snapshot ?? '');
  const [equipe, setEquipe] = useState(processo.pessoas_necessarias == null ? '' : String(processo.pessoas_necessarias));
  const [prioridade, setPrioridade] = useState<ProducaoPrioridade>(processo.prioridade);
  const [descricao, setDescricao] = useState('');
  const [instrucoes, setInstrucoes] = useState('');
  const [pinturaTipo, setPinturaTipo] = useState<ProducaoPinturaTipo | 'nenhuma'>('nenhuma');
  const [pinturaPresetId, setPinturaPresetId] = useState('');
  const [salvando, setSalvando] = useState(false);
  const { presets, loading: carregandoPresets, listarPresets } = usePresetsPintura();

  const quantidadeJaEmitida = useMemo(() => ordens
    .filter((ordem) => ordem.processo_id === processo.id && ordem.status !== 'cancelada')
    .reduce((soma, ordem) => soma + Number(ordem.quantidade_planejada || 0), 0), [ordens, processo.id]);

  const saldo = processo.quantidade_planejada == null
    ? null
    : Math.max(Number(processo.quantidade_planejada) - quantidadeJaEmitida, 0);

  const presetSelecionado = useMemo(
    () => presets.find((preset) => preset.id === pinturaPresetId) ?? null,
    [pinturaPresetId, presets],
  );

  const calculoPintura = useMemo(() => {
    if (pinturaTipo === 'nenhuma' || !presetSelecionado) return null;
    const qtd = numero(quantidade);
    if (!Number.isFinite(qtd) || qtd <= 0) return null;

    const consumoPorRipa = pinturaTipo === 'miolo'
      ? presetSelecionado.consumo_miolo_ml_por_ripa
      : presetSelecionado.consumo_casca_ml_por_ripa;
    const quantidadeRipas = pinturaTipo === 'painel'
      ? qtd * presetSelecionado.ripas_por_painel
      : qtd;
    const consumoPorUnidade = pinturaTipo === 'painel'
      ? presetSelecionado.ripas_por_painel * consumoPorRipa
      : consumoPorRipa;
    const totalMl = quantidadeRipas * consumoPorRipa;

    return {
      quantidadeRipas,
      consumoPorRipa,
      consumoPorUnidade,
      totalMl,
      totalLitros: totalMl / 1000,
    };
  }, [pinturaTipo, presetSelecionado, quantidade]);

  useEffect(() => {
    if (!aberto) return;
    void listarPresets(true).catch((error) => {
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar os presets de pintura.');
    });
  }, [aberto, listarPresets]);

  useEffect(() => {
    if (!aberto || pinturaTipo === 'nenhuma' || pinturaPresetId || presets.length === 0) return;
    setPinturaPresetId(presets[0].id);
  }, [aberto, pinturaPresetId, pinturaTipo, presets]);

  const abrir = (open: boolean) => {
    setAberto(open);
    if (!open) return;
    setQuantidade(saldo && saldo > 0 ? String(saldo).replace('.', ',') : '');
    setInicio(processo.data_inicio_prevista ?? processo.data_inicio_desejada ?? '');
    setFim(processo.data_fim_prevista ?? processo.data_limite ?? '');
    const detectado = detectarTipoPintura(processo.nome);
    setPinturaTipo(detectado ?? 'nenhuma');
    setPinturaPresetId('');
  };

  const emitir = async (event: FormEvent) => {
    event.preventDefault();
    const quantidadeNormalizada = numero(quantidade);
    const equipeNormalizada = equipe.trim() ? Number(equipe) : null;

    if (!Number.isFinite(quantidadeNormalizada) || quantidadeNormalizada <= 0) {
      toast.error('Informe uma quantidade maior que zero.');
      return;
    }
    if (saldo !== null && quantidadeNormalizada > saldo) {
      toast.error(`A quantidade ultrapassa o saldo da etapa (${saldo}).`);
      return;
    }
    if (!inicio || !fim || fim < inicio) {
      toast.error('Informe um período planejado válido.');
      return;
    }
    if (equipeNormalizada !== null && (!Number.isInteger(equipeNormalizada) || equipeNormalizada < 0)) {
      toast.error('Informe uma quantidade válida de pessoas.');
      return;
    }
    if (pinturaTipo !== 'nenhuma' && !presetSelecionado) {
      toast.error('Selecione o preset técnico para calcular o consumo de tinta.');
      return;
    }
    if (pinturaTipo !== 'nenhuma' && !calculoPintura) {
      toast.error('Não foi possível calcular o consumo previsto de tinta.');
      return;
    }

    setSalvando(true);
    try {
      await onEmitir({
        processo_id: processo.id,
        quantidade_planejada: quantidadeNormalizada,
        data_inicio_prevista: inicio,
        data_fim_prevista: fim,
        local_tipo: localTipo,
        responsavel_nome: responsavel.trim() || null,
        equipe_prevista: equipeNormalizada,
        descricao: descricao.trim() || null,
        instrucoes: instrucoes.trim() || null,
        prioridade,
        pintura_tipo: pinturaTipo === 'nenhuma' ? null : pinturaTipo,
        pintura_preset_id: pinturaTipo === 'nenhuma' ? null : pinturaPresetId,
      });
      toast.success(
        pinturaTipo === 'nenhuma'
          ? 'Ordem de Produção emitida e liberada para execução.'
          : `OP emitida com consumo previsto de ${formatar(calculoPintura!.totalMl)} mL de tinta.`,
      );
      setAberto(false);
      setDescricao('');
      setInstrucoes('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível emitir a OP.');
    } finally {
      setSalvando(false);
    }
  };

  const unidadeQuantidade = pinturaTipo === 'painel'
    ? 'painéis'
    : pinturaTipo === 'miolo' || pinturaTipo === 'casca'
      ? 'ripas'
      : processo.unidade_medida ?? 'unidades';

  return (
    <Dialog open={aberto} onOpenChange={abrir}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={saldo === 0}>
          <ClipboardList className="mr-2 h-4 w-4" />Emitir OP
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Emitir Ordem de Produção</DialogTitle>
          <DialogDescription>
            A OP será criada dentro da etapa {processo.codigo} · {processo.nome}. Os apontamentos serão registrados dentro dela.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={emitir} className="space-y-5">
          <div className="rounded-lg border bg-muted/20 p-4 text-sm">
            <p><strong>Projeto:</strong> {processo.projeto?.nome ?? '—'}</p>
            <p><strong>Etapa:</strong> {processo.codigo} · {processo.nome}</p>
            <p><strong>Planejado na etapa:</strong> {processo.quantidade_planejada ?? 'não informado'} {processo.unidade_medida ?? ''}</p>
            <p><strong>Já emitido em OPs:</strong> {quantidadeJaEmitida} {processo.unidade_medida ?? ''}</p>
            <p><strong>Saldo disponível:</strong> {saldo ?? 'sem limite definido'} {processo.unidade_medida ?? ''}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Quantidade da OP ({unidadeQuantidade}) *</Label>
              <Input value={quantidade} onChange={(event) => setQuantidade(event.target.value)} inputMode="decimal" required />
            </div>
            <div className="space-y-2">
              <Label>Local operacional *</Label>
              <Select value={localTipo} onValueChange={(value) => setLocalTipo(value as ProducaoLocalTipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Fábrica">Fábrica</SelectItem><SelectItem value="Execução">Execução</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Início planejado *</Label><Input type="date" value={inicio} onChange={(event) => setInicio(event.target.value)} required /></div>
            <div className="space-y-2"><Label>Prazo da OP *</Label><Input type="date" value={fim} onChange={(event) => setFim(event.target.value)} required /></div>
            <div className="space-y-2"><Label>Responsável</Label><Input value={responsavel} onChange={(event) => setResponsavel(event.target.value)} /></div>
            <div className="space-y-2"><Label>Equipe prevista (quantidade)</Label><Input type="number" min="0" step="1" value={equipe} onChange={(event) => setEquipe(event.target.value)} /></div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={(value) => setPrioridade(value as ProducaoPrioridade)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem><SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem><SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-sky-500/10 p-2"><Paintbrush className="h-5 w-5 text-sky-600" /></div>
              <div>
                <p className="font-semibold">Cálculo automático de pintura</p>
                <p className="text-xs text-muted-foreground">
                  Selecione a operação e o preset. O volume não é digitado manualmente; o sistema calcula e congela o valor na OP.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Operação de pintura</Label>
                <Select value={pinturaTipo} onValueChange={(value) => {
                  setPinturaTipo(value as ProducaoPinturaTipo | 'nenhuma');
                  if (value === 'nenhuma') setPinturaPresetId('');
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhuma">Não é uma OP de pintura</SelectItem>
                    <SelectItem value="miolo">Pintura de miolo — ripas isoladas</SelectItem>
                    <SelectItem value="casca">Pintura de casca — ripas isoladas</SelectItem>
                    <SelectItem value="painel">Pintura de painel — somente casca</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Preset técnico</Label>
                <Select
                  value={pinturaPresetId}
                  onValueChange={setPinturaPresetId}
                  disabled={pinturaTipo === 'nenhuma' || carregandoPresets}
                >
                  <SelectTrigger><SelectValue placeholder={carregandoPresets ? 'Carregando...' : 'Selecione o preset'} /></SelectTrigger>
                  <SelectContent>
                    {presets.map((preset) => <SelectItem key={preset.id} value={preset.id}>{preset.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {pinturaTipo !== 'nenhuma' && presetSelecionado && calculoPintura && (
              <div className="space-y-3 rounded-lg border bg-background/70 p-4">
                <div className="flex items-center gap-2 font-semibold"><Calculator className="h-4 w-4 text-sky-600" />{pinturaLabel[pinturaTipo]}</div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div><p className="text-xs text-muted-foreground">Referência da ripa</p><p className="font-bold">{formatar(presetSelecionado.largura_ripa_cm, 3)} cm × {formatar(presetSelecionado.comprimento_ripa_m, 3)} m</p></div>
                  <div><p className="text-xs text-muted-foreground">Ripas calculadas</p><p className="font-bold">{formatar(calculoPintura.quantidadeRipas, 3)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Consumo por {pinturaTipo === 'painel' ? 'painel' : 'ripa'}</p><p className="font-bold">{formatar(calculoPintura.consumoPorUnidade)} mL</p></div>
                  <div><p className="text-xs text-muted-foreground">Tinta prevista total</p><p className="font-bold text-sky-700 dark:text-sky-400">{formatar(calculoPintura.totalMl)} mL · {formatar(calculoPintura.totalLitros, 6)} L</p></div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {pinturaTipo === 'painel'
                    ? `${formatar(numero(quantidade), 3)} painel(is) × ${formatar(presetSelecionado.ripas_por_painel, 3)} ripas × ${formatar(calculoPintura.consumoPorRipa)} mL de casca por ripa.`
                    : `${formatar(numero(quantidade), 3)} ripa(s) × ${formatar(calculoPintura.consumoPorRipa)} mL por ripa.`}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2"><Label>Descrição do lote</Label><Input value={descricao} onChange={(event) => setDescricao(event.target.value)} placeholder="Ex.: pintura de 300 ripas do primeiro lote" /></div>
          <div className="space-y-2"><Label>Instruções para execução</Label><Textarea value={instrucoes} onChange={(event) => setInstrucoes(event.target.value)} placeholder="Cor, demãos, preparação, acabamento e demais orientações." rows={4} /></div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)} disabled={salvando}>Cancelar</Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Emitir e liberar OP
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
