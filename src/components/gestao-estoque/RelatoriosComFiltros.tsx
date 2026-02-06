import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { FileBarChart, Filter, Download, X } from 'lucide-react';
import { useEstoqueContext } from '@/contexts/EstoqueContext';
import { EstoqueItem } from '@/types/estoque';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FiltrosRelatorio {
  observacao: string;
  nomeItem: string;
  categoria: string;
  subcategoria: string;
  dataInicio: string;
  dataFim: string;
  localizacao: string;
  apenasSemEstoque: boolean;
  apenasComEstoque: boolean;
}

const filtrosIniciais: FiltrosRelatorio = {
  observacao: '',
  nomeItem: '',
  categoria: '',
  subcategoria: '',
  dataInicio: '',
  dataFim: '',
  localizacao: '',
  apenasSemEstoque: false,
  apenasComEstoque: false
};

export const RelatoriosComFiltros = () => {
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosRelatorio>(filtrosIniciais);
  const { obterEstoque, movimentacoes } = useEstoqueContext();

  const itensEstoque = obterEstoque();
  
  // Obter valores únicos para os filtros
  const categorias = useMemo(() => {
    return [];
  }, [itensEstoque]);

  const subcategorias = useMemo(() => {
    return [];
  }, [itensEstoque]);

  const responsaveis = useMemo(() => {
    const resps = new Set<string>();
    return Array.from(resps).sort();
  }, [itensEstoque]);

  const localizacoes = useMemo(() => {
    const locs = new Set(itensEstoque.map(item => item.localizacao).filter(Boolean));
    return Array.from(locs).sort();
  }, [itensEstoque]);

  // Aplicar filtros
  const itensFiltrados = useMemo(() => {
    let itemsFiltrados = [...itensEstoque];

    // Filtro por nome do item
    if (filtros.nomeItem) {
      itemsFiltrados = itemsFiltrados.filter(item =>
        item.nome.toLowerCase().includes(filtros.nomeItem.toLowerCase())
      );
    }

    // Filtro por categoria
    if (filtros.categoria) {
      itemsFiltrados = itemsFiltrados.filter(item => false);
    }

    // Filtro por subcategoria
    if (filtros.subcategoria) {
      itemsFiltrados = itemsFiltrados.filter(item => false);
    }

    // Filtro por localização
    if (filtros.localizacao) {
      itemsFiltrados = itemsFiltrados.filter(item => 
        item.localizacao === filtros.localizacao
      );
    }

    // Filtro por data não pode ser aplicado pois removemos dataCriacao
    // Se precisar, use created_at diretamente do banco de dados

    // Filtro por estoque zerado
    if (filtros.apenasSemEstoque) {
      itemsFiltrados = itemsFiltrados.filter(item => item.estoqueAtual === 0);
    }

    // Filtro por itens com estoque
    if (filtros.apenasComEstoque) {
      itemsFiltrados = itemsFiltrados.filter(item => item.estoqueAtual > 0);
    }

    // Filtro por observação (busca nas movimentações do item)
    if (filtros.observacao) {
      const itensComObservacao = new Set<string>();
      movimentacoes.forEach(mov => {
        if (mov.observacoes && mov.observacoes.toLowerCase().includes(filtros.observacao.toLowerCase())) {
          itensComObservacao.add(mov.itemId);
        }
      });
      itemsFiltrados = itemsFiltrados.filter(item => itensComObservacao.has(item.id));
    }

    return itemsFiltrados;
  }, [itensEstoque, movimentacoes, filtros]);

  const atualizarFiltro = (campo: keyof FiltrosRelatorio, valor: any) => {
    setFiltros(prev => ({
      ...prev,
      [campo]: valor
    }));
  };

  const limparFiltros = () => {
    setFiltros(filtrosIniciais);
  };

  const exportarRelatorio = () => {
    const dados = itensFiltrados.map(item => ({
      'Código': item.codigoBarras,
      'Nome': item.nome,
      'Marca': item.marca,
      'Estoque Atual': item.estoqueAtual,
      'Unidade': item.unidade,
      'Localização': item.localizacao,
      'Condição': item.condicao
    }));

    const csv = [
      Object.keys(dados[0] || {}).join(','),
      ...dados.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio-estoque-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const temFiltrosAtivos = Object.values(filtros).some(valor => 
    typeof valor === 'boolean' ? valor : valor !== ''
  );

  return (
    <Dialog open={dialogoAberto} onOpenChange={setDialogoAberto}>
      <DialogTrigger asChild>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <div className="flex items-center space-x-2">
              <FileBarChart className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Relatórios Filtrados</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Gere relatórios personalizados com filtros avançados
            </p>
          </CardContent>
        </Card>
      </DialogTrigger>

      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileBarChart className="h-5 w-5" />
            Relatórios com Filtros
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Painel de Filtros */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filtros
                  {temFiltrosAtivos && (
                    <Badge variant="secondary">{itensFiltrados.length} item(ns)</Badge>
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={limparFiltros}
                  disabled={!temFiltrosAtivos}
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpar
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* Nome do Item */}
                <div>
                  <Label htmlFor="nomeItem">Nome do Item</Label>
                  <Input
                    id="nomeItem"
                    placeholder="Buscar por nome..."
                    value={filtros.nomeItem}
                    onChange={(e) => atualizarFiltro('nomeItem', e.target.value)}
                  />
                </div>

                {/* Categoria */}
                <div>
                  <Label htmlFor="categoria">Categoria</Label>
                  <Select 
                    value={filtros.categoria} 
                    onValueChange={(value) => atualizarFiltro('categoria', value === 'todas' ? '' : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as categorias" />
                    </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="todas">Todas as categorias</SelectItem>
                       {categorias.map(cat => (
                         <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                       ))}
                     </SelectContent>
                  </Select>
                </div>

                {/* Subcategoria */}
                <div>
                  <Label htmlFor="subcategoria">Subcategoria</Label>
                  <Select 
                    value={filtros.subcategoria} 
                    onValueChange={(value) => atualizarFiltro('subcategoria', value === 'todas' ? '' : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as subcategorias" />
                    </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="todas">Todas as subcategorias</SelectItem>
                       {subcategorias.map(subcat => (
                         <SelectItem key={subcat} value={subcat}>{subcat}</SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 </div>

                 {/* Localização */}
                 <div>
                  <Label htmlFor="localizacao">Localização</Label>
                  <Select 
                    value={filtros.localizacao} 
                    onValueChange={(value) => atualizarFiltro('localizacao', value === 'todas' ? '' : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as localizações" />
                    </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="todas">Todas as localizações</SelectItem>
                       {localizacoes.map(loc => (
                         <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                       ))}
                     </SelectContent>
                  </Select>
                </div>

                {/* Observação */}
                <div>
                  <Label htmlFor="observacao">Observação</Label>
                  <Input
                    id="observacao"
                    placeholder="Buscar em observações..."
                    value={filtros.observacao}
                    onChange={(e) => atualizarFiltro('observacao', e.target.value)}
                  />
                </div>

                {/* Data Início */}
                <div>
                  <Label htmlFor="dataInicio">Data Início</Label>
                  <Input
                    id="dataInicio"
                    type="date"
                    value={filtros.dataInicio}
                    onChange={(e) => atualizarFiltro('dataInicio', e.target.value)}
                  />
                </div>

                 {/* Data Fim */}
                 <div>
                   <Label htmlFor="dataFim">Data Fim</Label>
                   <Input
                     id="dataFim"
                     type="date"
                     value={filtros.dataFim}
                     onChange={(e) => atualizarFiltro('dataFim', e.target.value)}
                   />
                  </div>

                 </div>

               {/* Checkboxes */}
               <div className="flex gap-6 mt-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="apenasSemEstoque"
                    checked={filtros.apenasSemEstoque}
                    onCheckedChange={(checked) => atualizarFiltro('apenasSemEstoque', !!checked)}
                  />
                  <Label htmlFor="apenasSemEstoque">Apenas itens zerados</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="apenasComEstoque"
                    checked={filtros.apenasComEstoque}
                    onCheckedChange={(checked) => atualizarFiltro('apenasComEstoque', !!checked)}
                  />
                  <Label htmlFor="apenasComEstoque">Apenas itens com estoque</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resultados */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  Resultados ({itensFiltrados.length} item{itensFiltrados.length !== 1 ? 'ns' : ''})
                </span>
                 <div className="flex gap-2">
                   <Button
                     onClick={exportarRelatorio}
                     disabled={itensFiltrados.length === 0}
                     size="sm"
                     variant="outline"
                   >
                     <Download className="h-4 w-4 mr-2" />
                     Exportar CSV
                   </Button>
                   <Button
                     onClick={() => {
                       import('@/utils/excelExport').then(({ exportarExcel }) => {
                         exportarExcel({
                           titulo: 'Relatório Filtrado',
                           nomeEstoque: 'Estoque Filtrado',
                           itens: itensFiltrados,
                           incluirEstatisticas: true
                         });
                       });
                     }}
                     disabled={itensFiltrados.length === 0}
                     size="sm"
                   >
                     <Download className="h-4 w-4 mr-2" />
                     Exportar Excel
                   </Button>
                 </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Estoque</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead>Localização</TableHead>
                      <TableHead>Condição</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itensFiltrados.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Nenhum item encontrado com os filtros aplicados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      itensFiltrados.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono">{item.codigoBarras}</TableCell>
                          <TableCell>{item.nome}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className={item.estoqueAtual === 0 ? 'text-destructive font-medium' : ''}>
                                {item.estoqueAtual}
                              </span>
                              {item.estoqueAtual === 0 && (
                                <Badge variant="destructive" className="text-xs">Zerado</Badge>
                              )}
                            </div>
                          </TableCell>
                           <TableCell>{item.unidade}</TableCell>
                          <TableCell>{item.localizacao || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={
                              item.condicao === 'Novo' ? 'default' :
                              item.condicao === 'Usado' ? 'secondary' :
                              item.condicao === 'Defeito' ? 'destructive' : 'outline'
                            }>
                              {item.condicao}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};