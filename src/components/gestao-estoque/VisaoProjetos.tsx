import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Calendar as CalendarIcon, Package, FileSpreadsheet, Printer, CheckCircle2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { useEstoqueContext } from '@/contexts/EstoqueContext';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { useConsolidacao, ItemAgrupado } from '@/hooks/useConsolidacao';
import { Checkbox } from '@/components/ui/checkbox';
import { DialogoEncerrarItens } from './DialogoEncerrarItens';
import { DetalhesMovimentacoesProjeto } from './DetalhesMovimentacoesProjeto';
import { isAcertoDeEstoque } from '@/utils/movimentacoes';
import { supabase } from '@/integrations/supabase/client';
import React from 'react';

export const VisaoProjetos = () => {
  const { movimentacoes, carregarHistoricoCompleto, itens } = useEstoqueContext();

  useEffect(() => {
    void carregarHistoricoCompleto();
  }, []);
  const { 
    locaisUtilizacao: locaisConfig, 
    gruposProjeto, 
    categorias, 
    subcategorias, 
    categoriasSubcategorias 
  } = useConfiguracoes();

  const [filtroPendentesProjetoId, setFiltroPendentesProjetoId] = useState('todos');
  const [filtroPendentesGrupoId, setFiltroPendentesGrupoId] = useState('todos');
  const [filtroPendentesTexto, setFiltroPendentesTexto] = useState('');
  const [filtroPendentesCategoria, setFiltroPendentesCategoria] = useState('todos');
  const [filtroPendentesStatus, setFiltroPendentesStatus] = useState('ativos');
  const [filtroDataPendentesInicio, setFiltroDataPendentesInicio] = useState<Date | undefined>(undefined);
  const [filtroDataPendentesFim, setFiltroDataPendentesFim] = useState<Date | undefined>(undefined);
  const [tipoAgrupamentoProjetos, setTipoAgrupamentoProjetos] = useState<'projeto' | 'grupo' | 'valor'>('projeto');
  
  const [selectedItensIds, setSelectedItensIds] = useState<string[]>([]);
  const [dialogoEncerrarOpen, setDialogoEncerrarOpen] = useState(false);
  const [itensParaEncerrar, setItensParaEncerrar] = useState<ItemAgrupado[]>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const getMovimentacoesItem = (item: ItemAgrupado) => {
    return movimentacoes.filter(m => {
      if (isAcertoDeEstoque(m)) return false;
      const mItemId = m.itemId;
      if (mItemId !== item.itemId) return false;
      
      const mLocalId = m.localUtilizacaoId || 'sem-local';
      
      if (tipoAgrupamentoProjetos === 'grupo') {
        const local = locaisConfig.find(l => l.id === mLocalId);
        const grupoId = local?.group_id || 'sem-grupo';
        return grupoId === item.localUtilizacaoId;
      } else {
        return mLocalId === item.localUtilizacaoId;
      }
    });
  };

  const handleToggleSelection = (id: string) => {
    setSelectedItensIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedItensIds(pendentesFiltrados.map(i => i.key));
    } else {
      setSelectedItensIds([]);
    }
  };

  const handleEncerrarSelecionados = () => {
    const itens = pendentesFiltrados.filter(i => selectedItensIds.includes(i.key));
    if (itens.length > 0) {
      setItensParaEncerrar(itens);
      setDialogoEncerrarOpen(true);
    }
  };

  const handleEncerrarProjeto = () => {
    // Encerrar apenas as ferramentas que estão de fato pendentes no filtro atual
    const ferramentasPendentes = pendentesFiltrados.filter(i => i.pendente > 0 && i.statusItem !== 'consumido');
    if (ferramentasPendentes.length > 0) {
      setItensParaEncerrar(ferramentasPendentes);
      setDialogoEncerrarOpen(true);
    }
  };

  // Projetos/locais e grupos vêm da configuração oficial do banco.
  // As movimentações alimentam a consolidação, mas não podem limitar as opções de filtro:
  // grupos/locais novos ou ainda sem movimentação também precisam permanecer visíveis.
  const locaisPendentes = useMemo(() => {
    return locaisConfig
      .filter((local) => {
        const groupId = local.group_id || 'sem-grupo';
        return filtroPendentesGrupoId === 'todos' || groupId === filtroPendentesGrupoId;
      })
      .map((local) => ({
        id: local.id,
        nome: local.nome,
        groupId: local.group_id || 'sem-grupo',
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [locaisConfig, filtroPendentesGrupoId]);

  const gruposPendentes = useMemo(() => {
    const grupos = gruposProjeto.map((grupo) => ({
      id: grupo.id,
      nome: grupo.nome,
    }));

    if (locaisConfig.some((local) => !local.group_id)) {
      grupos.push({ id: 'sem-grupo', nome: 'Sem Grupo' });
    }

    return grupos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [gruposProjeto, locaisConfig]);

  const selecionarGrupo = (grupoId: string) => {
    setFiltroPendentesGrupoId(grupoId);

    if (filtroPendentesProjetoId === 'todos') return;
    const localAtual = locaisConfig.find((local) => local.id === filtroPendentesProjetoId);
    const grupoAtual = localAtual?.group_id || 'sem-grupo';
    if (grupoId !== 'todos' && grupoAtual !== grupoId) {
      setFiltroPendentesProjetoId('todos');
    }
  };

  // A visão Por Valor usa a mesma consolidação oficial Por Projeto.
  // Ela muda apenas a apresentação financeira, sem criar um segundo motor de movimentações.
  const agrupamentoConsolidacao: 'projeto' | 'grupo' =
    tipoAgrupamentoProjetos === 'grupo' ? 'grupo' : 'projeto';

  // Hook de consolidação para a visão de projetos
  const { itensAgrupados: todosItensAgrupados } = useConsolidacao(
    movimentacoes,
    locaisConfig,
    gruposProjeto,
    agrupamentoConsolidacao,
    {
      dataInicio: filtroDataPendentesInicio,
      dataFim: filtroDataPendentesFim,
      categoria: filtroPendentesCategoria,
      localId: filtroPendentesProjetoId,
      grupoId: filtroPendentesGrupoId,
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

      return true;
    });
  }, [todosItensAgrupados, filtroPendentesTexto, filtroPendentesStatus]);

  const resumoValor = useMemo(() => {
    const itensAtuaisMap = new Map(itens.map((item) => [item.id, item]));

    return todosItensAgrupados
      .filter((item) => item.localUtilizacaoId !== 'sem-local')
      .filter((item) => item.classificacao !== 'Ferramenta')
      .filter((item) => {
        if (!filtroPendentesTexto) return true;
        const termo = filtroPendentesTexto.toLowerCase();
        const nomeMatch = item.itemSnapshot?.nome?.toLowerCase().includes(termo);
        const codigoMatch = item.itemSnapshot?.codigoBarras?.toString().includes(termo);
        return Boolean(nomeMatch || codigoMatch);
      })
      .map((item) => {
        const quantidadeConsumida = Math.max(0, item.totalSaida - item.totalDevolvido);
        const itemAtual = itensAtuaisMap.get(item.itemId);
        const valorAtual = itemAtual?.valor;
        const valorSnapshot = item.itemSnapshot?.valor;

        const temValorAtual =
          valorAtual !== undefined &&
          valorAtual !== null &&
          Number.isFinite(Number(valorAtual));

        const temValorSnapshot =
          valorSnapshot !== undefined &&
          valorSnapshot !== null &&
          Number.isFinite(Number(valorSnapshot));

        const valorUnitario = temValorAtual
          ? Number(valorAtual)
          : temValorSnapshot
            ? Number(valorSnapshot)
            : null;

        const origemValor = temValorAtual
          ? 'Cadastro atual'
          : temValorSnapshot
            ? 'Snapshot histórico'
            : 'Sem valor cadastrado';

        return {
          ...item,
          quantidadeConsumida,
          valorUnitario,
          valorTotal: valorUnitario === null ? null : quantidadeConsumida * valorUnitario,
          origemValor,
        };
      })
      .filter((item) => item.quantidadeConsumida > 0)
      .sort((a, b) => {
        const projeto = a.localUtilizacaoNome.localeCompare(b.localUtilizacaoNome, 'pt-BR');
        if (projeto !== 0) return projeto;
        return (b.valorTotal ?? -1) - (a.valorTotal ?? -1);
      });
  }, [todosItensAgrupados, itens, filtroPendentesTexto]);

  const totalValorConsumido = useMemo(
    () => resumoValor.reduce((total, item) => total + (item.valorTotal ?? 0), 0),
    [resumoValor],
  );

  const itensSemValor = useMemo(
    () => resumoValor.filter((item) => item.valorUnitario === null).length,
    [resumoValor],
  );

  const controleValor = useMemo(() => {
    const termo = filtroPendentesTexto.trim().toLowerCase();
    const linhasNoEscopo = todosItensAgrupados.filter((item) => {
      if (!termo) return true;
      const nomeMatch = item.itemSnapshot?.nome?.toLowerCase().includes(termo);
      const codigoMatch = item.itemSnapshot?.codigoBarras?.toString().includes(termo);
      return Boolean(nomeMatch || codigoMatch);
    });

    const ferramentas = linhasNoEscopo.filter((item) => item.classificacao === 'Ferramenta');
    const consumiveis = linhasNoEscopo.filter((item) => item.classificacao !== 'Ferramenta');
    const consumiveisComSaida = consumiveis.filter((item) => item.totalSaida > 0);
    const totalmenteDevolvidos = consumiveisComSaida.filter(
      (item) => Math.max(0, item.totalSaida - item.totalDevolvido) === 0,
    );

    return {
      itensComSaida: consumiveisComSaida.length,
      itensComConsumoLiquido: resumoValor.length,
      totalmenteDevolvidos: totalmenteDevolvidos.length,
      ferramentasExcluidas: ferramentas.length,
    };
  }, [todosItensAgrupados, filtroPendentesTexto, resumoValor]);

  const projetoSelecionadoNome =
    filtroPendentesProjetoId === 'todos'
      ? 'Todos os projetos/locais'
      : locaisConfig.find((local) => local.id === filtroPendentesProjetoId)?.nome || 'Projeto/local selecionado';

  const grupoSelecionadoNome =
    filtroPendentesGrupoId === 'todos'
      ? 'Todos os grupos'
      : filtroPendentesGrupoId === 'sem-grupo'
        ? 'Sem Grupo'
        : gruposProjeto.find((grupo) => grupo.id === filtroPendentesGrupoId)?.nome || 'Grupo selecionado';

  const periodoSelecionado = filtroDataPendentesInicio || filtroDataPendentesFim
    ? `${filtroDataPendentesInicio ? format(filtroDataPendentesInicio, 'dd/MM/yyyy') : 'Início'} a ${filtroDataPendentesFim ? format(filtroDataPendentesFim, 'dd/MM/yyyy') : 'Hoje'}`
    : 'Histórico completo';

  const formatarMoeda = (valor: number) =>
    valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const exportarPendentesParaExcel = () => {
    const porValor = tipoAgrupamentoProjetos === 'valor';

    const dados = porValor
      ? resumoValor.map(item => ({
          'Grupo': item.projetoGrupoNome === '-' ? 'Sem Grupo' : item.projetoGrupoNome,
          'Projeto/Local': item.localUtilizacaoNome,
          'Item': item.itemSnapshot?.nome || 'Não identificado',
          'Código': item.itemSnapshot?.codigoBarras || '-',
          'Categoria': item.classificacao || '-',
          'Saída': item.totalSaida,
          'Devolvido': item.totalDevolvido,
          'Quantidade Consumida': item.quantidadeConsumida,
          'Unidade': item.itemSnapshot?.unidade || '-',
          'Valor Unitário': item.valorUnitario ?? '',
          'Valor Consumido': item.valorTotal ?? '',
          'Base do Valor': item.origemValor,
        }))
      : pendentesFiltrados.map(item => ({
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
    XLSX.utils.book_append_sheet(wb, ws, porValor ? "Resumo por Valor" : "Resumo Projetos");
    XLSX.writeFile(
      wb,
      porValor
        ? `resumo_consumo_valor_${format(new Date(), 'dd-MM-yyyy')}.xlsx`
        : `resumo_projetos_${format(new Date(), 'dd-MM-yyyy')}.xlsx`
    );
  };

  const imprimirPendentes = () => {
    document.body.classList.add('imprimir-projetos');
    const limparModoImpressao = () => {
      document.body.classList.remove('imprimir-projetos');
      window.removeEventListener('afterprint', limparModoImpressao);
    };

    window.addEventListener('afterprint', limparModoImpressao);
    window.print();
  };

  return (
    <div className="space-y-6">
      <Card className="border-warning/20" data-projetos-print-ativa>
        <CardHeader className="pb-2 projetos-screen-only">
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
                  <Button
                    variant={tipoAgrupamentoProjetos === 'valor' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-7 text-xs px-3"
                    onClick={() => {
                      setTipoAgrupamentoProjetos('valor');
                      setSelectedItensIds([]);
                    }}
                  >
                    Por Valor
                  </Button>
                </div>
              </div>
              <CardDescription>
                {tipoAgrupamentoProjetos === 'projeto'
                  ? "Rastreamento de itens alocados por local de utilização individual"
                  : tipoAgrupamentoProjetos === 'grupo'
                    ? "Visão consolidada de itens por Grupos de Projeto"
                    : "Resumo do consumo líquido e dos valores dos itens por Projeto/Local"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {tipoAgrupamentoProjetos !== 'valor' && (selectedItensIds.length > 0 ? (
                <Button 
                  onClick={handleEncerrarSelecionados}
                  variant="default"
                  size="sm"
                  className="h-8 gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Encerrar {selectedItensIds.length} Itens</span>
                </Button>
              ) : (
                <Button 
                  onClick={handleEncerrarProjeto}
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2 border-destructive/50 text-destructive hover:bg-destructive/10"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Encerrar Pendências</span>
                </Button>
              ))}
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
          <div className="projetos-print-only">
            <div className="projetos-print-header">
              <div>
                <div className="projetos-print-brand">TUDUBAMBUSA</div>
                <h1>Relatório de Consumo por Valor</h1>
                <p>Gestão de Almoxarifado · Resumo por Projeto</p>
              </div>
              <div className="projetos-print-emissao">
                <strong>Emissão</strong>
                <span>{format(new Date(), 'dd/MM/yyyy HH:mm')}</span>
              </div>
            </div>

            <div className="projetos-print-contexto">
              <div><span>Projeto / Local</span><strong>{projetoSelecionadoNome}</strong></div>
              <div><span>Grupo</span><strong>{grupoSelecionadoNome}</strong></div>
              <div><span>Período</span><strong>{periodoSelecionado}</strong></div>
              <div><span>Categoria</span><strong>{filtroPendentesCategoria === 'todos' ? 'Todas as categorias' : filtroPendentesCategoria}</strong></div>
            </div>

            <div className="projetos-print-fechamento">
              <div>
                <span>Conciliação do movimento</span>
                <strong>
                  {controleValor.itensComSaida} itens com saída = {controleValor.itensComConsumoLiquido} com consumo líquido + {controleValor.totalmenteDevolvidos} totalmente devolvidos
                </strong>
              </div>
              <p>
                A relação detalhada apresenta apenas itens com consumo líquido positivo; devoluções integrais permanecem demonstradas no fechamento.
              </p>
            </div>
          </div>

          <div className="space-y-4 projetos-screen-only">
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
              
              {tipoAgrupamentoProjetos !== 'valor' && (
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
              )}

              <div className="space-y-1.5">
                <Label htmlFor="pendentes-tipo" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filtrar por Categoria</Label>
                <Select value={filtroPendentesCategoria} onValueChange={setFiltroPendentesCategoria}>
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
              <div className="space-y-1.5">
                <Label htmlFor="pendentes-local" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Projeto / Local</Label>
                <Select value={filtroPendentesProjetoId} onValueChange={setFiltroPendentesProjetoId}>
                  <SelectTrigger id="pendentes-local">
                    <SelectValue placeholder="Todos os projetos/locais" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os projetos/locais</SelectItem>
                    {locaisPendentes.map((local) => (
                      <SelectItem key={local.id} value={local.id}>
                        {local.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pendentes-grupo" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Grupo</Label>
                <Select value={filtroPendentesGrupoId} onValueChange={selecionarGrupo}>
                  <SelectTrigger id="pendentes-grupo">
                    <SelectValue placeholder="Todos os grupos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os grupos</SelectItem>
                    {gruposPendentes.map((grupo) => (
                      <SelectItem key={grupo.id} value={grupo.id}>
                        {grupo.nome}
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
                    onChange={(e) => setFiltroDataPendentesFim(e.target.value ? new Date(e.target.value + 'T23:59:59.999') : undefined)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </div>

          {tipoAgrupamentoProjetos === 'valor' ? (
            <div className="projetos-screen-only my-4 rounded-md border border-border bg-muted/20 px-4 py-3">
              <p className="text-sm font-semibold text-foreground">
                Fechamento do filtro: {controleValor.itensComSaida} itens com saída = {controleValor.itensComConsumoLiquido} com consumo líquido + {controleValor.totalmenteDevolvidos} totalmente devolvidos.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                A tabela abaixo apresenta somente os {controleValor.itensComConsumoLiquido} itens que tiveram consumo líquido. Os {controleValor.totalmenteDevolvidos} itens integralmente devolvidos permanecem contabilizados no fechamento acima.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground my-4 projetos-screen-only">
              Mostrando {pendentesFiltrados.length} resumo(s) por {tipoAgrupamentoProjetos === 'projeto' ? 'projeto/local' : 'grupo'}
            </p>
          )}

          {tipoAgrupamentoProjetos === 'valor' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 projetos-valor-kpis">
                <div className="rounded-md border bg-muted/20 p-3 projetos-kpi-principal">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor total consumido</p>
                  <p className="text-lg font-bold text-warning">{formatarMoeda(totalValorConsumido)}</p>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Itens com saída</p>
                  <p className="text-lg font-bold">{controleValor.itensComSaida}</p>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Consumo líquido</p>
                  <p className="text-lg font-bold">{controleValor.itensComConsumoLiquido}</p>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">100% devolvidos</p>
                  <p className="text-lg font-bold">{controleValor.totalmenteDevolvidos}</p>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sem valor</p>
                  <p className="text-lg font-bold">{itensSemValor}</p>
                </div>
              </div>

              <div className="projetos-print-only projetos-print-criterio">
                <strong>Critério de apuração:</strong> consumo líquido = quantidade de saída − quantidade devolvida.
                Ferramentas não compõem o consumo financeiro. O valor unitário utiliza o cadastro atual do item e,
                quando indisponível, o snapshot histórico da movimentação. Valores devem ser interpretados como apuração gerencial do almoxarifado.
              </div>

              <div className="w-full overflow-x-auto projetos-valor-tabela">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Projeto/Local</TableHead>
                      <TableHead>Grupo</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Saída</TableHead>
                      <TableHead className="text-right">Devolvido</TableHead>
                      <TableHead className="text-right">Consumido</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="text-right">Valor Unit.</TableHead>
                      <TableHead className="text-right">Valor Consumido</TableHead>
                      <TableHead>Base do Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resumoValor.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <Package className="h-12 w-12 text-muted-foreground" />
                            <p>Nenhum consumo encontrado para os filtros selecionados</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      resumoValor.map((item) => (
                        <TableRow key={`valor-${item.key}`}>
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
                            ) : (
                              <span className="text-xs text-muted-foreground">Sem Grupo</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-xs">{item.itemSnapshot?.nome || 'Item não identificado'}</p>
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
                          <TableCell className="text-right font-mono text-xs">
                            {item.totalSaida.toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {item.totalDevolvido.toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs">
                            {item.quantidadeConsumida.toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell className="text-xs">{item.itemSnapshot?.unidade || '-'}</TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {item.valorUnitario === null ? '-' : formatarMoeda(item.valorUnitario)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-warning text-xs">
                            {item.valorTotal === null ? '-' : formatarMoeda(item.valorTotal)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={item.origemValor === 'Cadastro atual' ? 'secondary' : 'outline'} className="text-[10px]">
                              {item.origemValor}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="projetos-print-only projetos-print-footer">
                <span>Relatório gerado pelo Fluxo de Estoque Dinâmico · Tudubambusa</span>
                <span className="projetos-print-page"></span>
              </div>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox 
                        checked={selectedItensIds.length > 0 && selectedItensIds.length === pendentesFiltrados.length}
                        onCheckedChange={handleToggleAll}
                        aria-label="Selecionar todos"
                      />
                    </TableHead>
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
                      <React.Fragment key={item.key}>
                        <TableRow 
                          className={`cursor-pointer transition-colors hover:bg-muted/50 ${selectedItensIds.includes(item.key) ? 'bg-muted/50' : ''} ${expandedRow === item.key ? 'bg-muted/80 border-b-0' : ''}`}
                          onDoubleClick={() => setExpandedRow(expandedRow === item.key ? null : item.key)}
                        >
                          <TableCell>
                          <Checkbox 
                            checked={selectedItensIds.includes(item.key)}
                            onCheckedChange={() => handleToggleSelection(item.key)}
                            aria-label={`Selecionar ${item.itemSnapshot?.nome}`}
                          />
                        </TableCell>
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
                              item.statusItem === 'devolvido' && "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                              item.statusItem === 'consumido' && "bg-blue-500/10 text-blue-500 border-blue-500/20"
                            )}
                          >
                            {item.statusItem === 'pendente' ? '🔴 Pendente' : 
                             item.statusItem === 'parcial' ? '🟡 Parcial' : 
                             item.statusItem === 'consumido' ? '🔵 Consumido' : '🟢 Devolvido'}
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
                            {item.statusItem === 'consumido' && item.pendenteOriginal ? item.pendenteOriginal.toLocaleString('pt-BR') : item.pendente.toLocaleString('pt-BR')} {item.itemSnapshot?.unidade || ''}
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
                      {expandedRow === item.key && (
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableCell colSpan={tipoAgrupamentoProjetos === 'projeto' ? 12 : 10} className="p-0 border-b">
                            <DetalhesMovimentacoesProjeto movimentacoes={getMovimentacoesItem(item)} />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <DialogoEncerrarItens 
        open={dialogoEncerrarOpen} 
        onOpenChange={setDialogoEncerrarOpen} 
        itens={itensParaEncerrar} 
        onSuccess={() => {
          setSelectedItensIds([]);
          // Force a small reload ou os canais real-time atualizarão
        }}
      />
    </div>
  );
};

// Auxiliar para estilos
const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');
