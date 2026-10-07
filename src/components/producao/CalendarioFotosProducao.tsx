import type { FiltrosProducaoGerencial } from '@/types/producao';
import { ImagensOPIntegrado } from '@/components/integracoes/ImagensOPIntegrado';

interface CalendarioFotosProducaoProps {
  filtros: FiltrosProducaoGerencial;
}

export const CalendarioFotosProducao = (_props: CalendarioFotosProducaoProps) => {
  return <ImagensOPIntegrado />;
};
