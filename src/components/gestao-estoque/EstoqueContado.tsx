import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Package, TrendingUp, AlertTriangle } from 'lucide-react';
import { EstoqueItem } from '@/types/estoque';
import { verificarFerramentaAlocada } from '@/utils/verificarPendencias';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';

interface EstoqueContadoProps {
  itens: EstoqueItem[];
}

export const EstoqueContado: React.FC<EstoqueContadoProps> = ({ itens }) => {
  const { obterEstoqueAtivoInfo } = useConfiguracoes();
  const [alocacoes, setAlocacoes] = useState<Record<string, { alocada: boolean; saldoPendente: number; localAtual?: string }>>({});
  const estoqueInfo = obterEstoqueAtivoInfo();

  useEffect(() => {
    let montado = true;
    const buscarAlocacoes = async () => {
      const novosDados: Record<string, { alocada: boolean; saldoPendente: number; localAtual?: string }> = {};
      for (const item of itens) {
        if (!alocacoes[item.id]) {
          const res = await verificarFerramentaAlocada(item.id, estoqueInfo?.id);
          novosDados[item.id] = res;
        }
      }
      if (montado && Object.keys(novosDados).length > 0) {
        setAlocacoes(prev => ({ ...prev, ...novosDados }));
      }
    };
    
    if (itens.length > 0) {
      buscarAlocacoes();
    }
    
    return () => { montado = false; };
  }, [itens, estoqueInfo]);

  const agrupadoPorNome = useMemo(() => {
    const mapa = new Map<string, EstoqueItem[]>();
    itens.forEach(item => {
      const key = item.nome || 'Sem Nome';
      if (!mapa.has(key)) mapa.set(key, []);
      mapa.get(key)!.push(item);
    });
    return mapa;
  }, [itens]);

  return (
    <div className="space-y-4">
      <Accordion type="multiple" className="w-full space-y-4">
        {Array.from(agrupadoPorNome.entries()).map(([nome, itensDoNome]) => {
          const totalCodigosNome = itensDoNome.length;
          const saldoDisponivelNome = itensDoNome.reduce((acc, item) => acc + item.estoqueAtual, 0);
          const itensAlocadosNome = itensDoNome.filter(item => alocacoes[item.id]?.alocada).length;
          const itensSemEstoqueNome = itensDoNome.filter(item => item.estoqueAtual === 0 && !alocacoes[item.id]?.alocada).length;

          const agrupadoPorClassificacao = new Map<string, EstoqueItem[]>();
          itensDoNome.forEach(item => {
            const classificacao = `${item.especificacao || '-'} | ${item.marca || '-'} | ${item.unidade || '-'} | ${item.condicao || '-'}`;
            if (!agrupadoPorClassificacao.has(classificacao)) agrupadoPorClassificacao.set(classificacao, []);
            agrupadoPorClassificacao.get(classificacao)!.push(item);
          });

          return (
            <AccordionItem value={`nome-${nome}`} key={nome} className="border rounded-lg bg-card text-card-foreground shadow-sm overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-bold text-lg">{nome}</span>
                    <span className="text-sm text-muted-foreground font-normal">{totalCodigosNome} código(s)</span>
                  </div>
                  <div className="flex gap-4 items-center">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-semibold text-success flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" /> Físico: {saldoDisponivelNome}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-semibold text-warning flex items-center gap-1">
                        <Package className="w-4 h-4" /> Aloc/Pend: {itensAlocadosNome}
                      </span>
                    </div>
                    {itensSemEstoqueNome > 0 && (
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-semibold text-destructive flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" /> Sem Est.: {itensSemEstoqueNome}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-0">
                <Accordion type="multiple" className="w-full space-y-2 mt-4 pl-4 border-l-2 border-muted">
                  {Array.from(agrupadoPorClassificacao.entries()).map(([classificacao, itensDaClassificacao]) => {
                    const saldoDisponivelClass = itensDaClassificacao.reduce((acc, item) => acc + item.estoqueAtual, 0);
                    const itensAlocadosClass = itensDaClassificacao.filter(item => alocacoes[item.id]?.alocada).length;

                    return (
                      <AccordionItem value={`class-${nome}-${classificacao}`} key={classificacao} className="border rounded-md bg-background overflow-hidden">
                        <AccordionTrigger className="px-4 py-2 hover:no-underline hover:bg-muted/50">
                          <div className="flex items-center justify-between w-full pr-4">
                            <span className="font-semibold text-sm">{classificacao}</span>
                            <div className="flex gap-3 text-xs font-normal">
                              <Badge variant="outline" className="border-success text-success bg-success/10">Disp: {saldoDisponivelClass}</Badge>
                              {itensAlocadosClass > 0 && (
                                <Badge variant="outline" className="border-warning text-warning bg-warning/10">Aloc: {itensAlocadosClass}</Badge>
                              )}
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 py-3 bg-muted/10 border-t">
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent">
                                <TableHead className="h-8">Cód. Barras</TableHead>
                                <TableHead className="h-8">Saldo Físico</TableHead>
                                <TableHead className="h-8">Status / Local</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {itensDaClassificacao.map(item => (
                                <TableRow key={item.id} className="hover:bg-muted/30">
                                  <TableCell className="font-mono text-sm py-2">{item.codigoBarras}</TableCell>
                                  <TableCell className="py-2">
                                    {item.estoqueAtual > 0 ? (
                                      <Badge variant="outline" className="border-success text-success bg-success/10">{item.estoqueAtual}</Badge>
                                    ) : (
                                      <Badge variant="outline" className="border-destructive text-destructive bg-destructive/10">0</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="py-2">
                                    {alocacoes[item.id]?.alocada ? (
                                      <div className="flex flex-col gap-1 items-start">
                                        <Badge variant="outline" className="border-warning text-warning bg-warning/10 text-[10px] h-5 px-1.5">
                                          Pendente: {alocacoes[item.id]?.saldoPendente}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground font-medium flex items-center">
                                          {alocacoes[item.id]?.localAtual || 'Local desconhecido'}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-muted-foreground flex items-center h-full">Disp. Almoxarifado</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </AccordionContent>
            </AccordionItem>
          );
        })}
        {Array.from(agrupadoPorNome.entries()).length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">Nenhum item encontrado com os filtros aplicados.</p>
          </div>
        )}
      </Accordion>
    </div>
  );
};
