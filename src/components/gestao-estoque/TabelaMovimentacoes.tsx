import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Search, ArrowUpCircle, ArrowDownCircle, PlusCircle, Calendar as CalendarIcon, User, Package, RotateCcw, FileSpreadsheet, Pencil, Printer, AlertTriangle, Trash2, BarChart3 } from 'lucide-react';
import { RelatorioMovimentacoesDialog } from './RelatorioMovimentacoesDialog';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { useEstoqueContext } from '@/contexts/EstoqueContext';
import { Movimentacao, TipoMovimentacao } from '@/types/estoque';
import * as XLSX from 'xlsx';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const TabelaMovimentacoes = () => {
  const { movimentacoes, loading } = useEstoqueContext();
  const { isAdmin } = usePermissions();
  const { user } = useAuth();
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<TipoMovimentacao | 'todas'>('todas');
  const [filtroDestino, setFiltroDestino] = useState('todos');
  const [tipoVisualizacao, setTipoVisualizacao] = useState<'todas' | 'saidas' | 'devolucoes' | 'pendentes'>('todas');
  const [filtroPendentesDestino, setFiltroPendentesDestino] = useState('todos');
  const [filtroDataInicio, setFiltroDataInicio] = useState<Date | undefined>(undefined);
  const [filtroDataFim, setFiltroDataFim] = useState<Date | undefined>(undefined);
  const [filtroDataPendentesInicio, setFiltroDataPendentesInicio] = useState<Date | undefined>(undefined);
  const [filtroDataPendentesFim, setFiltroDataPendentesFim] = useState<Date | undefined>(undefined);
  const [usuariosMap, setUsuariosMap] = useState<Record<string, string>>({});
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 20;
  const [relatorioAberto, setRelatorioAberto] = useState(false);
  const { locaisUtilizacao: locaisConfig } = useConfiguracoes();
  const [movimentoEditando, setMovimentoEditando] = useState<Movimentacao | null>(null);
  const [novoLocalId, setNovoLocalId] = useState<string>('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  // Buscar informações dos usuários (para coluna Responsável)
  useEffect(() => {
    const buscarDados = async () => {
      const userIds = [...new Set(movimentacoes.map(m => m.userId).filter(Boolean))];
      
      if (userIds.length > 0) {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, nome')
          .in('user_id', userIds);

        if (!error && data) {
          const map: Record<string, string> = {};
          data.forEach(profile => {
            if (profile.user_id) {
              map[profile.user_id] = profile.nome;
            }
          });
          setUsuariosMap(map);
        }
      }
    };

    buscarDados();
  }, [movimentacoes]);

  const locaisAtivos = useMemo(() => 
    locaisConfig.filter(l => l.ativo).map(l => ({ id: l.id, nome: l.nome })),
    [locaisConfig]
  );

  // Ordenar movimentações por data (mais recente primeiro)
  const movimentacoesOrdenadas = useMemo(() => {
    return [...movimentacoes].sort((a, b) => 
      new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime()
    );
  }, [movimentacoes]);

  // Obter locais de utilização únicos para filtro
  const locaisUtilizacao = useMemo(() => {
    const locais = new Set(
      movimentacoes
        .map(mov => mov.localUtilizacaoNome)
        .filter(Boolean)
    );
    return Array.from(locais).sort();
  }, [movimentacoes]);

  // Verificar se uma movimentação é devolução
  const isDevolucao = (mov: Movimentacao) => {
    return mov.tipo === 'ENTRADA' && 
           mov.observacoes?.toLowerCase().includes('devolução');
  };

  // Calcular itens pendentes de devolução (saíram e não voltaram)
  const itensPendentes = useMemo(() => {
    // Agrupar saídas por item + local
    const saidasMap = new Map<string, { 
      itemSnapshot: any; 
      localUtilizacaoNome: string; 
      totalSaida: number; 
      totalDevolvido: number;
      ultimaSaida: string;
      destinatario?: string;
      solicitacaoId?: string;
      solicitanteNome?: string;
    }>();

    movimentacoes.forEach(mov => {
      if (mov.tipo === 'SAIDA') {
        const key = `${mov.itemSnapshot?.nome || mov.id}_${mov.localUtilizacaoNome || 'sem-local'}`;
        const existing = saidasMap.get(key);
        if (existing) {
          existing.totalSaida += mov.quantidade;
          if (new Date(mov.dataHora) > new Date(existing.ultimaSaida)) {
            existing.ultimaSaida = mov.dataHora;
            existing.destinatario = mov.destinatario;
            existing.solicitacaoId = mov.solicitacaoId;
            existing.solicitanteNome = mov.solicitanteNome;
          }
        } else {
          saidasMap.set(key, {
            itemSnapshot: mov.itemSnapshot,
            localUtilizacaoNome: mov.localUtilizacaoNome || 'Sem local',
            totalSaida: mov.quantidade,
            totalDevolvido: 0,
            ultimaSaida: mov.dataHora,
            destinatario: mov.destinatario,
            solicitacaoId: mov.solicitacaoId,
            solicitanteNome: mov.solicitanteNome,
          });
        }
      }
    });

    // Subtrair devoluções
    movimentacoes.forEach(mov => {
      if (isDevolucao(mov)) {
        const key = `${mov.itemSnapshot?.nome || mov.id}_${mov.localUtilizacaoNome || 'sem-local'}`;
        const existing = saidasMap.get(key);
        if (existing) {
          existing.totalDevolvido += mov.quantidade;
        }
      }
    });

    // Filtrar apenas itens com saldo pendente > 0
    const pendentes = Array.from(saidasMap.entries())
      .filter(([_, v]) => (v.totalSaida - v.totalDevolvido) > 0)
      .map(([key, v]) => ({
        key,
        ...v,
        pendente: v.totalSaida - v.totalDevolvido,
      }))
      .sort((a, b) => new Date(b.ultimaSaida).getTime() - new Date(a.ultimaSaida).getTime());

    return pendentes;
  }, [movimentacoes]);

  // Locais únicos dos pendentes para filtro
  const locaisPendentes = useMemo(() => {
    const locais = new Set(itensPendentes.map(p => p.localUtilizacaoNome));
    return Array.from(locais).sort();
  }, [itensPendentes]);

  // Filtrar pendentes por destino
  const pendentesFiltrados = useMemo(() => {
    let resultado = itensPendentes;
    if (filtroPendentesDestino !== 'todos') {
      resultado = resultado.filter(p => p.localUtilizacaoNome === filtroPendentesDestino);
    }
    if (filtroDataPendentesInicio) {
      const inicio = new Date(filtroDataPendentesInicio);
      inicio.setHours(0, 0, 0, 0);
      resultado = resultado.filter(p => new Date(p.ultimaSaida) >= inicio);
    }
    if (filtroDataPendentesFim) {
      const fim = new Date(filtroDataPendentesFim);
      fim.setHours(23, 59, 59, 999);
      resultado = resultado.filter(p => new Date(p.ultimaSaida) <= fim);
    }
    return resultado;
  }, [itensPendentes, filtroPendentesDestino, filtroDataPendentesInicio, filtroDataPendentesFim]);

  // Filtrar movimentações - lógica unificada
  const movimentacoesFiltradas = useMemo(() => {
    return movimentacoesOrdenadas.filter(mov => {
      const textoFiltro = filtroTexto.toLowerCase();
      const matchTexto = !textoFiltro || 
        mov.itemSnapshot?.nome?.toLowerCase().includes(textoFiltro) ||
        mov.itemSnapshot?.codigoBarras?.toString().includes(textoFiltro) ||
        mov.observacoes?.toLowerCase().includes(textoFiltro);

      let matchTipo = true;
      if (tipoVisualizacao === 'saidas') {
        matchTipo = mov.tipo === 'SAIDA';
      } else if (tipoVisualizacao === 'devolucoes') {
        matchTipo = isDevolucao(mov);
      } else {
        matchTipo = filtroTipo === 'todas' || mov.tipo === filtroTipo;
      }
      
      const matchDestino = filtroDestino === 'todos' || mov.localUtilizacaoNome === filtroDestino;

      let matchData = true;
      if (filtroDataInicio) {
        const inicio = new Date(filtroDataInicio);
        inicio.setHours(0, 0, 0, 0);
        matchData = new Date(mov.dataHora) >= inicio;
      }
      if (matchData && filtroDataFim) {
        const fim = new Date(filtroDataFim);
        fim.setHours(23, 59, 59, 999);
        matchData = new Date(mov.dataHora) <= fim;
      }

      return matchTexto && matchTipo && matchDestino && matchData;
    });
  }, [movimentacoesOrdenadas, filtroTexto, filtroTipo, filtroDestino, tipoVisualizacao, filtroDataInicio, filtroDataFim]);

  // Resetar página quando filtros mudarem
  useEffect(() => {
    setPaginaAtual(1);
  }, [filtroTexto, filtroTipo, filtroDestino, tipoVisualizacao]);

  // Calcular paginação
  const totalPaginas = Math.ceil(movimentacoesFiltradas.length / itensPorPagina);
  const movimentacoesPaginadas = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    return movimentacoesFiltradas.slice(inicio, fim);
  }, [movimentacoesFiltradas, paginaAtual, itensPorPagina]);

  // Estatísticas das movimentações
  const estatisticas = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const movHoje = movimentacoes.filter(mov => 
      new Date(mov.dataHora) >= hoje
    ).length;
    
    const entradas = movimentacoes.filter(mov => 
      mov.tipo === 'ENTRADA' || mov.tipo === 'CADASTRO'
    ).length;
    
    const saidas = movimentacoes.filter(mov => mov.tipo === 'SAIDA').length;
    
    const devolucoes = movimentacoes.filter(mov => isDevolucao(mov)).length;
    
    return {
      total: movimentacoes.length,
      hoje: movHoje,
      entradas,
      saidas,
      devolucoes
    };
  }, [movimentacoes]);

  // Função para exportar movimentações para Excel
  const exportarParaExcel = () => {
    try {
      // Preparar dados para exportação
      const dadosExportacao = movimentacoesFiltradas.map(mov => {
        const eDevolucao = isDevolucao(mov);
        let responsavel = '-';
        const solicitante = mov.solicitanteNome || '-';
        // Para ENTRADA e CADASTRO: mostrar nome do usuário que fez a operação
        if (mov.userId && usuariosMap[mov.userId]) {
          responsavel = usuariosMap[mov.userId];
        }

        return {
          'Tipo': eDevolucao ? 'Devolução' : getTipoInfo(mov.tipo).label,
          'Data': new Date(mov.dataHora).toLocaleDateString('pt-BR'),
          'Hora': new Date(mov.dataHora).toLocaleTimeString('pt-BR'),
          'Item': mov.itemSnapshot?.nome || 'Item não identificado',
          'Código de Barras': mov.itemSnapshot?.codigoBarras || '',
          'Marca': mov.itemSnapshot?.marca || '',
          'Quantidade': `${mov.tipo === 'SAIDA' ? '-' : '+'}${mov.quantidade}`,
          'Unidade': mov.itemSnapshot?.unidade || '',
          'Qtd. Anterior': mov.quantidadeAnterior,
          'Qtd. Atual': mov.quantidadeAtual,
          'Solicitante': solicitante,
          'Responsável': responsavel,
          'Destinatário': mov.destinatario || '-',
          'Estoque/Destino': mov.localUtilizacaoNome || '-',
          'Observações': mov.observacoes && mov.tipo !== 'SAIDA' ? mov.observacoes : '-'
        };
      });

      // Criar workbook
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(dadosExportacao);

      // Definir larguras das colunas
      const columnWidths = [
        { wch: 12 },  // Tipo
        { wch: 12 },  // Data
        { wch: 10 },  // Hora
        { wch: 30 },  // Item
        { wch: 18 },  // Código de Barras
        { wch: 15 },  // Marca
        { wch: 12 },  // Quantidade
        { wch: 10 },  // Unidade
        { wch: 12 },  // Qtd. Anterior
        { wch: 12 },  // Qtd. Atual
        { wch: 20 },  // Responsável
        { wch: 20 },  // Destinatário
        { wch: 20 },  // Estoque/Destino
        { wch: 30 }   // Observações
      ];
      
      worksheet['!cols'] = columnWidths;

      // Adicionar aba
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Movimentações');

      // Gerar nome do arquivo
      const tipoExportacao = tipoVisualizacao === 'todas' ? 'todas' : 
                            tipoVisualizacao === 'saidas' ? 'saidas' : 'devolucoes';
      const dataAtual = new Date().toISOString().split('T')[0];
      const nomeArquivo = `movimentacoes-${tipoExportacao}-${dataAtual}.xlsx`;

      // Baixar arquivo
      XLSX.writeFile(workbook, nomeArquivo);

      toast({
        title: "Exportação concluída!",
        description: `${movimentacoesFiltradas.length} movimentações exportadas com sucesso.`,
      });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast({
        title: "Erro na exportação",
        description: "Não foi possível exportar as movimentações.",
        variant: "destructive",
      });
    }
  };

  // Função para imprimir movimentações
  const imprimirMovimentacoes = async () => {
    // Buscar logo do branding
    let logoHtml = '';
    try {
      const { data, error } = await supabase.storage.from('branding').list('', { limit: 1 });
      if (!error && data && data.length > 0) {
        const { data: publicUrlData } = supabase.storage.from('branding').getPublicUrl(data[0].name);
        if (publicUrlData.publicUrl) {
          logoHtml = `<img src="${publicUrlData.publicUrl}" alt="Logo" style="height:50px;object-fit:contain;" />`;
        }
      }
    } catch (e) { console.error('Erro ao carregar logo:', e); }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: "Erro", description: "Não foi possível abrir a janela de impressão. Verifique se pop-ups estão habilitados.", variant: "destructive" });
      return;
    }

    const linhas = movimentacoesFiltradas.map(mov => {
      const eDevolucao = isDevolucao(mov);
      let responsavel = '-';
      const solicitante = mov.solicitanteNome || '-';
      if (mov.userId && usuariosMap[mov.userId]) {
        responsavel = usuariosMap[mov.userId];
      }

      return `<tr>
        <td>${eDevolucao ? 'Devolução' : getTipoInfo(mov.tipo).label}</td>
        <td>${new Date(mov.dataHora).toLocaleDateString('pt-BR')} ${new Date(mov.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
        <td>${mov.itemSnapshot?.nome || '-'}</td>
        <td>${mov.itemSnapshot?.codigoBarras || '-'}</td>
        <td>${mov.tipo === 'SAIDA' ? '-' : '+'}${mov.quantidade}</td>
        <td>${solicitante}</td>
        <td>${responsavel}</td>
        <td>${mov.destinatario || '-'}</td>
        <td>${mov.localUtilizacaoNome || '-'}</td>
        <td>${mov.observacoes && mov.tipo !== 'SAIDA' ? mov.observacoes : '-'}</td>
      </tr>`;
    }).join('');

    const filtrosAtivos = [];
    if (tipoVisualizacao !== 'todas') filtrosAtivos.push(`Tipo: ${tipoVisualizacao === 'saidas' ? 'Saídas' : 'Devoluções'}`);
    if (filtroTipo !== 'todas' && tipoVisualizacao === 'todas') filtrosAtivos.push(`Tipo: ${getTipoInfo(filtroTipo as TipoMovimentacao).label}`);
    if (filtroDestino !== 'todos') filtrosAtivos.push(`Estoque/Destino: ${filtroDestino}`);
    if (filtroTexto) filtrosAtivos.push(`Busca: ${filtroTexto}`);

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Movimentações</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; }
        .header { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; border-bottom: 2px solid #2980b3; padding-bottom: 8px; }
        .header h1 { font-size: 16px; margin: 0; }
        .info { color: #666; margin-bottom: 12px; font-size: 10px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
        th { background: #2980b3; color: white; font-size: 10px; }
        tr:nth-child(even) { background: #f8f8f8; }
        @media print { body { margin: 10px; } }
      </style></head><body>
      <div class="header">${logoHtml}<h1>Relatório de Movimentações</h1></div>
      <div class="info">Gerado em: ${new Date().toLocaleString('pt-BR')} | Total: ${movimentacoesFiltradas.length} registros${filtrosAtivos.length > 0 ? ' | Filtros: ' + filtrosAtivos.join(', ') : ''}</div>
      <table><thead><tr>
        <th>Tipo</th><th>Data/Hora</th><th>Item</th><th>Código</th><th>Qtd</th><th>Solicitante</th><th>Responsável</th><th>Destinatário</th><th>Estoque/Destino</th><th>Observações</th>
      </tr></thead><tbody>${linhas}</tbody></table>
      <script>window.print();window.onafterprint=()=>window.close();</script>
    </body></html>`);
    printWindow.document.close();
  };

  // Função para obter ícone e cor do tipo de movimentação
  const getTipoInfo = (tipo: TipoMovimentacao) => {
    switch (tipo) {
      case 'ENTRADA':
        return {
          icon: <ArrowUpCircle className="h-4 w-4" />,
          color: 'text-info',
          bgColor: 'bg-info/10',
          label: 'Entrada'
        };
      case 'SAIDA':
        return {
          icon: <ArrowDownCircle className="h-4 w-4" />,
          color: 'text-warning',
          bgColor: 'bg-warning/10',
          label: 'Saída'
        };
      case 'CADASTRO':
        return {
          icon: <PlusCircle className="h-4 w-4" />,
          color: 'text-success',
          bgColor: 'bg-success/10',
          label: 'Cadastro'
        };
      default:
        return {
          icon: <Package className="h-4 w-4" />,
          color: 'text-muted-foreground',
          bgColor: 'bg-muted',
          label: tipo
        };
    }
  };

  // Função para formatar data e hora
  const formatarDataHora = (data: string) => {
    const date = new Date(data);
    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);
    
    let prefixo = '';
    if (date.toDateString() === hoje.toDateString()) {
      prefixo = 'Hoje ';
    } else if (date.toDateString() === ontem.toDateString()) {
      prefixo = 'Ontem ';
    }
    
    return prefixo + date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: date.getFullYear() !== hoje.getFullYear() ? 'numeric' : undefined,
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSalvarEdicaoDestino = async () => {
    if (!movimentoEditando || !novoLocalId) return;
    
    setSalvandoEdicao(true);
    try {
      const localSelecionado = locaisAtivos.find(l => l.id === novoLocalId);
      
      const { error } = await supabase
        .from('movements')
        .update({ 
          local_utilizacao_id: novoLocalId
        })
        .eq('id', movimentoEditando.id);
        
      if (error) throw error;
      
      // Registrar log de auditoria
      await supabase.from('action_logs').insert({
        user_id: user?.id,
        action: 'EDICAO_DESTINO_MOVIMENTACAO',
        entity_type: 'movements',
        entity_id: movimentoEditando.id,
        details: {
          antigo_local_id: movimentoEditando.localUtilizacaoId,
          antigo_local_nome: movimentoEditando.localUtilizacaoNome,
          novo_local_id: novoLocalId,
          novo_local_nome: localSelecionado?.nome,
          item_nome: movimentoEditando.itemSnapshot?.nome
        }
      });
      
      toast({
        title: "Destino atualizado",
        description: "O local de destino da movimentação foi alterado com sucesso."
      });
      
      setMovimentoEditando(null);
    } catch (error: any) {
      console.error('Erro ao atualizar destino:', error);
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível alterar o destino.",
        variant: "destructive"
      });
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const excluirMovimentacao = async (movId: string) => {
    try {
      const { error } = await supabase.from('movements').delete().eq('id', movId);
      if (error) throw error;
      toast({ title: "Movimentação excluída", description: "O registro foi removido com sucesso." });
    } catch (error: any) {
      console.error('Erro ao excluir movimentação:', error);
      toast({ title: "Erro ao excluir", description: error.message || "Não foi possível excluir a movimentação.", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
          <p className="text-muted-foreground">Carregando movimentações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs para tipo de visualização */}
      <Tabs value={tipoVisualizacao} onValueChange={(value) => setTipoVisualizacao(value as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="todas" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Todas
          </TabsTrigger>
          <TabsTrigger value="saidas" className="flex items-center gap-2">
            <ArrowDownCircle className="h-4 w-4" />
            Saídas
          </TabsTrigger>
          <TabsTrigger value="devolucoes" className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Devoluções
          </TabsTrigger>
          <TabsTrigger value="pendentes" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Pendentes ({itensPendentes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tipoVisualizacao} className="space-y-6">
          {/* Estatísticas */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">{estatisticas.total}</p>
                  </div>
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Hoje</p>
                    <p className="text-2xl font-bold text-primary">{estatisticas.hoje}</p>
                  </div>
                  <CalendarIcon className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Entradas</p>
                    <p className="text-2xl font-bold text-success">{estatisticas.entradas}</p>
                  </div>
                  <ArrowUpCircle className="h-8 w-8 text-success" />
                </div>
              </CardContent>
            </Card>
        
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Saídas</p>
                    <p className="text-2xl font-bold text-warning">{estatisticas.saidas}</p>
                  </div>
                  <ArrowDownCircle className="h-8 w-8 text-warning" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Devoluções</p>
                    <p className="text-2xl font-bold text-info">{estatisticas.devolucoes}</p>
                  </div>
                  <RotateCcw className="h-8 w-8 text-info" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filtros de Movimentação
          </CardTitle>
          <CardDescription>
            Filtre as movimentações por tipo, responsável ou termo de busca
          </CardDescription>
        </CardHeader>
        <CardContent>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por item, código, responsável..."
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                className="pl-10"
              />
            </div>
            
             <Select 
               value={tipoVisualizacao !== 'todas' ? (tipoVisualizacao === 'saidas' ? 'SAIDA' : 'DEVOLUCAO') : filtroTipo} 
               onValueChange={(value) => setFiltroTipo(value as any)}
               disabled={tipoVisualizacao !== 'todas'}
             >
              <SelectTrigger>
                <SelectValue placeholder="Tipo de movimentação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos os tipos</SelectItem>
                <SelectItem value="ENTRADA">Entradas</SelectItem>
                <SelectItem value="SAIDA">Saídas</SelectItem>
                <SelectItem value="CADASTRO">Cadastros</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filtroDestino} onValueChange={setFiltroDestino}>
              <SelectTrigger>
                <SelectValue placeholder="Estoque/Destino" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os estoques/destinos</SelectItem>
                {locaisUtilizacao.map(local => (
                  <SelectItem key={local} value={local!}>
                    {local}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={filtroDataInicio ? format(filtroDataInicio, "yyyy-MM-dd") : ""}
                onChange={(e) => setFiltroDataInicio(e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined)}
                className="pl-10"
                placeholder="Data início"
              />
            </div>

            <div className="relative">
              <CalendarIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={filtroDataFim ? format(filtroDataFim, "yyyy-MM-dd") : ""}
                onChange={(e) => setFiltroDataFim(e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined)}
                className="pl-10"
                placeholder="Data fim"
              />
            </div>

            <div className="flex gap-2 md:col-span-2">
              <Button 
                onClick={() => setRelatorioAberto(true)}
                variant="default"
                className="flex items-center gap-2 flex-1"
              >
                <BarChart3 className="h-4 w-4" />
                Relatórios
              </Button>
              <Button 
                onClick={exportarParaExcel}
                variant="outline"
                className="flex items-center gap-2 flex-1"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Exportar Excel
              </Button>
              <Button 
                onClick={imprimirMovimentacoes}
                variant="outline"
                className="flex items-center gap-2 flex-1"
              >
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
            </div>
          </div>
          
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">
              Mostrando {movimentacoesFiltradas.length} de {movimentacoes.length} movimentações
            </p>
          </div>
          </CardContent>
          </Card>

          {/* Tabela de Movimentações */}
          <Card>
        <CardHeader>
          <CardTitle>📋 Histórico de Movimentações</CardTitle>
          <CardDescription>
            Registro completo de todas as movimentações do estoque
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
            <Table style={{ minWidth: isAdmin() ? '1650px' : '1550px' }}>
              <TableHeader>
                <TableRow>
                  {isAdmin() && <TableHead className="w-[50px]"></TableHead>}
                  <TableHead>Tipo</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Anterior</TableHead>
                  <TableHead>Atual</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Destinatário</TableHead>
                  <TableHead>Estoque/Destino</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimentacoesFiltradas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin() ? 13 : 12} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <Package className="h-12 w-12 text-muted-foreground" />
                        <p className="text-muted-foreground">
                          {movimentacoes.length === 0 
                            ? "Nenhuma movimentação registrada" 
                            : "Nenhuma movimentação encontrada com os filtros aplicados"
                          }
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  movimentacoesPaginadas.map((mov) => {
                    const tipoInfo = getTipoInfo(mov.tipo);
                    const eDevolucao = isDevolucao(mov);
                    
                    return (
                      <TableRow key={mov.id} className="hover:bg-muted/50">
                        {isAdmin() && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                onClick={() => {
                                  setMovimentoEditando(mov);
                                  setNovoLocalId(mov.localUtilizacaoId || '');
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir movimentação?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Deseja excluir o registro de {eDevolucao ? 'devolução' : tipoInfo.label.toLowerCase()} do item "{mov.itemSnapshot?.nome}" ({mov.quantidade} {mov.itemSnapshot?.unidade})? Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => excluirMovimentacao(mov.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        )}
                        <TableCell>
                          <div className={`flex items-center gap-2 ${eDevolucao ? 'text-info' : tipoInfo.color}`}>
                            <div className={`p-1.5 rounded-full ${eDevolucao ? 'bg-info/10' : tipoInfo.bgColor}`}>
                              {eDevolucao ? <RotateCcw className="h-4 w-4" /> : tipoInfo.icon}
                            </div>
                            <span className="font-medium">{eDevolucao ? 'Devolução' : tipoInfo.label}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {formatarDataHora(mov.dataHora)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{mov.itemSnapshot?.nome || 'Item não identificado'}</p>
                            {mov.itemSnapshot?.marca && (
                              <p className="text-xs text-muted-foreground">{mov.itemSnapshot.marca}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {mov.itemSnapshot?.codigoBarras}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className={`font-bold ${tipoInfo.color}`}>
                              {mov.tipo === 'SAIDA' ? '-' : '+'}{mov.quantidade.toLocaleString('pt-BR')}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {mov.itemSnapshot?.unidade}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {mov.quantidadeAnterior.toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {mov.quantidadeAtual.toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {mov.solicitanteNome ? (
                              <Badge variant="outline" className={eDevolucao ? "bg-info/10 text-info border-info/20" : "bg-primary/10 text-primary border-primary/20"}>
                                {mov.solicitanteNome}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {mov.userId && usuariosMap[mov.userId] ? (
                              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                                {usuariosMap[mov.userId]}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {mov.destinatario ? (
                            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                              {mov.destinatario}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {mov.localUtilizacaoNome ? (
                            <span className="text-sm">{mov.localUtilizacaoNome}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {mov.observacoes && mov.tipo !== 'SAIDA' ? (
                            <span className="text-sm">{mov.observacoes}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Paginação */}
          {totalPaginas > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {((paginaAtual - 1) * itensPorPagina) + 1} a {Math.min(paginaAtual * itensPorPagina, movimentacoesFiltradas.length)} de {movimentacoesFiltradas.length} movimentações
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setPaginaAtual(prev => Math.max(1, prev - 1))}
                      className={paginaAtual === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((pagina) => {
                    // Mostrar sempre primeira, última, atual e adjacentes
                    const mostrar = 
                      pagina === 1 || 
                      pagina === totalPaginas || 
                      Math.abs(pagina - paginaAtual) <= 1;
                    
                    if (!mostrar) {
                      // Mostrar elipses
                      if (pagina === 2 && paginaAtual > 3) {
                        return (
                          <PaginationItem key={pagina}>
                            <span className="px-2">...</span>
                          </PaginationItem>
                        );
                      }
                      if (pagina === totalPaginas - 1 && paginaAtual < totalPaginas - 2) {
                        return (
                          <PaginationItem key={pagina}>
                            <span className="px-2">...</span>
                          </PaginationItem>
                        );
                      }
                      return null;
                    }
                    
                    return (
                      <PaginationItem key={pagina}>
                        <PaginationLink
                          onClick={() => setPaginaAtual(pagina)}
                          isActive={paginaAtual === pagina}
                          className="cursor-pointer"
                        >
                          {pagina}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setPaginaAtual(prev => Math.min(totalPaginas, prev + 1))}
                      className={paginaAtual === totalPaginas ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Pendentes de Devolução */}
        <TabsContent value="pendentes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Itens Pendentes de Devolução
              </CardTitle>
              <CardDescription>
                Itens que saíram do estoque e ainda não foram devolvidos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <Select value={filtroPendentesDestino} onValueChange={setFiltroPendentesDestino}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por Estoque/Destino" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os estoques/destinos</SelectItem>
                    {locaisPendentes.map(local => (
                      <SelectItem key={local} value={local}>
                        {local}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={filtroDataPendentesInicio ? format(filtroDataPendentesInicio, "yyyy-MM-dd") : ""}
                    onChange={(e) => setFiltroDataPendentesInicio(e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined)}
                    className="pl-10"
                    placeholder="Data início"
                  />
                </div>

                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={filtroDataPendentesFim ? format(filtroDataPendentesFim, "yyyy-MM-dd") : ""}
                    onChange={(e) => setFiltroDataPendentesFim(e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined)}
                    className="pl-10"
                    placeholder="Data fim"
                  />
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-4">
                {pendentesFiltrados.length} item(ns) pendente(s) de devolução
              </p>

              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Estoque/Destino</TableHead>
                      <TableHead>Total Saída</TableHead>
                      <TableHead>Devolvido</TableHead>
                      <TableHead>Pendente</TableHead>
                      <TableHead>Última Saída</TableHead>
                      <TableHead>Destinatário</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendentesFiltrados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <div className="flex flex-col items-center gap-2">
                            <Package className="h-12 w-12 text-muted-foreground" />
                            <p className="text-muted-foreground">
                              Nenhum item pendente de devolução
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendentesFiltrados.map((item) => (
                        <TableRow key={item.key}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.itemSnapshot?.nome || 'Item não identificado'}</p>
                              {item.itemSnapshot?.marca && (
                                <p className="text-xs text-muted-foreground">{item.itemSnapshot.marca}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {item.itemSnapshot?.codigoBarras || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.localUtilizacaoNome}</Badge>
                          </TableCell>
                          <TableCell className="text-warning font-bold">
                            {item.totalSaida.toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell className="text-info font-bold">
                            {item.totalDevolvido.toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="destructive" className="font-bold">
                              {item.pendente.toLocaleString('pt-BR')} {item.itemSnapshot?.unidade || ''}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {new Date(item.ultimaSaida).toLocaleDateString('pt-BR', {
                              day: '2-digit', month: '2-digit', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </TableCell>
                          <TableCell>
                            {item.destinatario ? (
                              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                                {item.destinatario}
                              </Badge>
                            ) : item.solicitanteNome ? (
                              <Badge variant="outline">{item.solicitanteNome}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Dialog open={!!movimentoEditando} onOpenChange={(open) => !open && setMovimentoEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Destino da Movimentação</DialogTitle>
            <DialogDescription>
              Altere o local de utilização/destino para esta movimentação de "{movimentoEditando?.itemSnapshot?.nome}".
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Novo Local de Destino</label>
              <Select value={novoLocalId} onValueChange={setNovoLocalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um local" />
                </SelectTrigger>
                <SelectContent>
                  {locaisAtivos.map(local => (
                    <SelectItem key={local.id} value={local.id}>
                      {local.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="bg-muted p-3 rounded-md text-sm space-y-1">
              <p><strong>Item:</strong> {movimentoEditando?.itemSnapshot?.nome}</p>
              <p><strong>Quantidade:</strong> {movimentoEditando?.quantidade} {movimentoEditando?.itemSnapshot?.unidade}</p>
              <p><strong>Local Atual:</strong> {movimentoEditando?.localUtilizacaoNome || 'Nenhum'}</p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovimentoEditando(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvarEdicaoDestino} disabled={salvandoEdicao || !novoLocalId}>
              {salvandoEdicao ? "Salvando..." : "Salvar Alteração"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RelatorioMovimentacoesDialog
        aberto={relatorioAberto}
        onClose={() => setRelatorioAberto(false)}
        movimentacoes={movimentacoes}
      />
    </div>
  );
};