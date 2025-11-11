import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, ArrowUpCircle, ArrowDownCircle, PlusCircle, Calendar, User, Package, RotateCcw, FileSpreadsheet } from 'lucide-react';
import { useEstoque } from '@/hooks/useEstoque';
import { Movimentacao, TipoMovimentacao } from '@/types/estoque';
import * as XLSX from 'xlsx';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const TabelaMovimentacoes = () => {
  const { movimentacoes, loading } = useEstoque();
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<TipoMovimentacao | 'todas'>('todas');
  const [filtroDestino, setFiltroDestino] = useState('todos');
  const [tipoVisualizacao, setTipoVisualizacao] = useState<'todas' | 'saidas' | 'devolucoes'>('todas');
  const [solicitantesMap, setSolicitantesMap] = useState<Record<string, string>>({});
  const [usuariosMap, setUsuariosMap] = useState<Record<string, string>>({});

  // Buscar informações dos solicitantes e usuários
  useEffect(() => {
    const buscarDados = async () => {
      // Buscar solicitantes (para saídas/devoluções)
      const solicitacaoIds = [...new Set(movimentacoes.map(m => m.solicitacaoId).filter(Boolean))];
      
      if (solicitacaoIds.length > 0) {
        const { data, error } = await supabase
          .from('solicitacoes')
          .select('id, solicitante_nome')
          .in('id', solicitacaoIds);

        if (!error && data) {
          const map: Record<string, string> = {};
          data.forEach(solicitacao => {
            if (solicitacao.id) {
              map[solicitacao.id] = solicitacao.solicitante_nome;
            }
          });
          setSolicitantesMap(map);
        }
      }

      // Buscar usuários (para entradas/cadastros)
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

  // Filtrar movimentações
  const movimentacoesFiltradas = useMemo(() => {
    return movimentacoesOrdenadas.filter(mov => {
      // Filtro por texto (busca em nome do item, observações)
      const textoFiltro = filtroTexto.toLowerCase();
      const matchTexto = !textoFiltro || 
        mov.itemSnapshot?.nome?.toLowerCase().includes(textoFiltro) ||
        mov.itemSnapshot?.codigoBarras?.toString().includes(textoFiltro) ||
        mov.observacoes?.toLowerCase().includes(textoFiltro);

      // Filtro por tipo
      const matchTipo = filtroTipo === 'todas' || mov.tipo === filtroTipo;
      
      // Filtro por local de utilização (Estoque/Destino)
      const matchDestino = filtroDestino === 'todos' || mov.localUtilizacaoNome === filtroDestino;

      // Filtro por tipo de visualização
      let matchVisualizacao = true;
      if (tipoVisualizacao === 'saidas') {
        matchVisualizacao = mov.tipo === 'SAIDA';
      } else if (tipoVisualizacao === 'devolucoes') {
        matchVisualizacao = isDevolucao(mov);
      }

      return matchTexto && matchTipo && matchDestino && matchVisualizacao;
    });
  }, [movimentacoesOrdenadas, filtroTexto, filtroTipo, filtroDestino, tipoVisualizacao]);

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
        
        // Para SAÍDA e DEVOLUÇÃO: mostrar nome do solicitante
        if (mov.solicitacaoId && solicitantesMap[mov.solicitacaoId]) {
          responsavel = solicitantesMap[mov.solicitacaoId];
        } 
        // Para ENTRADA e CADASTRO: mostrar nome do usuário que fez a operação
        else if ((mov.tipo === 'ENTRADA' || mov.tipo === 'CADASTRO') && mov.userId && usuariosMap[mov.userId]) {
          responsavel = usuariosMap[mov.userId];
        } 
        // Fallback para localização
        else if (mov.itemSnapshot?.localizacao) {
          responsavel = mov.itemSnapshot.localizacao;
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
          'Responsável': responsavel,
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
        <TabsList className="grid w-full grid-cols-3 mb-6">
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
                  <Calendar className="h-8 w-8 text-primary" />
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por item, código, responsável..."
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filtroTipo} onValueChange={(value) => setFiltroTipo(value as any)}>
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

            <Button 
              onClick={exportarParaExcel}
              variant="outline"
              className="flex items-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Exportar Excel
            </Button>
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
          <ScrollArea className="h-[600px] w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Anterior</TableHead>
                  <TableHead>Atual</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Estoque/Destino</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimentacoesFiltradas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
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
                  movimentacoesFiltradas.map((mov) => {
                    const tipoInfo = getTipoInfo(mov.tipo);
                    const eDevolucao = isDevolucao(mov);
                    
                    return (
                      <TableRow key={mov.id} className="hover:bg-muted/50">
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
                            {/* Para SAÍDA e DEVOLUÇÃO: mostrar solicitante */}
                            {mov.solicitacaoId && solicitantesMap[mov.solicitacaoId] ? (
                              <Badge variant="outline" className={eDevolucao ? "bg-info/10 text-info border-info/20" : ""}>
                                {solicitantesMap[mov.solicitacaoId]}
                              </Badge>
                            ) 
                            /* Para ENTRADA e CADASTRO: mostrar usuário que fez a operação */
                            : (mov.tipo === 'ENTRADA' || mov.tipo === 'CADASTRO') && mov.userId && usuariosMap[mov.userId] ? (
                              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                                {usuariosMap[mov.userId]}
                              </Badge>
                            ) 
                            /* Fallback */
                            : mov.itemSnapshot?.localizacao ? (
                              <span className="text-muted-foreground">{mov.itemSnapshot.localizacao}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </div>
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
          </ScrollArea>
        </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};