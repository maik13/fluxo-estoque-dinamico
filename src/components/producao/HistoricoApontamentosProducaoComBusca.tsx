import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  formatarNumeroOrdemProducao,
  useOrdensProducao,
} from '@/hooks/useOrdensProducao';
import { HistoricoApontamentosProducaoV2 } from './HistoricoApontamentosProducaoV2';

type Props = ComponentProps<typeof HistoricoApontamentosProducaoV2>;

export const HistoricoApontamentosProducaoComBusca = (props: Props) => {
  const [buscaOp, setBuscaOp] = useState('');
  const { ordens, listarOrdens } = useOrdensProducao();

  useEffect(() => {
    void listarOrdens().catch(() => undefined);
  }, [listarOrdens]);

  const numeroOpBuscado = useMemo(() => {
    const digitos = buscaOp.replace(/\D/g, '');
    if (!digitos) return null;
    const numero = Number(digitos);
    return Number.isFinite(numero) ? numero : null;
  }, [buscaOp]);

  const ordemEncontrada = useMemo(() => {
    if (numeroOpBuscado == null) return null;
    return ordens.find((ordem) => Number(ordem.numero) === numeroOpBuscado) ?? null;
  }, [numeroOpBuscado, ordens]);

  const apontamentosFiltrados = useMemo(() => {
    if (numeroOpBuscado == null) return props.apontamentos;
    if (!ordemEncontrada) return [];
    return props.apontamentos.filter(
      (apontamento) => apontamento.ordem_producao_id === ordemEncontrada.id,
    );
  }, [numeroOpBuscado, ordemEncontrada, props.apontamentos]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/10 p-4">
        <div className="max-w-md space-y-1.5">
          <Label htmlFor="buscar-op-numero">Pesquisar OP pelo número</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="buscar-op-numero"
              inputMode="numeric"
              value={buscaOp}
              onChange={(event) => setBuscaOp(event.target.value)}
              placeholder="Ex.: 57, 000057 ou OP 000057"
              className="pl-9"
            />
          </div>
          {numeroOpBuscado != null && (
            <p className="text-xs text-muted-foreground">
              {ordemEncontrada
                ? `Filtrando ${formatarNumeroOrdemProducao(ordemEncontrada.numero)}.`
                : `Nenhuma OP ${String(numeroOpBuscado).padStart(6, '0')} encontrada.`}
            </p>
          )}
        </div>
      </div>

      <HistoricoApontamentosProducaoV2
        {...props}
        apontamentos={apontamentosFiltrados}
      />
    </div>
  );
};
