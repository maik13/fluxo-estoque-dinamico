import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Calendar as CalendarIcon, Package, FileSpreadsheet, Printer, BarChart3 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { useEstoqueContext } from '@/contexts/EstoqueContext';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { useConsolidacao } from '@/hooks/useConsolidacao';

export const VisaoProjetos = () => {
  const { movimentacoes } = useEstoqueContext();
  const { 
    locaisUtilizacao: locaisConfig, 
    gruposProjeto, 
    categorias, 
    subcategorias, 
    categoriasSubcategorias 
  } = useConfiguracoes();

  const [filtroPendentesDestino, setFiltroPendentesDestino] = useState('todos');
  const [filtroPendentesTexto, setFiltroPendentesTexto] = useState('');
  const [filtroPendentesTipoItem, setFiltroPendentesTipoItem] = useState('todos');
  const [filtroPendentesStatus, setFiltroPendentesStatus] = useState('ativos');
  const [filtroDataPendentesInicio, setFiltroDataPendentesInicio] = useState<Date | undefined>(undefined);
  const [filtroDataPendentesFim, setFiltroDataPendentesFim] = useState<Date | undefined>(undefined);
  const [tipoAgrupamentoProjetos, setTipoAgrupamentoProjetos] = useState<'projeto' | 'grupo'>('projeto');

  // Obter locais de utilização únicos para filtro
  const locaisPendentes = useMemo(() => {
    const locais = new Set(
      movimentacoes
        .map(mov => mov.localUtilizacaoNome)
        .filter(Boolean)
    );
    return Array.from(locais).sort();
  }, [movimentacoes]);

  // Hook de consolidação para a visão de projetos
  const { itensAgrupados: todosItensAgrupados } = useConsolidacao(
    movimentacoes,
    locaisConfig,
    gruposProjeto,
    tipoAgrupamentoProjetos,
    {
      dataInicio: filtroDataPendentesInicio,
      dataFim: filtroDataPendentesFim,
      tipoItem: filtroPendentesTipoItem,
    },
    categorias,
    subcategorias,
    categoriasSubcategorias
  );

  // Filtragem local adicional (Texto, Status, Destino)
  const pendentesFiltrados = useMemo(() => {
    return todosItensAgrupados.filter(item => {
      // Filtro de Texto (Nome ou Código)
      if (filtroPendentesTexto) {
        const termo = filtroPendentesTexto.toLowerCase();
        const nomeMatch = item.itemSnapshot?.nome?.toLowerCase().includes(termo);
        const codigoMatch = item.itemSnapshot?.codigoBarras?.toString().includes(termo);
        if (!nomeMatch && !codigoMatch) return false;
      }

      // Filtro de Status
      if (filtroPendentesStatus !== 'todos') {
        if (filtroPendentesStatus === 'ativos' && item.statusItem === 'devolvido') return false;
        if (filtroPendentesStatus === 'pendente' && item.statusItem !== 'pendente') return false;
        if (filtroPendentesStatus === 'parcial' && item.statusItem !== 'parcial') return false;
        if (filtroPendentesStatus === 'devolvido' && item.statusItem !== 'devolvido') return false;
      }

      // Filtro de Destino/Projeto
      if (filtroPendentesDestino !== 'todos' && item.localUtilizacaoNome !== filtroPendentesDestino) {
        return false;
      }

      return true;
    });
  }, [todosItensAgrupados, filtroPendentesTexto, filtroPendentesStatus, filtroPendentesDestino]);

  const exportarPendentesParaExcel = () => {
    const dados = pendentesFiltrados.map(item => ({
      'Grupo': item.projetoGrupoNome,
      'Item': item.itemSnapshot?.nome || 'Não identificado',
      'Código': item.itemSnapshot?.codigoBarras || '-',
      'Categoria': item.classificacao || '-',
      'Projeto/Local': item.localUtilizacaoNome,
      'Status': item.statusItem.toUpperCase(),
      'Saída': item.totalSaida,
      'Devolvido': item.totalDevolvido,
      'Saldo': item.pendente,
      'Última Saída': item.ultimaSaida ? format(new Date(item.ultimaSaida), 'dd/MM/yyyy HH:mm') : '-',
      'Responsável': item.destinatario || item.solicitanteNome || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resumo Projetos");
    XLSX.writeFile(wb, `resumo_projetos_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
  };

  const imprimirPendentes = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <Card className="border-warning/20">
        <CardHeader className="pb-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl font-bold text-warning">Resumo por Projeto</CardTitle>
                <div className="flex bg-muted p-1 rounded-md ml-4">
                  <Button 
                    variant={tipoAgrupamentoProjetos === 'projeto' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    className="h-7 text-xs px-3"
                    onClick={() => setTipoAgrupamentoProjetos('projeto')}
                  >
                    Por Projeto
                  </Button>
                  <Button 
                    variant={tipoAgrupamentoProjetos === 'grupo' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    className="h-7 text-xs px-3"
                    onClick={() => setTipoAgrupamentoProjetos('grupo')}
                  >
                    Por Grupo
                  </Button>
                </div>
              </div>
              <CardDescription>
                {tipoAgrupamentoProjetos === 'projeto' 
                  ? "Rastreamento de itens alocados por local de utilização individual" 
                  : "Visão consolidada de itens por Grupos de Projeto"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      onClick={exportarPendentesParaExcel}
                      variant="outline"
                      size="sm"
                      className="h-8 gap-2 border-warning/20 bg-background text-warning hover:bg-warning/10 hover:text-warning"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      <span className="hidden sm:inline">Excel</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Exportar resumo para Excel</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      onClick={imprimirPendentes}
                      variant="outline"
                      size="sm"
                      className="h-8 gap-2 border-warning/20 bg-background text-warning hover:bg-warning/10 hover:text-warning"
                    >
                      <Printer className="h-4 w-4" />
                      <span className="hidden sm:inline">Imprimir</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Imprimir resumo consolidado</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="pendentes-busca" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Busca</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="pendentes-busca"
                    placeholder="Buscar por nome ou código..."
                    className="pl-10"
                    value={filtroPendentesTexto}
                    onChange={(e) => setFiltroPendentesTexto(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="pendentes-status" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</Label>
                <Select value={filtroPendentesStatus} onValueChange={setFiltroPendentesStatus}>
                  <SelectTrigger id="pendentes-status">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativos">Somente em Campo</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="parcial">Parcial</SelectItem>
                    <SelectItem value="devolvido">Devolvido</SelectItem>
                    <SelectItem value="todos">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pendentes-tipo" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filtrar por Categoria</Label>
                <Select value={filtroPendentesTipoItem} onValueChange={setFiltroPendentesTipoItem}>
                  <SelectTrigger id="pendentes-tipo">
                    <SelectValue placeholder="Todos os tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as categorias</SelectItem>
                    {categorias.map(cat => (
                      <SelectItem key={cat.id} value={cat.nome}>
                        {cat.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="pendentes-local" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Projeto / Local</Label>
                <Select value={filtroPendentesDestino} onValueChange={setFiltroPendentesDestino}>
                  <SelectTrigger id="pendentes-local">
                    <SelectValue placeholder="Todos os projetos/locais" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os projetos/locais</SelectItem>
                    {locaisPendentes.map(local => (
                      <SelectItem key={local} value={local!}>
                        {local}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 md:col-span-1">
                <Label htmlFor="pendentes-data-inicio" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data Inicial</Label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="pendentes-data-inicio"
                    type="date"
                    value={filtroDataPendentesInicio ? format(filtroDataPendentesInicio, "yyyy-MM-dd") : ""}
                    onChange={(e) => setFiltroDataPendentesInicio(e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5 md:col-span-1">
                <Label htmlFor="pendentes-data-fim" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data Final</Label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="pendentes-data-fim"
                    type="date"
                    value={filtroDataPendentesFim ? format(filtroDataPendentesFim, "yyyy-MM-dd") : ""}
                    onChange={(e) => setFiltroDataPendentesFim(e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground my-4">
            Mostrando {pendentesFiltrados.length} resumo(s) por {tipoAgrupamentoProjetos === 'projeto' ? 'projeto/local' : 'grupo'}
          </p>

          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {tipoAgrupamentoProjetos === 'grupo' && <TableHead>Grupo</TableHead>}
                  <TableHead>Item</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Categoria</TableHead>
                  {tipoAgrupamentoProjetos === 'projeto' && (
                    <>
                      <TableHead>Projeto/Local</TableHead>
                      <TableHead>Grupo</TableHead>
                    </>
                  )}
                  <TableHead>Status</TableHead>
                  <TableHead>{tipoAgrupamentoProjetos === 'grupo' ? 'Total Saída' : 'Saída'}</TableHead>
                  <TableHead>{tipoAgrupamentoProjetos === 'grupo' ? 'Total Devolvido' : 'Devolvido'}</TableHead>
                  <TableHead>Saldo</TableHead>
                  {tipoAgrupamentoProjetos === 'projeto' && (
                    <>
                      <TableHead>Última Saída</TableHead>
                      <TableHead>Responsável</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendentesFiltrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Package className="h-12 w-12 text-muted-foreground" />
                        <p>Nenhum registro encontrado</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  pendentesFiltrados.map((item) => (
                    <TableRow key={item.key}>
                      {tipoAgrupamentoProjetos === 'grupo' && (
                        <TableCell>
                          <Badge variant={item.localUtilizacaoNome === 'Sem Grupo' ? 'outline' : 'default'} className={item.localUtilizacaoNome === 'Sem Grupo' ? '' : 'bg-blue-500 hover:bg-blue-600'}>
                            📦 {item.localUtilizacaoNome}
                          </Badge>
                        </TableCell>
                      )}
                      <TableCell>
                        <div>
                          <p className="font-medium text-xs">{item.itemSnapshot?.nome || 'Item não identificado'}</p>
                          {item.itemSnapshot?.marca && (
                            <p className="text-[10px] text-muted-foreground">{item.itemSnapshot.marca}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-[10px]">
                        {item.itemSnapshot?.codigoBarras || '-'}
                      </TableCell>
                      <TableCell>
                        {item.classificacao !== '-' ? (
                          <Badge variant="outline" className="text-[10px] h-4 bg-muted/50 border-primary/20 text-primary">
                            {item.classificacao}
                          </Badge>
                        ) : '-'}
                      </TableCell>
                      {tipoAgrupamentoProjetos === 'projeto' && (
                        <>
                          <TableCell>
                            <Badge variant="secondary" className="bg-muted text-foreground border-none text-[10px]">
                              {item.localUtilizacaoNome}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {item.projetoGrupoNome !== '-' ? (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                                📦 {item.projetoGrupoNome}
                              </Badge>
                            ) : '-'}
                          </TableCell>
                        </>
                      )}
                      <TableCell>
                        <Badge 
                          className={cn(
                            "text-[10px] h-4",
                            item.statusItem === 'pendente' && "bg-red-500/10 text-red-500 border-red-500/20",
                            item.statusItem === 'parcial' && "bg-amber-500/10 text-amber-500 border-amber-500/20",
                            item.statusItem === 'devolvido' && "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          )}
                        >
                          {item.statusItem === 'pendente' ? '🔴 Pendente' : 
                           item.statusItem === 'parcial' ? '🟡 Parcial' : '🟢 Devolvido'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-warning font-mono font-bold text-xs text-right">
                        {item.totalSaida.toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-info font-mono font-bold text-xs text-right">
                        {item.totalDevolvido.toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={item.pendente > 0 ? "destructive" : "outline"} className="font-mono font-bold text-xs">
                          {item.pendente.toLocaleString('pt-BR')} {item.itemSnapshot?.unidade || ''}
                        </Badge>
                      </TableCell>
                      {tipoAgrupamentoProjetos === 'projeto' && (
                        <>
                          <TableCell className="text-[10px]">
                            {item.ultimaSaida ? format(new Date(item.ultimaSaida), 'dd/MM/yyyy HH:mm') : '-'}
                          </TableCell>
                          <TableCell className="text-[10px]">
                            {item.destinatario || item.solicitanteNome || '-'}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Auxiliar para estilos
const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');
