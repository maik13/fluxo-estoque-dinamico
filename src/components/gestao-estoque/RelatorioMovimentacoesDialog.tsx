import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Calendar as CalendarIcon, FileSpreadsheet, Printer, BarChart3, ArrowDownCircle, ArrowUpCircle, Package } from 'lucide-react';
import { Movimentacao, TipoMovimentacao } from '@/types/estoque';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';

interface RelatorioMovimentacoesDialogProps {
  aberto: boolean;
  onClose: () => void;
  movimentacoes: Movimentacao[];
}

interface ResumoItem {
  itemNome: string;
  codigoBarras: string | number;
  unidade: string;
  totalSaidas: number;
  totalDevolucoes: number;
  saldoPendente: number;
  qtdMovSaida: number;
  qtdMovDevolucao: number;
  categoria: string;
  tipoItem: string;
}

export const RelatorioMovimentacoesDialog = ({ aberto, onClose, movimentacoes }: RelatorioMovimentacoesDialogProps) => {
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todas');
  const [filtroDestino, setFiltroDestino] = useState('todos');
  const [filtroDataInicio, setFiltroDataInicio] = useState<Date | undefined>(undefined);
  const [filtroDataFim, setFiltroDataFim] = useState<Date | undefined>(undefined);
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [filtroTipoItem, setFiltroTipoItem] = useState('todos');
  const { obterPrimeiraCategoriaDeSubcategoria, subcategorias: subcategoriasConfig } = useConfiguracoes();

  const isDevolucao = (mov: Movimentacao) => {
    return mov.tipo === 'ENTRADA' && mov.observacoes?.toLowerCase().includes('devolução');
  };

  const locaisUtilizacao = useMemo(() => {
    const locais = new Set(movimentacoes.map(mov => mov.localUtilizacaoNome).filter(Boolean));
    return Array.from(locais).sort();
  }, [movimentacoes]);

  // Filter movements
  const movimentacoesFiltradas = useMemo(() => {
    return movimentacoes.filter(mov => {
      const textoFiltro = filtroTexto.toLowerCase();
      const matchTexto = !textoFiltro ||
        mov.itemSnapshot?.nome?.toLowerCase().includes(textoFiltro) ||
        mov.itemSnapshot?.codigoBarras?.toString().includes(textoFiltro);

      let matchTipo = true;
      if (filtroTipo === 'SAIDA') matchTipo = mov.tipo === 'SAIDA';
      else if (filtroTipo === 'DEVOLUCAO') matchTipo = isDevolucao(mov);
      else if (filtroTipo === 'ENTRADA') matchTipo = mov.tipo === 'ENTRADA' && !isDevolucao(mov);
      else if (filtroTipo === 'CADASTRO') matchTipo = mov.tipo === 'CADASTRO';

      const matchDestino = filtroDestino === 'todos' || mov.localUtilizacaoNome === filtroDestino;

      const dInicio = filtroDataInicio ? new Date(new Date(filtroDataInicio).setHours(0, 0, 0, 0)) : null;
      const dFim = filtroDataFim ? new Date(new Date(filtroDataFim).setHours(23, 59, 59, 999)) : null;
      const movData = new Date(mov.dataHora);

      const matchData = !dInicio || movData >= dInicio;
      const matchDataFim = !dFim || movData <= dFim;

      const categoria = mov.itemSnapshot?.subcategoriaId ? obterPrimeiraCategoriaDeSubcategoria(mov.itemSnapshot.subcategoriaId) : '-';
      const matchCategoria = filtroCategoria === 'todas' || categoria === filtroCategoria;
      
      const tipoItem = mov.itemSnapshot?.tipoItem || '-';
      const matchTipoItem = filtroTipoItem === 'todos' || tipoItem === filtroTipoItem;

      return matchTexto && matchTipo && matchDestino && matchData && matchDataFim && matchCategoria && matchTipoItem;
    });
  }, [movimentacoes, filtroTexto, filtroTipo, filtroDestino, filtroDataInicio, filtroDataFim, filtroCategoria, filtroTipoItem]);

  // Group by item and sum exits/returns
  const resumoItens = useMemo(() => {
    const map = new Map<string, ResumoItem>();

    movimentacoesFiltradas.forEach(mov => {
      const itemId = mov.itemId;
      const itemNome = mov.itemSnapshot?.nome || 'Item não identificado';
      const codigoBarras = mov.itemSnapshot?.codigoBarras || '';
      const unidade = mov.itemSnapshot?.unidade || '';

      if (!map.has(itemId)) {
        map.set(itemId, {
          itemNome,
          codigoBarras,
          unidade,
          totalSaidas: 0,
          totalDevolucoes: 0,
          saldoPendente: 0,
          qtdMovSaida: 0,
          qtdMovDevolucao: 0,
          categoria: mov.itemSnapshot?.subcategoriaId ? obterPrimeiraCategoriaDeSubcategoria(mov.itemSnapshot.subcategoriaId) : '-',
          tipoItem: mov.itemSnapshot?.tipoItem || '-',
        });
      }

      const resumo = map.get(itemId)!;
      // Update name to latest
      resumo.itemNome = itemNome;

      if (mov.tipo === 'SAIDA') {
        resumo.totalSaidas += mov.quantidade;
        resumo.qtdMovSaida += 1;
      } else if (isDevolucao(mov)) {
        resumo.totalDevolucoes += mov.quantidade;
        resumo.qtdMovDevolucao += 1;
      }
    });

    // Calculate pending balance
    const resultado = Array.from(map.values()).map(r => ({
      ...r,
      saldoPendente: r.totalSaidas - r.totalDevolucoes,
    }));

    // Sort by most exits
    return resultado.sort((a, b) => b.totalSaidas - a.totalSaidas);
  }, [movimentacoesFiltradas]);

  // Totals
  const totais = useMemo(() => {
    return resumoItens.reduce(
      (acc, item) => ({
        totalSaidas: acc.totalSaidas + item.totalSaidas,
        totalDevolucoes: acc.totalDevolucoes + item.totalDevolucoes,
        saldoPendente: acc.saldoPendente + item.saldoPendente,
      }),
      { totalSaidas: 0, totalDevolucoes: 0, saldoPendente: 0 }
    );
  }, [resumoItens]);

  const exportarExcel = () => {
    try {
      const dados = resumoItens.map(item => ({
        'Item': item.itemNome,
        'Tipo de Item': item.tipoItem,
        'Categoria': item.categoria,
        'Código de Barras': item.codigoBarras,
        'Unidade': item.unidade,
        'Total Saídas': item.totalSaidas,
        'Nº Saídas': item.qtdMovSaida,
        'Total Devoluções': item.totalDevolucoes,
        'Nº Devoluções': item.qtdMovDevolucao,
        'Saldo Pendente': item.saldoPendente,
      }));

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(dados);
      worksheet['!cols'] = [
        { wch: 35 }, { wch: 15 }, { wch: 20 }, { wch: 18 }, { wch: 10 }, { wch: 14 },
        { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 16 },
      ];
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório');
      const dataAtual = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `relatorio-movimentacoes-${dataAtual}.xlsx`);
      toast({ title: "Exportação concluída!", description: `${resumoItens.length} itens exportados.` });
    } catch (error) {
      toast({ title: "Erro na exportação", description: "Não foi possível exportar.", variant: "destructive" });
    }
  };

  const imprimirRelatorio = async () => {
    let logoHtml = '';
    try {
      const { data, error } = await supabase.storage.from('branding').list('', { limit: 1 });
      if (!error && data && data.length > 0) {
        const { data: publicUrlData } = supabase.storage.from('branding').getPublicUrl(data[0].name);
        if (publicUrlData.publicUrl) {
          logoHtml = `<img src="${publicUrlData.publicUrl}" alt="Logo" style="height:50px;object-fit:contain;" />`;
        }
      }
    } catch (e) { /* ignore */ }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: "Erro", description: "Habilite pop-ups para imprimir.", variant: "destructive" });
      return;
    }

    const linhas = resumoItens.map(item => `<tr>
      <td>${item.itemNome}</td>
      <td>${item.tipoItem}</td>
      <td>${item.categoria}</td>
      <td>${item.codigoBarras}</td>
      <td>${item.unidade}</td>
      <td style="text-align:center">${item.totalSaidas}</td>
      <td style="text-align:center">${item.qtdMovSaida}</td>
      <td style="text-align:center">${item.totalDevolucoes}</td>
      <td style="text-align:center">${item.qtdMovDevolucao}</td>
      <td style="text-align:center;font-weight:bold;color:${item.saldoPendente > 0 ? '#e74c3c' : '#27ae60'}">${item.saldoPendente}</td>
    </tr>`).join('');

    const filtrosAtivos = [];
    if (filtroTexto) filtrosAtivos.push(`Busca: ${filtroTexto}`);
    if (filtroTipo !== 'todas') filtrosAtivos.push(`Tipo: ${filtroTipo}`);
    if (filtroDestino !== 'todos') filtrosAtivos.push(`Destino: ${filtroDestino}`);
    if (filtroDataInicio) filtrosAtivos.push(`De: ${format(filtroDataInicio, 'dd/MM/yyyy')}`);
    if (filtroDataFim) filtrosAtivos.push(`Até: ${format(filtroDataFim, 'dd/MM/yyyy')}`);

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Relatório de Movimentações</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; }
        .header { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; border-bottom: 2px solid #2980b3; padding-bottom: 8px; }
        .header h1 { font-size: 16px; margin: 0; }
        .info { color: #666; margin-bottom: 12px; font-size: 10px; }
        .totais { display: flex; gap: 20px; margin-bottom: 12px; }
        .totais div { padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
        th { background: #2980b3; color: white; font-size: 10px; }
        tr:nth-child(even) { background: #f8f8f8; }
        .total-row { font-weight: bold; background: #eee !important; }
        @media print { body { margin: 10px; } }
      </style></head><body>
      <div class="header">${logoHtml}<h1>Relatório Consolidado de Movimentações</h1></div>
      <div class="info">Gerado em: ${new Date().toLocaleString('pt-BR')} | ${resumoItens.length} itens${filtrosAtivos.length > 0 ? ' | Filtros: ' + filtrosAtivos.join(', ') : ''}</div>
      <div class="totais">
        <div>Total Saídas: <strong>${totais.totalSaidas}</strong></div>
        <div>Total Devoluções: <strong>${totais.totalDevolucoes}</strong></div>
        <div>Saldo Pendente: <strong style="color:${totais.saldoPendente > 0 ? '#e74c3c' : '#27ae60'}">${totais.saldoPendente}</strong></div>
      </div>
      <table><thead><tr>
        <th>Item</th><th>Tipo Item</th><th>Categoria</th><th>Código</th><th>Unidade</th><th>Total Saídas</th><th>Nº Saídas</th><th>Total Devoluções</th><th>Nº Devoluções</th><th>Saldo Pendente</th>
      </tr></thead><tbody>${linhas}
      <tr class="total-row">
        <td colspan="5">TOTAIS</td>
        <td style="text-align:center">${totais.totalSaidas}</td>
        <td></td>
        <td style="text-align:center">${totais.totalDevolucoes}</td>
        <td></td>
        <td style="text-align:center">${totais.saldoPendente}</td>
      </tr>
      </tbody></table>
      <script>window.print();window.onafterprint=()=>window.close();</script>
    </body></html>`);
    printWindow.document.close();
  };

  return (
    <Dialog open={aberto} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Relatório Consolidado de Movimentações
          </DialogTitle>
          <DialogDescription>
            Resumo de saídas e devoluções agrupado por item
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por item, código..."
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos os tipos</SelectItem>
                <SelectItem value="SAIDA">Saídas</SelectItem>
                <SelectItem value="DEVOLUCAO">Devoluções</SelectItem>
                <SelectItem value="ENTRADA">Entradas</SelectItem>
                <SelectItem value="CADASTRO">Cadastros</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filtroTipoItem} onValueChange={setFiltroTipoItem}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de Item" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos de item</SelectItem>
                <SelectItem value="Insumo">Insumo</SelectItem>
                <SelectItem value="Ferramenta">Ferramenta</SelectItem>
                <SelectItem value="Produto Acabado">Produto Acabado</SelectItem>
                <SelectItem value="Matéria Prima">Matéria Prima</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                {Array.from(new Set(subcategoriasConfig.map(s => obterPrimeiraCategoriaDeSubcategoria(s.id)))).filter(c => c !== '-').sort().map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroDestino} onValueChange={setFiltroDestino}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os estoques/destinos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os estoques/destinos</SelectItem>
                {locaisUtilizacao.map(local => (
                  <SelectItem key={local} value={local!}>{local}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <Button onClick={exportarExcel} variant="outline" className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Exportar Excel
            </Button>
            <Button onClick={imprimirRelatorio} variant="outline" className="flex items-center gap-2">
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <ArrowDownCircle className="h-8 w-8 text-warning" />
              <div>
                <p className="text-sm text-muted-foreground">Total Saídas</p>
                <p className="text-2xl font-bold text-warning">{totais.totalSaidas}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <ArrowUpCircle className="h-8 w-8 text-info" />
              <div>
                <p className="text-sm text-muted-foreground">Total Devoluções</p>
                <p className="text-2xl font-bold text-info">{totais.totalDevolucoes}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Package className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-sm text-muted-foreground">Saldo Pendente</p>
                <p className={`text-2xl font-bold ${totais.saldoPendente > 0 ? 'text-destructive' : 'text-success'}`}>
                  {totais.saldoPendente}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Table */}
        <div className="w-full overflow-x-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Tipo Item</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-center">Total Saídas</TableHead>
                <TableHead className="text-center">Nº Saídas</TableHead>
                <TableHead className="text-center">Total Devoluções</TableHead>
                <TableHead className="text-center">Nº Devoluções</TableHead>
                <TableHead className="text-center">Saldo Pendente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resumoItens.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Nenhuma movimentação encontrada com os filtros aplicados
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {resumoItens.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{item.itemNome}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-muted text-foreground">
                          {item.tipoItem}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-muted">
                          {item.categoria}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.codigoBarras}</TableCell>
                      <TableCell>{item.unidade}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-warning/10 text-warning">
                          {item.totalSaidas}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">{item.qtdMovSaida}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-info/10 text-info">
                          {item.totalDevolucoes}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">{item.qtdMovDevolucao}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={item.saldoPendente > 0 ? 'destructive' : 'outline'} className={item.saldoPendente <= 0 ? 'bg-success/10 text-success' : ''}>
                          {item.saldoPendente}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals row */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={5}>TOTAIS</TableCell>
                    <TableCell className="text-center">{totais.totalSaidas}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-center">{totais.totalDevolucoes}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-center">{totais.saldoPendente}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-sm text-muted-foreground">
          {resumoItens.length} itens encontrados | {movimentacoesFiltradas.length} movimentações no período
        </p>
      </DialogContent>
    </Dialog>
  );
};
