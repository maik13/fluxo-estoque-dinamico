import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

export type ProjetoMatrizPlanejamento = {
  id: string;
  chave: string;
  nome: string;
  ativoCalculo: boolean;
};

export type ItemMatrizPlanejamento = {
  id: string;
  nome: string;
  acervoCodigo: string | null;
  qtdEstoqueAtual: number;
  demandas: Record<string, number>;
};

type Props = {
  projetos: ProjetoMatrizPlanejamento[];
  itens: ItemMatrizPlanejamento[];
  podeConfigurar: boolean;
  salvandoId: string | null;
  onAlternarProjeto: (projeto: ProjetoMatrizPlanejamento, ativo: boolean) => void;
  onSalvarQuantidade: (item: ItemMatrizPlanejamento, projetoId: string, valor: string) => void;
};

const numero = (valor: unknown) => Number(valor || 0);

export const PlanejamentoMatriz = ({
  projetos,
  itens,
  podeConfigurar,
  salvandoId,
  onAlternarProjeto,
  onSalvarQuantidade,
}: Props) => {
  const cidadesComDemanda = useMemo(() => {
    const resultado = new Set<string>();
    projetos.forEach((projeto) => {
      if (itens.some((item) => numero(item.demandas?.[projeto.chave]) > 0)) {
        resultado.add(projeto.id);
      }
    });
    return resultado;
  }, [itens, projetos]);

  return (
    <Card className="overflow-hidden">
      <div className="border-b bg-muted/20 px-4 py-3">
        <p className="font-medium">Visão Matriz</p>
        <p className="text-xs text-muted-foreground">
          Edite as quantidades diretamente nas células. Cidades confirmadas entram no Total Confirmado; cidades não confirmadas continuam visíveis como cenário potencial.
        </p>
      </div>

      <div className="overflow-auto">
        <table className="w-full min-w-[1450px] text-sm">
          <thead className="sticky top-0 z-10 bg-background">
            <tr className="border-b bg-muted/50">
              <th className="sticky left-0 z-20 min-w-[280px] bg-muted/50 p-3 text-left">Peça</th>
              {projetos.map((projeto) => {
                const potencial = !projeto.ativoCalculo && cidadesComDemanda.has(projeto.id);
                return (
                  <th key={projeto.id} className="min-w-[145px] p-3 text-center align-top">
                    <div className="flex flex-col items-center gap-2">
                      <span className="font-medium">{projeto.nome}</span>
                      <label className="flex items-center gap-2 text-xs font-normal">
                        <Checkbox
                          checked={projeto.ativoCalculo}
                          disabled={!podeConfigurar || salvandoId === projeto.id}
                          onCheckedChange={(checked) => onAlternarProjeto(projeto, checked === true)}
                        />
                        Confirmada
                      </label>
                      {projeto.ativoCalculo ? (
                        <Badge variant="default">Confirmada</Badge>
                      ) : potencial ? (
                        <Badge variant="secondary">Potencial</Badge>
                      ) : (
                        <Badge variant="outline">Fora</Badge>
                      )}
                    </div>
                  </th>
                );
              })}
              <th className="min-w-[120px] p-3 text-right">Total Confirmado</th>
              <th className="min-w-[120px] p-3 text-right">Total Potencial</th>
              <th className="min-w-[95px] p-3 text-right">Estoque</th>
              <th className="min-w-[105px] p-3 text-right">Saldo Ativo</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => {
              const totalConfirmado = projetos
                .filter((projeto) => projeto.ativoCalculo)
                .reduce((soma, projeto) => soma + numero(item.demandas?.[projeto.chave]), 0);

              const totalPotencial = projetos
                .reduce((soma, projeto) => soma + numero(item.demandas?.[projeto.chave]), 0);

              const estoque = numero(item.qtdEstoqueAtual);
              const saldoAtivo = estoque - totalConfirmado;

              return (
                <tr key={item.id} className="border-b hover:bg-muted/20">
                  <td className="sticky left-0 z-[5] bg-background p-3">
                    <p className="font-medium">{item.nome}</p>
                    {item.acervoCodigo && (
                      <p className="mt-1 text-xs text-muted-foreground">{item.acervoCodigo}</p>
                    )}
                  </td>

                  {projetos.map((projeto) => {
                    const valor = numero(item.demandas?.[projeto.chave]);
                    const saveKey = `matriz-${item.id}-${projeto.id}`;
                    return (
                      <td key={projeto.id} className="p-2">
                        <Input
                          key={`${item.id}-${projeto.id}-${valor}`}
                          defaultValue={valor}
                          inputMode="decimal"
                          disabled={!podeConfigurar || salvandoId === saveKey}
                          onBlur={(event) => onSalvarQuantidade(item, projeto.id, event.target.value)}
                          className="mx-auto h-9 w-20 text-center"
                        />
                      </td>
                    );
                  })}

                  <td className="p-3 text-right font-semibold">{totalConfirmado}</td>
                  <td className="p-3 text-right text-muted-foreground">{totalPotencial}</td>
                  <td className="p-3 text-right">{estoque}</td>
                  <td className={`p-3 text-right font-bold ${saldoAtivo < 0 ? 'text-destructive' : ''}`}>
                    {saldoAtivo}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
