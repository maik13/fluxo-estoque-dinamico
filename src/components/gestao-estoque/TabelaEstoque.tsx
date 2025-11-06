import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Download, AlertTriangle, Package, TrendingUp, TrendingDown, Edit, FileText, FileSpreadsheet, Printer } from 'lucide-react';
import { useEstoque } from '@/hooks/useEstoque';
import { EstoqueItem } from '@/types/estoque';
import { DialogoEditarItem } from './DialogoEditarItem';
import { EditarQuantidadeInline } from './EditarQuantidadeInline';
import { gerarRelatorioPDF } from '@/utils/pdfExport';
import { supabase } from '@/integrations/supabase/client';
import { exportarExcel } from '@/utils/excelExport';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { usePermissions } from '@/hooks/usePermissions';

export const TabelaEstoque = () => {
  const { obterEstoque, loading, editarItem, registrarEntrada, registrarSaida } = useEstoque();
  const { obterEstoqueAtivoInfo } = useConfiguracoes();
  const { canEditItems } = usePermissions();
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [filtroCondicao, setFiltroCondicao] = useState('todas');
  const [filtroEstoque, setFiltroEstoque] = useState('todos'); // todos, baixo, zerado
  
  // Estados para edição
  const [dialogoEdicao, setDialogoEdicao] = useState(false);
  const [itemParaEditar, setItemParaEditar] = useState<EstoqueItem | null>(null);

  // Obter dados do estoque
  const estoque = useMemo(() => obterEstoque(), [obterEstoque]);
  
  // Obter categorias únicas para filtro
  const categorias = useMemo(() => {
    return [];
  }, [estoque]);

  // Filtrar itens baseado nos filtros ativos
  const itensFiltrados = useMemo(() => {
    return estoque.filter(item => {
      // Filtro por texto (busca em nome, código, marca, especificação)
      const textoFiltro = filtroTexto.toLowerCase();
      const matchTexto = !textoFiltro || 
        item.nome.toLowerCase().includes(textoFiltro) ||
        item.codigoBarras.toString().includes(textoFiltro) ||
        item.marca.toLowerCase().includes(textoFiltro) ||
        item.especificacao.toLowerCase().includes(textoFiltro);

      // Filtro por categoria
      const matchCategoria = filtroCategoria === 'todas' || false;
      
      // Filtro por condição
      const matchCondicao = filtroCondicao === 'todas' || item.condicao === filtroCondicao;
      
      // Filtro por nível de estoque
      let matchEstoque = true;
      if (filtroEstoque === 'baixo') {
        matchEstoque = item.quantidadeMinima ? item.estoqueAtual <= item.quantidadeMinima : false;
      } else if (filtroEstoque === 'zerado') {
        matchEstoque = item.estoqueAtual === 0;
      }

      return matchTexto && matchCategoria && matchCondicao && matchEstoque;
    });
  }, [estoque, filtroTexto, filtroCategoria, filtroCondicao, filtroEstoque]);

  // Estatísticas do estoque
  const estatisticas = useMemo(() => {
    const total = estoque.length;
    const comEstoque = estoque.filter(item => item.estoqueAtual > 0).length;
    const estoqueZero = estoque.filter(item => item.estoqueAtual === 0).length;
    const estoqueBaixo = estoque.filter(item => 
      item.quantidadeMinima && item.estoqueAtual <= item.quantidadeMinima
    ).length;

    return { total, comEstoque, estoqueZero, estoqueBaixo };
  }, [estoque]);

  // Função para obter cor do badge baseado no estoque
  const getEstoqueBadge = (item: EstoqueItem) => {
    if (item.estoqueAtual === 0) {
      return <Badge variant="destructive" className="flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        Zerado
      </Badge>;
    }
    
    if (item.quantidadeMinima && item.estoqueAtual <= item.quantidadeMinima) {
      return <Badge variant="outline" className="border-warning text-warning flex items-center gap-1">
        <TrendingDown className="h-3 w-3" />
        Baixo
      </Badge>;
    }
    
    return <Badge variant="outline" className="border-success text-success flex items-center gap-1">
      <TrendingUp className="h-3 w-3" />
      OK
    </Badge>;
  };

  // Função para formatar data
  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Função para exportar dados em CSV
  const exportarCSV = () => {
    const dadosExport = itensFiltrados.map(item => ({
      'Código': item.codigoBarras,
      'Nome': item.nome,
      'Marca': item.marca,
      'Especificação': item.especificacao,
      'Localização': item.localizacao,
      'Caixa/Organizador': item.caixaOrganizador,
      'Estoque Atual': item.estoqueAtual,
      'Quantidade Mínima': item.quantidadeMinima,
      'Unidade': item.unidade,
      'Condição': item.condicao,
      'Última Movimentação': item.ultimaMovimentacao ? formatarData(item.ultimaMovimentacao.dataHora) : ''
    }));

    const headers = Object.keys(dadosExport[0] || {});
    const csvContent = [
      headers.join(','),
      ...dadosExport.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio-estoque-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Função para exportar dados em PDF
  const exportarPDF = async () => {
    const estoqueInfo = obterEstoqueAtivoInfo();
    await gerarRelatorioPDF({
      titulo: 'RELATÓRIO DE ESTOQUE',
      nomeEstoque: estoqueInfo?.nome || 'Estoque Atual',
      itens: itensFiltrados
    });
  };

  // Função para editar quantidade diretamente
  const handleEditarQuantidade = async (itemId: string, novaQuantidade: number): Promise<boolean> => {
    const item = estoque.find(i => i.id === itemId);
    if (!item) return false;

    const diferenca = novaQuantidade - item.estoqueAtual;
    
    if (diferenca > 0) {
      // Entrada
      return await registrarEntrada(item.codigoBarras, diferenca, 'Sistema', 'Ajuste de estoque');
    } else if (diferenca < 0) {
      // Saída
      return await registrarSaida(item.codigoBarras, Math.abs(diferenca), 'Sistema', 'Ajuste de estoque');
    }
    
    return true; // Sem alteração
  };

  // Função para exportar dados em Excel
  const exportarExcelCompleto = () => {
    const estoqueInfo = obterEstoqueAtivoInfo();
    exportarExcel({
      titulo: 'RELATÓRIO DE ESTOQUE',
      nomeEstoque: estoqueInfo?.nome || 'Estoque Atual',
      itens: itensFiltrados,
      incluirEstatisticas: true
    });
  };

  // Função para imprimir página atual
  const imprimirPagina = () => {
    window.print();
  };

  // Função para editar item
  const handleEditarItem = (item: EstoqueItem) => {
    setItemParaEditar(item);
    setDialogoEdicao(true);
  };

  // Função para salvar edição
  const handleSalvarEdicao = async (itemEditado: any) => {
    return await editarItem(itemEditado);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
          <p className="text-muted-foreground">Carregando estoque...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Itens</p>
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
                <p className="text-sm text-muted-foreground">Com Estoque</p>
                <p className="text-2xl font-bold text-success">{estatisticas.comEstoque}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Estoque Baixo</p>
                <p className="text-2xl font-bold text-warning">{estatisticas.estoqueBaixo}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Zerados</p>
                <p className="text-2xl font-bold text-destructive">{estatisticas.estoqueZero}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros e Busca
          </CardTitle>
          <CardDescription>
            Use os filtros abaixo para encontrar itens específicos no estoque
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, código, marca..."
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                {categorias.map(categoria => (
                  <SelectItem key={categoria} value={categoria}>
                    {categoria}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={filtroCondicao} onValueChange={setFiltroCondicao}>
              <SelectTrigger>
                <SelectValue placeholder="Condição" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as condições</SelectItem>
                <SelectItem value="Novo">Novo</SelectItem>
                <SelectItem value="Usado">Usado</SelectItem>
                <SelectItem value="Defeito">Defeito</SelectItem>
                <SelectItem value="Descarte">Descarte</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filtroEstoque} onValueChange={setFiltroEstoque}>
              <SelectTrigger>
                <SelectValue placeholder="Nível de Estoque" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os níveis</SelectItem>
                <SelectItem value="baixo">Estoque baixo</SelectItem>
                <SelectItem value="zerado">Estoque zerado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex justify-between items-center mt-4">
            <p className="text-sm text-muted-foreground">
              Mostrando {itensFiltrados.length} de {estoque.length} itens
            </p>
            <div className="flex gap-2">
              <Button onClick={imprimirPagina} variant="outline" size="sm">
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
              <Button onClick={exportarPDF} variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                PDF Estoque
              </Button>
              <Button onClick={exportarExcelCompleto} variant="outline" size="sm">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>📦 Estoque Atual</CardTitle>
          <CardDescription>
            Visualização completa do estoque com informações detalhadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Marca</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Condição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última Mov.</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itensFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <Package className="h-12 w-12 text-muted-foreground" />
                        <p className="text-muted-foreground">
                          {estoque.length === 0 
                            ? "Nenhum item cadastrado no estoque" 
                            : "Nenhum item encontrado com os filtros aplicados"
                          }
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  itensFiltrados.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">
                        {item.codigoBarras}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.nome}</p>
                          {item.especificacao && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {item.especificacao}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.tipoItem === 'Ferramenta' ? 'default' : 'secondary'}>
                          {item.tipoItem}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.marca}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{item.localizacao}</p>
                          {item.caixaOrganizador && (
                            <p className="text-xs text-muted-foreground">{item.caixaOrganizador}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <EditarQuantidadeInline
                          item={item}
                          onSalvar={handleEditarQuantidade}
                          disabled={false}
                        />
                      </TableCell>
                      <TableCell>{item.unidade}</TableCell>
                      <TableCell>
                        <Badge variant={item.condicao === 'Novo' ? 'default' : 'secondary'}>
                          {item.condicao}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getEstoqueBadge(item)}
                      </TableCell>
                      <TableCell>
                          <TableCell>{item.ultimaMovimentacao ? (
                            <div className="text-xs">
                              <p>{formatarData(item.ultimaMovimentacao.dataHora)}</p>
                              <p className="text-muted-foreground">
                                {item.ultimaMovimentacao.tipo}
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">Sem movimentação</span>
                          )}</TableCell>
                      </TableCell>
                      <TableCell>
                        <Button
                          onClick={() => handleEditarItem(item)}
                          variant="ghost"
                          size="sm"
                          disabled={!canEditItems}
                          title={!canEditItems ? "Sem permissão para editar itens" : "Editar item"}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo de Edição */}
      <DialogoEditarItem
        aberto={dialogoEdicao}
        onClose={() => {
          setDialogoEdicao(false);
          setItemParaEditar(null);
        }}
        item={itemParaEditar}
        onSalvar={handleSalvarEdicao}
      />
    </div>
  );
};
