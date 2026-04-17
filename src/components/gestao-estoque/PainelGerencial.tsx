import { useState, useMemo, Fragment } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEstoqueContext } from '@/contexts/EstoqueContext';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { useConsolidacao, ConsolidacaoFiltros } from '@/hooks/useConsolidacao';
import { 
  BarChart3, Package, Truck, RotateCcw, Search, Filter, 
  ChevronRight, ChevronDown, FileDown, Printer, AlertTriangle 
} from 'lucide-react';
import { exportarResumoGruposExcel, exportarItensGrupoExcel } from '@/utils/reportExport';
import { Button } from '@/components/ui/button';

export const PainelGerencial = () => {
  const { movimentacoes } = useEstoqueContext();
  const { 
    locaisUtilizacao: locaisConfig, 
    gruposProjeto, 
    categorias, 
    subcategorias, 
    categoriasSubcategorias 
  } = useConfiguracoes();
  
  // Estados para filtros
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');
  const [tipoItem, setTipoItem] = useState<string>('todos');
  const [grupoId, setGrupoId] = useState<string>('todos');
  const [localId, setLocalId] = useState<string>('todos');
  const [buscaGrupo, setBuscaGrupo] = useState<string>('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Preparar filtros para o hook
  const filtros: ConsolidacaoFiltros = useMemo(() => ({
    dataInicio: dataInicio ? new Date(dataInicio) : undefined,
    dataFim: dataFim ? new Date(dataFim) : undefined,
    tipoItem,
    grupoId,
    localId
  }), [dataInicio, dataFim, tipoItem, grupoId, localId]);

  // Extrair classificações reais presentes nos itens consolidados (Categoria Nome)
  const classificacoesDinamicas = useMemo(() => {
    const classes = new Set<string>();
    itensAgrupados.forEach(item => {
      if (item.classificacao) classes.add(item.classificacao);
    });
    return Array.from(classes).sort();
  }, [itensAgrupados]);

  // Locais filtrados para o seletor (respeita o grupo se selecionado)
  const locaisParaSeletor = useMemo(() => {
    let filtrados = locaisConfig;
    if (grupoId !== 'todos') {
      if (grupoId === 'sem-grupo') {
        filtrados = locaisConfig.filter(l => !l.group_id);
      } else {
        filtrados = locaisConfig.filter(l => l.group_id === grupoId);
      }
    }
    return filtrados.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [locaisConfig, grupoId]);

  // Obter dados consolidados usando o hook compartilhado
  const { gruposAgrupados, kpis } = useConsolidacao(
    movimentacoes,
    locaisConfig,
    gruposProjeto,
    'grupo',
    filtros,
    categorias,
    subcategorias,
    categoriasSubcategorias
  );

  // Obter a lista completa de grupos para exibição (Cadastro + Calculados)
  const gruposFiltrados = useMemo(() => {
    // 1. Criar base com todos os grupos cadastrados + Sem Grupo
    const base = [
      ...gruposProjeto.map(g => ({
        id: g.id,
        nome: g.nome,
        totalSaida: 0,
        totalDevolvido: 0,
        saldo: 0,
        status: 'Devolvido' as const, // Status inicial zerado
        quantidadeItens: 0
      })),
      {
        id: 'sem-grupo',
        nome: 'Sem Grupo',
        totalSaida: 0,
        totalDevolvido: 0,
        saldo: 0,
        status: 'Devolvido' as const,
        quantidadeItens: 0
      }
    ];

    // 2. Mapa dos dados calculados pelo hook para mesclagem rápida
    const statsMap = new Map(gruposAgrupados.map(g => [g.id, g]));

    // 3. Mesclar e Aplicar Filtros (Seletor de Grupo e Busca Textual)
    let listaFinal = base.map(itemBase => statsMap.get(itemBase.id) || itemBase);

    // Filtro de Grupo Específico (do seletor superior)
    if (grupoId !== 'todos') {
      listaFinal = listaFinal.filter(g => g.id === grupoId);
    }

    // Filtro de Busca (busca por texto na tabela)
    if (buscaGrupo) {
      const termo = buscaGrupo.toLowerCase();
      listaFinal = listaFinal.filter(g => g.nome.toLowerCase().includes(termo));
    }

    // 4. Ordenação (Saldo descendente, em seguida por Nome)
    return listaFinal.sort((a, b) => {
      if (b.saldo !== a.saldo) return b.saldo - a.saldo;
      return a.nome.localeCompare(b.nome);
    });
  }, [gruposProjeto, gruposAgrupados, grupoId, buscaGrupo]);

  const toggleGroup = (id: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedGroups(newExpanded);
  };

  const getFiltrosDescricao = () => {
    const partes = [];
    if (dataInicio) partes.push(`Início: ${new Date(dataInicio).toLocaleDateString('pt-BR')}`);
    if (dataFim) partes.push(`Fim: ${new Date(dataFim).toLocaleDateString('pt-BR')}`);
    if (tipoItem !== 'todos') partes.push(`Classificação: ${tipoItem}`);
    if (grupoId !== 'todos') partes.push(`Grupo: ${gruposProjeto.find(g => g.id === grupoId)?.nome || 'Sem Grupo'}`);
    if (localId !== 'todos') partes.push(`Local: ${locaisConfig.find(l => l.id === localId)?.nome || 'Projeto'}`);
    if (partes.length === 0) return 'Todo o período';
    return partes.join(' | ');
  };

  const { itensAgrupados } = useConsolidacao(
    movimentacoes, 
    locaisConfig, 
    gruposProjeto, 
    'grupo', 
    filtros,
    categorias,
    subcategorias,
    categoriasSubcategorias
  );

  return (
    <div className="space-y-6">
      {/* Filtros Superiores */}
      <Card className="border-muted">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Filtros Gerenciais</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data-inicio">Data Inicial</Label>
              <Input 
                id="data-inicio" 
                type="date" 
                value={dataInicio} 
                onChange={(e) => setDataInicio(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data-fim">Data Final</Label>
              <Input 
                id="data-fim" 
                type="date" 
                value={dataFim} 
                onChange={(e) => setDataFim(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Classificação do Item</Label>
              <Select value={tipoItem} onValueChange={setTipoItem}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as classificações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as classificações</SelectItem>
                  {classificacoesDinamicas.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Grupo do Projeto</Label>
              <Select value={grupoId} onValueChange={(val) => {
                setGrupoId(val);
                setLocalId('todos'); // Reseta o local ao mudar o grupo
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os grupos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os grupos</SelectItem>
                  {gruposProjeto.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>
                  ))}
                  <SelectItem value="sem-grupo">Sem Grupo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Projeto / Local</Label>
              <Select value={localId} onValueChange={setLocalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os projetos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os projetos</SelectItem>
                  {locaisParaSeletor.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="busca-grupo">Buscar na Tabela</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="busca-grupo"
                  placeholder="Nome do grupo..."
                  className="pl-9"
                  value={buscaGrupo}
                  onChange={(e) => setBuscaGrupo(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-600">Total Pendente</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">{kpis.totalPendente.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-amber-600/70 mt-1">Soma de todos os saldos em campo</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">Grupos com Pendência</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{kpis.gruposComPendencia}</div>
            <p className="text-xs text-blue-600/70 mt-1">Quantidade de eventos ativos</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-orange-600">Total em Campo</CardTitle>
            <Truck className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">{kpis.totalEmCampo.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-orange-600/70 mt-1">Acumulado de saídas brutas</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-emerald-600">Total Devolvido</CardTitle>
            <RotateCcw className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">{kpis.totalDevolvido.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-emerald-600/70 mt-1">Retornos registrados no período</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Grupos */}
      <Card className="print-section">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle>Grupos com maior pendência</CardTitle>
            <CardDescription className="print:hidden">
              Resumo consolidado por Grupo de Projeto ordenado por saldo de material em campo
            </CardDescription>
          </div>
          <div className="flex gap-2 print:hidden">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 gap-1"
              onClick={() => exportarResumoGruposExcel(gruposFiltrados, getFiltrosDescricao())}
            >
              <FileDown className="h-4 w-4" />
              Excel
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 gap-1"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px] print:hidden"></TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead className="text-right">Total Saída</TableHead>
                <TableHead className="text-right">Total Devolvido</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-center print:hidden">Aproveitamento</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gruposFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum dado encontrado para os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : (
                gruposFiltrados.map((grupo) => {
                  const isExpanded = expandedGroups.has(grupo.id);
                  const itensDoGrupo = itensAgrupados.filter(i => i.localUtilizacaoId === grupo.id);
                  const aproveitamento = grupo.totalSaida > 0 
                    ? Math.round((grupo.totalDevolvido / grupo.totalSaida) * 100) 
                    : 100;
                  
                  return (
                    <Fragment key={grupo.id}>
                      <TableRow 
                        className={`hover:bg-muted/50 cursor-pointer ${isExpanded ? 'bg-muted/30' : ''}`}
                        onClick={() => toggleGroup(grupo.id)}
                      >
                        <TableCell className="print:hidden">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            {grupo.nome}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">{grupo.totalSaida.toLocaleString('pt-BR')}</TableCell>
                        <TableCell className="text-right font-mono text-emerald-600">{grupo.totalDevolvido.toLocaleString('pt-BR')}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-orange-600">{grupo.saldo.toLocaleString('pt-BR')}</TableCell>
                        <TableCell className="text-center print:hidden">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${aproveitamento === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                                style={{ width: `${aproveitamento}%` }} 
                              />
                            </div>
                            <span className="text-xs min-w-[30px]">{aproveitamento}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {grupo.totalSaida === 0 ? (
                            <Badge variant="outline" className="text-muted-foreground border-muted bg-muted/20">Sem movimentação</Badge>
                          ) : (
                            <>
                              {grupo.status === 'Pendente' && (
                                <Badge variant="destructive" className="bg-red-500 hover:bg-red-600">Pendente</Badge>
                              )}
                              {grupo.status === 'Parcial' && (
                                <Badge variant="secondary" className="bg-amber-500 hover:bg-amber-600 text-white">Parcial</Badge>
                              )}
                              {grupo.status === 'Devolvido' && (
                                <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">Devolvido</Badge>
                              )}
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                      
                      {isExpanded && (
                        <TableRow className="bg-muted/10 border-b">
                          <TableCell colSpan={7} className="p-0">
                            <div className="p-4 bg-muted/5">
                              <div className="flex items-center justify-between mb-3 px-2">
                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                  <Filter className="h-4 w-4 text-primary" />
                                  Itens detalhados do grupo: {grupo.nome}
                                </h4>
                                <div className="flex gap-2 print:hidden">
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 text-xs gap-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      exportarItensGrupoExcel(grupo.nome, itensDoGrupo || [], getFiltrosDescricao());
                                    }}
                                  >
                                    <FileDown className="h-3.5 w-3.5" />
                                    Exportar Itens
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 text-xs gap-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.print();
                                    }}
                                  >
                                    <Printer className="h-3.5 w-3.5" />
                                    Imprimir Itens
                                  </Button>
                                </div>
                              </div>
                              <div className="rounded-md border bg-white overflow-hidden">
                                <Table className="text-xs">
                                  <TableHeader className="bg-muted/20">
                                    <TableRow>
                                      <TableHead className="font-bold">Item</TableHead>
                                      <TableHead className="font-bold">Código</TableHead>
                                      <TableHead className="font-bold">Tipo / Classificação</TableHead>
                                      <TableHead className="text-right font-bold">Saída</TableHead>
                                      <TableHead className="text-right font-bold">Devolvido</TableHead>
                                      <TableHead className="text-right font-bold">Saldo</TableHead>
                                      <TableHead className="text-center font-bold">Status</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {(itensDoGrupo || []).map((item) => (
                                      <TableRow key={item.key} className="hover:bg-muted/50">
                                        <TableCell className="font-medium">{item.itemSnapshot?.nome || 'Item avulso'}</TableCell>
                                        <TableCell className="font-mono text-[10px]">{item.itemSnapshot?.codigoBarras || '-'}</TableCell>
                                        <TableCell>
                                          <Badge variant="outline" className="text-[9px] h-4">
                                            {item.classificacao || 'Sem Categoria'}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-mono">{item.totalSaida}</TableCell>
                                        <TableCell className="text-right font-mono text-emerald-600">{item.totalDevolvido}</TableCell>
                                        <TableCell className="text-right font-mono font-bold text-orange-600">{item.pendente}</TableCell>
                                        <TableCell className="text-center">
                                          <div className={`w-2 h-2 rounded-full mx-auto ${
                                            (item.statusItem || 'pendente') === 'devolvido' ? 'bg-emerald-500' : 
                                            ((item.statusItem || 'pendente') === 'parcial' ? 'bg-amber-500' : 'bg-red-500')
                                          }`} title={item.statusItem} />
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                    {(!itensDoGrupo || itensDoGrupo.length === 0) && (
                                      <TableRow>
                                        <TableCell colSpan={7} className="text-center py-4 text-muted-foreground italic">
                                          Nenhum item pendente ou devolvido neste grupo para os filtros ativos.
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

