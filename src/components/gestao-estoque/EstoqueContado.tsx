import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Package, TrendingUp, AlertTriangle, Loader2 } from 'lucide-react';
import { GrupoItemEstoqueContado } from '@/hooks/useEstoqueContado';

interface EstoqueContadoProps {
  grupos: GrupoItemEstoqueContado[];
  carregando: boolean;
}

export const EstoqueContado = ({ grupos, carregando }: EstoqueContadoProps) => {

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-muted/20 p-3 rounded-lg border gap-4">
        <div className="flex items-center gap-2">
          {carregando ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Verificando itens em uso/projeto...</span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground font-medium">Itens verificados e prontos.</span>
          )}
        </div>
      </div>

      <Accordion type="multiple" className="w-full space-y-4">
        {grupos.map((grupo) => {
          return (
            <AccordionItem value={`nome-${grupo.nome}`} key={grupo.nome} className="border rounded-lg bg-card text-card-foreground shadow-sm overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-bold text-lg">{grupo.nome}</span>
                    <span className="text-sm text-muted-foreground font-normal">{grupo.totais.codigosCadastrados} código(s) cadastrados</span>
                  </div>
                  <div className="flex gap-4 items-center">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-semibold text-success flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" /> No almoxarifado: {grupo.totais.noAlmoxarifado}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-semibold text-warning flex items-center gap-1">
                        <Package className="w-4 h-4" /> Em uso/projeto: {grupo.totais.emUsoProjeto}
                      </span>
                    </div>
                    {grupo.totais.semSaldo > 0 && (
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-semibold text-destructive flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" /> Sem saldo: {grupo.totais.semSaldo}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-0">
                <Accordion type="multiple" className="w-full space-y-2 mt-4 pl-4 border-l-2 border-muted">
                  {grupo.classificacoes.map((classificacao) => {
                    return (
                      <AccordionItem value={`class-${grupo.nome}-${classificacao.classificacao}`} key={classificacao.classificacao} className="border rounded-md bg-background overflow-hidden">
                        <AccordionTrigger className="px-4 py-2 hover:no-underline hover:bg-muted/50">
                          <div className="flex flex-col md:flex-row md:items-center justify-between w-full pr-4 gap-2">
                            <span className="font-semibold text-sm">{classificacao.classificacao}</span>
                            <div className="flex flex-wrap gap-3 text-xs font-normal">
                              <Badge variant="secondary" className="bg-muted">Cód: {classificacao.totais.codigosCadastrados}</Badge>
                              <Badge variant="outline" className="border-success text-success bg-success/10">No almoxarifado: {classificacao.totais.noAlmoxarifado}</Badge>
                              {classificacao.totais.emUsoProjeto > 0 && (
                                <Badge variant="outline" className="border-warning text-warning bg-warning/10">Em uso/projeto: {classificacao.totais.emUsoProjeto}</Badge>
                              )}
                              {classificacao.totais.semSaldo > 0 && (
                                <Badge variant="outline" className="border-destructive text-destructive bg-destructive/10">Sem saldo: {classificacao.totais.semSaldo}</Badge>
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
                                {classificacao.linhas.map((linha) => {
                                  const statusBadge = linha.status === 'Em uso/projeto'
                                    ? <Badge variant="outline" className="border-warning text-warning bg-warning/10">{linha.status}</Badge>
                                    : linha.status === 'No almoxarifado'
                                      ? <Badge variant="outline" className="border-success text-success bg-success/10">{linha.status}</Badge>
                                      : <Badge variant="outline" className="border-destructive text-destructive bg-destructive/10">{linha.status}</Badge>;

                                  return (
                                    <TableRow key={linha.item.id} className="hover:bg-muted/30">
                                      <TableCell className="font-mono text-sm py-2">{linha.codigo}</TableCell>
                                      <TableCell className="py-2 text-sm">{linha.marca}</TableCell>
                                      <TableCell className="py-2 text-sm max-w-[150px] truncate" title={linha.especificacao}>{linha.especificacao}</TableCell>
                                      <TableCell className="py-2 text-sm text-muted-foreground">{linha.localizacaoAlmox}</TableCell>
                                      <TableCell className="py-2">{statusBadge}</TableCell>
                                      <TableCell className="py-2 text-sm font-medium">{linha.projetoLocalUso}</TableCell>
                                      <TableCell className="py-2 text-right font-semibold">{linha.saldo}</TableCell>
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
        {grupos.length === 0 && !carregando && (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">Nenhum item encontrado com os filtros aplicados.</p>
          </div>
        )}
      </Accordion>
    </div>
  );
};
