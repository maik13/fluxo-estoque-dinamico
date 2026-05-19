import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Package, TrendingUp, AlertTriangle, Loader2 } from 'lucide-react';
import { EstoqueItem } from '@/types/estoque';
import { verificarFerramentaAlocada } from '@/utils/verificarPendencias';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';

interface EstoqueContadoProps {
  itens: EstoqueItem[];
}

const formatarClassificacao = (item: EstoqueItem): string => {
  const partes = [];
  if (item.especificacao) partes.push(item.especificacao);
  if (item.marca) partes.push(item.marca);
  if (item.unidade) partes.push(item.unidade);
  if (item.condicao) partes.push(item.condicao);
  
  if (partes.length === 0) return 'Sem classificação definida';
  return partes.join(' • ');
};

export const EstoqueContado: React.FC<EstoqueContadoProps> = ({ itens }) => {
  const { obterEstoqueAtivoInfo } = useConfiguracoes();
  const [alocacoes, setAlocacoes] = useState<Record<string, { alocada: boolean; saldoPendente: number; localAtual?: string }>>({});
  const [carregando, setCarregando] = useState(false);
  const estoqueInfo = obterEstoqueAtivoInfo();

  useEffect(() => {
    let montado = true;
    const buscarAlocacoes = async () => {
      setCarregando(true);
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
      if (montado) {
        setCarregando(false);
      }
    };
    
    if (itens.length > 0) {
      buscarAlocacoes();
    } else if (montado) {
      setCarregando(false);
    }
    
    return () => { montado = false; };
  }, [itens, estoqueInfo]);

  const agrupadoPorNome = useMemo(() => {
    const mapa = new Map<string, EstoqueItem[]>();
    const itensOrdenados = [...itens].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    
    itensOrdenados.forEach(item => {
      const key = item.nome || 'Sem Nome';
      if (!mapa.has(key)) mapa.set(key, []);
      mapa.get(key)!.push(item);
    });
    return mapa;
  }, [itens]);

  return (
    <div className="space-y-4">
      {carregando && (
        <div className="flex items-center justify-center p-4 text-muted-foreground bg-muted/20 rounded-lg border">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          <span>Verificando itens em uso/projeto...</span>
        </div>
      )}

      <Accordion type="multiple" className="w-full space-y-4">
        {Array.from(agrupadoPorNome.entries()).map(([nome, itensDoNome]) => {
          let noAlmoxarifado = 0;
          let emUsoProjeto = 0;
          let semSaldo = 0;

          itensDoNome.forEach(item => {
            const isAlocado = alocacoes[item.id]?.alocada;
            if (isAlocado) {
              emUsoProjeto++;
            } else if (item.estoqueAtual > 0) {
              noAlmoxarifado++;
            } else {
              semSaldo++;
            }
          });

          const totalCodigosNome = itensDoNome.length;

          const agrupadoPorClassificacao = new Map<string, EstoqueItem[]>();
          itensDoNome.forEach(item => {
            const classificacao = formatarClassificacao(item);
            if (!agrupadoPorClassificacao.has(classificacao)) agrupadoPorClassificacao.set(classificacao, []);
            agrupadoPorClassificacao.get(classificacao)!.push(item);
          });
          
          const classificacoesOrdenadas = Array.from(agrupadoPorClassificacao.entries()).sort((a, b) => a[0].localeCompare(b[0]));

          return (
            <AccordionItem value={`nome-${nome}`} key={nome} className="border rounded-lg bg-card text-card-foreground shadow-sm overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-bold text-lg">{nome}</span>
                    <span className="text-sm text-muted-foreground font-normal">{totalCodigosNome} código(s) cadastrados</span>
                  </div>
                  <div className="flex gap-4 items-center">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-semibold text-success flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" /> No almoxarifado: {noAlmoxarifado}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-semibold text-warning flex items-center gap-1">
                        <Package className="w-4 h-4" /> Em uso/projeto: {emUsoProjeto}
                      </span>
                    </div>
                    {semSaldo > 0 && (
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-semibold text-destructive flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" /> Sem saldo: {semSaldo}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-0">
                <Accordion type="multiple" className="w-full space-y-2 mt-4 pl-4 border-l-2 border-muted">
                  {classificacoesOrdenadas.map(([classificacao, itensDaClassificacao]) => {
                    let noAlmoxarifadoClass = 0;
                    let emUsoProjetoClass = 0;
                    let semSaldoClass = 0;

                    itensDaClassificacao.forEach(item => {
                      const isAlocado = alocacoes[item.id]?.alocada;
                      if (isAlocado) {
                        emUsoProjetoClass++;
                      } else if (item.estoqueAtual > 0) {
                        noAlmoxarifadoClass++;
                      } else {
                        semSaldoClass++;
                      }
                    });

                    const itensOrdenadosPorCodigo = [...itensDaClassificacao].sort((a, b) => 
                      (a.codigoBarras || '').localeCompare(b.codigoBarras || '')
                    );

                    return (
                      <AccordionItem value={`class-${nome}-${classificacao}`} key={classificacao} className="border rounded-md bg-background overflow-hidden">
                        <AccordionTrigger className="px-4 py-2 hover:no-underline hover:bg-muted/50">
                          <div className="flex flex-col md:flex-row md:items-center justify-between w-full pr-4 gap-2">
                            <span className="font-semibold text-sm">{classificacao}</span>
                            <div className="flex flex-wrap gap-3 text-xs font-normal">
                              <Badge variant="secondary" className="bg-muted">Cód: {itensDaClassificacao.length}</Badge>
                              <Badge variant="outline" className="border-success text-success bg-success/10">No almoxarifado: {noAlmoxarifadoClass}</Badge>
                              {emUsoProjetoClass > 0 && (
                                <Badge variant="outline" className="border-warning text-warning bg-warning/10">Em uso/projeto: {emUsoProjetoClass}</Badge>
                              )}
                              {semSaldoClass > 0 && (
                                <Badge variant="outline" className="border-destructive text-destructive bg-destructive/10">Sem saldo: {semSaldoClass}</Badge>
                              )}
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-0 md:px-4 py-3 bg-muted/10 border-t">
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                  <TableHead className="h-8">Código</TableHead>
                                  <TableHead className="h-8">Marca</TableHead>
                                  <TableHead className="h-8">Especificação</TableHead>
                                  <TableHead className="h-8">Localização almox.</TableHead>
                                  <TableHead className="h-8">Status</TableHead>
                                  <TableHead className="h-8">Projeto/Local de uso</TableHead>
                                  <TableHead className="h-8 text-right">Saldo</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {itensOrdenadosPorCodigo.map(item => {
                                  const isAlocado = alocacoes[item.id]?.alocada;
                                  
                                  let status = '';
                                  let statusBadge = null;
                                  let saldoText = '';
                                  let projetoLocal = '-';
                                  
                                  if (isAlocado) {
                                    status = 'Em uso/projeto';
                                    statusBadge = <Badge variant="outline" className="border-warning text-warning bg-warning/10">{status}</Badge>;
                                    saldoText = `Pendente: ${alocacoes[item.id]?.saldoPendente}`;
                                    projetoLocal = alocacoes[item.id]?.localAtual || "Local não identificado";
                                  } else if (item.estoqueAtual > 0) {
                                    status = 'No almoxarifado';
                                    statusBadge = <Badge variant="outline" className="border-success text-success bg-success/10">{status}</Badge>;
                                    saldoText = item.estoqueAtual.toString();
                                  } else {
                                    status = 'Sem saldo';
                                    statusBadge = <Badge variant="outline" className="border-destructive text-destructive bg-destructive/10">{status}</Badge>;
                                    saldoText = '0';
                                  }

                                  const localizacaoAlmox = [item.localizacao, item.caixaOrganizador].filter(Boolean).join(' - ') || '-';

                                  return (
                                    <TableRow key={item.id} className="hover:bg-muted/30">
                                      <TableCell className="font-mono text-sm py-2">{item.codigoBarras}</TableCell>
                                      <TableCell className="py-2 text-sm">{item.marca || '-'}</TableCell>
                                      <TableCell className="py-2 text-sm max-w-[150px] truncate" title={item.especificacao}>{item.especificacao || '-'}</TableCell>
                                      <TableCell className="py-2 text-sm text-muted-foreground">{localizacaoAlmox}</TableCell>
                                      <TableCell className="py-2">{statusBadge}</TableCell>
                                      <TableCell className="py-2 text-sm font-medium">{projetoLocal}</TableCell>
                                      <TableCell className="py-2 text-right font-semibold">{saldoText}</TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </AccordionContent>
            </AccordionItem>
          );
        })}
        {Array.from(agrupadoPorNome.entries()).length === 0 && !carregando && (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">Nenhum item encontrado com os filtros aplicados.</p>
          </div>
        )}
      </Accordion>
    </div>
  );
};
