import { Calculator, Paintbrush } from 'lucide-react';
import type { ProducaoOrdemProducao, ProducaoPinturaTipo } from '@/types/producao';

const label: Record<ProducaoPinturaTipo, string> = {
  miolo: 'Pintura de miolo',
  casca: 'Pintura de casca',
  painel: 'Pintura de painel — somente casca',
};

const numero = (valor: number | null | undefined, casas = 4) =>
  valor == null ? '—' : valor.toLocaleString('pt-BR', { maximumFractionDigits: casas });

export const ResumoPinturaOrdem = ({ ordem }: { ordem: ProducaoOrdemProducao }) => {
  if (!ordem.pintura_tipo || ordem.pintura_consumo_total_ml == null) return null;

  return (
    <div className="mt-3 rounded-lg border border-sky-500/30 bg-sky-500/5 p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-sky-500/10 p-2"><Paintbrush className="h-4 w-4 text-sky-600" /></div>
          <div>
            <p className="text-sm font-semibold">{label[ordem.pintura_tipo]}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Preset: {ordem.pintura_preset_nome_snapshot ?? 'não identificado'} · Ripa {numero(ordem.pintura_largura_ripa_cm_snapshot, 3)} cm × {numero(ordem.pintura_comprimento_ripa_m_snapshot, 3)} m
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm font-bold text-sky-700 dark:text-sky-400">
          <Calculator className="h-4 w-4" />
          {numero(ordem.pintura_consumo_total_ml)} mL · {numero(ordem.pintura_consumo_total_ml / 1000, 6)} L
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <div className="rounded-md border bg-background/70 p-2">
          <span className="text-muted-foreground">Ripas envolvidas</span>
          <strong className="mt-1 block text-foreground">{numero(ordem.pintura_quantidade_ripas_calculada, 3)}</strong>
        </div>
        <div className="rounded-md border bg-background/70 p-2">
          <span className="text-muted-foreground">Consumo por ripa</span>
          <strong className="mt-1 block text-foreground">{numero(ordem.pintura_consumo_ml_por_ripa_snapshot)} mL</strong>
        </div>
        <div className="rounded-md border bg-background/70 p-2">
          <span className="text-muted-foreground">Consumo por {ordem.pintura_tipo === 'painel' ? 'painel' : 'ripa'}</span>
          <strong className="mt-1 block text-foreground">{numero(ordem.pintura_consumo_ml_por_unidade)} mL</strong>
        </div>
      </div>
    </div>
  );
};
