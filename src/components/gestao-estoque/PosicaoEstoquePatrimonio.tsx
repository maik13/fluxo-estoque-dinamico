import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Filter, FileSpreadsheet, Package, Loader2, AlertTriangle, MapPin } from 'lucide-react';
import { useEstoqueContext } from '@/contexts/EstoqueContext';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { calcularTotaisPosicao, usePosicaoPatrimonio } from '@/hooks/usePosicaoPatrimonio';
import { exportarExcelPosicaoPatrimonio } from '@/utils/patrimonioExport';
import { EstoqueItem } from '@/types/estoque';

const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const qtd = (valor: number) => Number.isInteger(valor) ? String(valor) : valor.toFixed(2);

export const PosicaoEstoquePatrimonio = () => {
  const { obterEstoque, loading } = useEstoqueContext();
  const {
    obterEstoqueAtivoInfo,
    obterSubcategoriasAtivas,
    obterCategoriasUnicas,
    obterSubcategoriasPorCategoria,
    obterPrimeiraCategoriaDeSubcategoria,
  } = useConfiguracoes();

  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState('todos');
  const [categoria, setCategoria] = useState('todas');
  const [subcategoria, setSubcategoria] = useState('todas');
  const [condicao, setCondicao] = useState('todas');
  const [status, setStatus] = useState('ativos');
  const [situacao, setSituacao] = useState('todas');
  const [preco, setPreco] = useState('todos');
  const [localUso, setLocalUso] = useState('');

  const estoque = useMemo(() => obterEstoque(), [obterEstoque]);
  const estoqueInfo = obterEstoqueAtivoInfo();
  const subcategorias = useMemo(() => obterSubcategoriasAtivas(), [obterSubcategoriasAtivas]);
  const categorias = useMemo(() => obterCategoriasUnicas(), [obterCategoriasUnicas]);
  const subcategoriasFiltradas = useMemo(
    () => categoria === 'todas' ? subcategorias : obterSubcategoriasPorCategoria(categoria),
    [categoria, subcategorias, obterSubcategoriasPorCategoria]
  );

  useEffect(() => setSubcategoria('todas'), [categoria]);

  const nomesSubcategoria = useMemo(() => new Map(subcategorias.map((s) => [s.id, s.nome])), [subcategorias]);
  const idsCategoria = useMemo(
    () => categoria === 'todas' ? null : new Set(subcategoriasFiltradas.map((s) => s.id)),
    [categoria, subcategoriasFiltradas]
  );

  const itensPreFiltrados = useMemo(() => estoque.filter((item) => {
    const busca = texto.trim().toLowerCase();
    const matchTexto = !busca
      || String(item.codigoBarras).includes(busca)
      || item.nome.toLowerCase().includes(busca)
      || item.marca.toLowerCase().includes(busca)
      || item.especificacao.toLowerCase().includes(busca);
    const matchTipo = tipo === 'todos' || item.tipoItem === tipo;
    const matchCategoria = !idsCategoria || Boolean(item.subcategoriaId && idsCategoria.has(item.subcategoriaId));
    const matchSub = subcategoria === 'todas' || item.subcategoriaId === subcategoria;
    const matchCondicao = condicao === 'todas' || item.condicao === condicao;
    const matchStatus = status === 'todos' || (status === 'ativos' ? item.ativo !== false : item.ativo === false);
    return matchTexto && matchTipo && matchCategoria && matchSub && matchCondicao && matchStatus;
  }), [estoque, texto, tipo, idsCategoria, subcategoria, condicao, status]);

  const obterCategoriaDoItem = useCallback((item: EstoqueItem) => ({
    categoria: item.subcategoriaId ? obterPrimeiraCategoriaDeSubcategoria(item.subcategoriaId) : '',
    subcategoria: item.subcategoriaId ? nomesSubcategoria.get(item.subcategoriaId) || '' : '',
  }), [obterPrimeiraCategoriaDeSubcategoria, nomesSubcategoria]);

  const { linhas, carregando } = usePosicaoPatrimonio({
    itens: itensPreFiltrados,
    estoqueId: estoqueInfo?.id,
    obterCategoriaDoItem,
  });

  const linhasFiltradas = useMemo(() => linhas.filter((linha) => {
    const matchSituacao = situacao === 'todas' || linha.situacao === situacao;
    const matchPreco = preco === 'todos'
      || (preco === 'com-preco' ? linha.valorUnitario !== null : linha.valorUnitario === null);
    const buscaLocal = localUso.trim().toLowerCase();
    const matchLocal = !buscaLocal || linha.projetoLocalUso.toLowerCase().includes(buscaLocal);
    return matchSituacao && matchPreco && matchLocal;
  }), [linhas, situacao, preco, localUso]);

  const totais = useMemo(() => calcularTotaisPosicao(linhasFiltradas), [linhasFiltradas]);

  const filtrosDescricao = [
    texto.trim() ? `Busca: ${texto.trim()}` : '',
    tipo !== 'todos' ? `Tipo: ${tipo}` : '',
    categoria !== 'todas' ? `Categoria: ${categoria}` : '',
    subcategoria !== 'todas' ? `Subcategoria: ${nomesSubcategoria.get(subcategoria) || subcategoria}` : '',
    condicao !== 'todas' ? `Condição: ${condicao}` : '',
    `Status: ${status}`,
    situacao !== 'todas' ? `Situação: ${situacao}` : '',
    localUso.trim() ? `Projeto/Local: ${localUso.trim()}` : '',
    preco !== 'todos' ? `Preço: ${preco === 'com-preco' ? 'Com preço' : 'Sem preço'}` : '',
  ].filter(Boolean).join(' | ');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Package className="h-10 w-10 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  const indicadores = [
    ['Itens considerados', totais.itensConsiderados],
    ['Qtd. física no almoxarifado', qtd(totais.quantidadeFisicaAlmoxarifado)],
    ['Ferramentas em uso/projeto', qtd(totais.ferramentasEmUso)],
    ['Qtd. patrimonial de ferramentas', qtd(totais.quantidadePatrimonialFerramentas)],
    ['Insumos em estoque', qtd(totais.quantidadeInsumosEstoque)],
    ['Itens precificados', totais.itensPrecificados],
    ['Itens sem preço', totais.itensSemPreco],
    ['Valor no almoxarifado (conhecido)', moeda(totais.valorAlmoxarifadoConhecido)],
    ['Valor de ferramentas alocadas (conhecido)', moeda(totais.valorFerramentasAlocadasConhecido)],
    ['Valor patrimonial de ferramentas (conhecido)', moeda(totais.valorPatrimonialFerramentasConhecido)],
    ['Valor total conhecido da posição', moeda(totais.valorTotalConhecido)],
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>📊 Posição de Estoque e Patrimônio</CardTitle>
          <CardDescription>
            Visão somente leitura. Ferramentas em obra continuam compondo quantidade e valor patrimonial; insumos consideram somente o saldo operacional disponível.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
            {indicadores.map(([rotulo, valor]) => (
              <div key={String(rotulo)} className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">{rotulo}</p>
                <p className="text-lg font-bold mt-1 break-words">{valor}</p>
              </div>
            ))}
          </div>
          {totais.itensSemPreco > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              Os valores exibidos são apenas os valores conhecidos. {totais.itensSemPreco} item(ns) sem preço não compõem os totais financeiros.
            </p>
          )}
          {totais.itensComDivergencia > 0 && (
            <p className="text-xs text-destructive mt-2">
              Há {totais.itensComDivergencia} item(ns) com saldo negativo. Esses saldos são sinalizados como divergência e não geram valor financeiro negativo.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" />Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Código, nome ou marca..." value={texto} onChange={(e) => setTexto(e.target.value)} className="pl-10" />
            </div>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue placeholder="Tipo de item" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="Ferramenta">Ferramenta</SelectItem>
                <SelectItem value="Insumo">Insumo</SelectItem>
                <SelectItem value="Matéria Prima">Matéria Prima</SelectItem>
                <SelectItem value="Produto Acabado">Produto Acabado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                {categorias.map((c) => <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={subcategoria} onValueChange={setSubcategoria}>
              <SelectTrigger><SelectValue placeholder="Subcategoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as subcategorias</SelectItem>
                {subcategoriasFiltradas.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={condicao} onValueChange={setCondicao}>
              <SelectTrigger><SelectValue placeholder="Condição" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as condições</SelectItem>
                <SelectItem value="Novo">Novo</SelectItem>
                <SelectItem value="Usado">Usado</SelectItem>
                <SelectItem value="Defeito">Defeito</SelectItem>
                <SelectItem value="Descarte">Descarte</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativos">Somente ativos</SelectItem>
                <SelectItem value="inativos">Somente inativos</SelectItem>
                <SelectItem value="todos">Incluir inativos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={situacao} onValueChange={setSituacao}>
              <SelectTrigger><SelectValue placeholder="Situação" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as situações</SelectItem>
                <SelectItem value="No almoxarifado">No almoxarifado</SelectItem>
                <SelectItem value="Em uso/projeto">Em uso/projeto</SelectItem>
                <SelectItem value="Parcialmente em uso">Parcialmente em uso</SelectItem>
                <SelectItem value="Em estoque">Em estoque</SelectItem>
                <SelectItem value="Sem saldo">Sem saldo</SelectItem>
                <SelectItem value="Divergência de estoque">Divergência de estoque</SelectItem>
              </SelectContent>
            </Select>
            <Select value={preco} onValueChange={setPreco}>
              <SelectTrigger><SelectValue placeholder="Preço" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Com e sem preço</SelectItem>
                <SelectItem value="com-preco">Somente com preço</SelectItem>
                <SelectItem value="sem-preco">Somente sem preço</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative md:col-span-2 xl:col-span-2">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar por projeto/local de uso..."
                value={localUso}
                onChange={(e) => setLocalUso(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              {carregando
                ? <><Loader2 className="h-4 w-4 animate-spin" />Calculando ferramentas em uso/projeto...</>
                : <>Exibindo {linhasFiltradas.length} item(ns)</>}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={carregando}
              onClick={() => exportarExcelPosicaoPatrimonio({
                linhas: linhasFiltradas,
                totais,
                nomeEstoque: estoqueInfo?.nome || 'Estoque Atual',
                descricaoFiltros: filtrosDescricao,
              })}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />Exportar Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalhamento</CardTitle>
          <CardDescription>
            Para insumos, saídas históricas para obra não são somadas ao patrimônio sem confirmação de saldo remanescente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] w-full">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="whitespace-nowrap">
                    <TableHead>Código</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Marca</TableHead>
                    <TableHead>Especificação</TableHead>
                    <TableHead>Categoria/Subcategoria</TableHead>
                    <TableHead>Condição</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead className="text-right">Qtd. Almox.</TableHead>
                    <TableHead className="text-right">Qtd. Alocada</TableHead>
                    <TableHead className="text-right">Qtd. Considerada</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Projeto/Local</TableHead>
                    <TableHead className="text-right">Valor Unitário</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead>Status de Preço</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhasFiltradas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={16} className="text-center py-10 text-muted-foreground">Nenhum item encontrado.</TableCell>
                    </TableRow>
                  ) : linhasFiltradas.map((linha) => (
                    <TableRow key={linha.item.id} className="whitespace-nowrap">
                      <TableCell className="font-mono">{linha.codigo}</TableCell>
                      <TableCell><Badge variant={linha.ehFerramenta ? 'default' : 'secondary'}>{linha.tipo}</Badge></TableCell>
                      <TableCell className="font-medium">{linha.nome}</TableCell>
                      <TableCell>{linha.marca}</TableCell>
                      <TableCell className="max-w-[220px] truncate" title={linha.especificacao}>{linha.especificacao}</TableCell>
                      <TableCell>{linha.categoria} / {linha.subcategoria}</TableCell>
                      <TableCell>{linha.condicao}</TableCell>
                      <TableCell>{linha.unidade}</TableCell>
                      <TableCell className="text-right">{qtd(linha.quantidadeAlmoxarifado)}</TableCell>
                      <TableCell className="text-right">{linha.ehFerramenta ? qtd(linha.quantidadeAlocada) : '-'}</TableCell>
                      <TableCell className="text-right font-semibold">{qtd(linha.quantidadeConsiderada)}</TableCell>
                      <TableCell>
                        {linha.divergencia
                          ? <Badge variant="outline" className="border-destructive text-destructive"><AlertTriangle className="h-3 w-3 mr-1" />Divergência de estoque</Badge>
                          : <Badge variant="outline">{linha.situacao}</Badge>}
                      </TableCell>
                      <TableCell>{linha.projetoLocalUso}</TableCell>
                      <TableCell className="text-right">{linha.valorUnitario !== null ? moeda(linha.valorUnitario) : '-'}</TableCell>
                      <TableCell className="text-right font-semibold">{linha.valorTotal !== null ? moeda(linha.valorTotal) : '-'}</TableCell>
                      <TableCell><Badge variant={linha.statusPreco === 'Com preço' ? 'secondary' : 'outline'}>{linha.statusPreco}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
