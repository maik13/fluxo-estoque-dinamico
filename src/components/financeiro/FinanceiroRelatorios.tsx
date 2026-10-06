import { useMemo, useState } from 'react';
import { Download, FileText, Search, TrendingDown, TrendingUp, WalletCards } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IndicadorPagina54 } from './IndicadorPagina54';

type Registro = Record<string, any>;

interface Props {
  lancamentos: Registro[];
  posicoes: Registro[];
  contas: Registro[];
}

const moeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor || 0));

const dataPt = (valor?: string | null) => {
  if (!valor) return '—';
  const base = String(valor).slice(0, 10);
  const [a, m, d] = base.split('-');
  return a && m && d ? `${d}/${m}/${a}` : String(valor);
};

const valorLancamento = (l: Registro, realizado = false) => {
  const base = realizado && l.valor_realizado != null ? l.valor_realizado : l.valor_previsto;
  const n = Number(base || 0);
  return Number.isFinite(n) ? Math.abs(n) : 0;
};

const dateKey = (valor?: string | null) => valor ? String(valor).slice(0, 10) : '';

const inicioSemana = (data: string) => {
  const d = new Date(`${data}T12:00:00`);
  const dia = d.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
};

const mesKey = (data: string) => data ? data.slice(0, 7) : '';

const agruparFluxo = (linhas: Registro[], modo: 'dia' | 'semana' | 'mes', realizado: boolean) => {
  const mapa = new Map<string, { periodo: string; entradas: number; saidas: number; resultado: number }>();
  linhas.forEach((l) => {
    const data = dateKey(realizado ? (l.data_realizada || l.data_prevista) : l.data_prevista);
    if (!data) return;
    const chave = modo === 'dia' ? data : modo === 'semana' ? inicioSemana(data) : mesKey(data);
    const atual = mapa.get(chave) || { periodo: chave, entradas: 0, saidas: 0, resultado: 0 };
    const v = valorLancamento(l, realizado);
    if (l.tipo === 'entrada') atual.entradas += v;
    if (l.tipo === 'saida') atual.saidas += v;
    atual.resultado = atual.entradas - atual.saidas;
    mapa.set(chave, atual);
  });
  return [...mapa.values()].sort((a, b) => a.periodo.localeCompare(b.periodo));
};

const agruparCampo = (linhas: Registro[], campo: string) => {
  const mapa = new Map<string, { nome: string; entradas: number; saidas: number; total: number }>();
  linhas.forEach((l) => {
    const nome = String(l[campo] || 'SEM CLASSIFICAÇÃO');
    const atual = mapa.get(nome) || { nome, entradas: 0, saidas: 0, total: 0 };
    const v = valorLancamento(l, Boolean(l.data_realizada));
    if (l.tipo === 'entrada') atual.entradas += v;
    if (l.tipo === 'saida') atual.saidas += v;
    atual.total = atual.entradas - atual.saidas;
    mapa.set(nome, atual);
  });
  return [...mapa.values()].sort((a, b) => (b.entradas + b.saidas) - (a.entradas + a.saidas));
};

export const FinanceiroRelatorios = ({ lancamentos, posicoes, contas }: Props) => {
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [situacao, setSituacao] = useState('todos');
  const [tipo, setTipo] = useState('todos');
  const [categoria, setCategoria] = useState('todos');
  const [subcategoria, setSubcategoria] = useState('todos');
  const [projeto, setProjeto] = useState('todos');
  const [busca, setBusca] = useState('');

  const opcoes = useMemo(() => ({
    categorias: [...new Set(lancamentos.map(l => l.categoria).filter(Boolean))].sort(),
    subcategorias: [...new Set(lancamentos.map(l => l.subcategoria).filter(Boolean))].sort(),
    projetos: [...new Set(lancamentos.map(l => l.projeto_centro_custo).filter(Boolean))].sort(),
    situacoes: [...new Set(lancamentos.map(l => l.status).filter(Boolean))].sort(),
  }), [lancamentos]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    return lancamentos.filter((l) => {
      const data = dateKey(l.data_realizada || l.data_prevista);
      if (dataInicio && data && data < dataInicio) return false;
      if (dataFim && data && data > dataFim) return false;
      if (situacao !== 'todos' && l.status !== situacao) return false;
      if (tipo !== 'todos' && l.tipo !== tipo) return false;
      if (categoria !== 'todos' && l.categoria !== categoria) return false;
      if (subcategoria !== 'todos' && l.subcategoria !== subcategoria) return false;
      if (projeto !== 'todos' && l.projeto_centro_custo !== projeto) return false;
      if (termo) {
        const alvo = [l.descricao, l.observacoes, l.categoria, l.subcategoria, l.projeto_centro_custo, l.situacao_original]
          .filter(Boolean).join(' ').toLocaleLowerCase('pt-BR');
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [lancamentos, dataInicio, dataFim, situacao, tipo, categoria, subcategoria, projeto, busca]);

  const realizados = useMemo(() =>
    filtrados.filter((l) => Boolean(l.data_realizada) || ['pago', 'conciliado', 'liquidado', 'recebido'].includes(l.status)),
  [filtrados]);

  const abertos = useMemo(() =>
    filtrados.filter((l) => !['cancelado', 'pago', 'conciliado', 'liquidado', 'recebido'].includes(l.status)),
  [filtrados]);

  const realizadoDia = useMemo(() => agruparFluxo(realizados, 'dia', true), [realizados]);
  const realizadoSemana = useMemo(() => agruparFluxo(realizados, 'semana', true), [realizados]);
  const realizadoMes = useMemo(() => agruparFluxo(realizados, 'mes', true), [realizados]);
  const previstoDia = useMemo(() => agruparFluxo(abertos, 'dia', false), [abertos]);

  const totaisRealizado = useMemo(() => {
    const entradas = realizados.filter(l => l.tipo === 'entrada').reduce((s, l) => s + valorLancamento(l, true), 0);
    const saidas = realizados.filter(l => l.tipo === 'saida').reduce((s, l) => s + valorLancamento(l, true), 0);
    return { entradas, saidas, resultado: entradas - saidas };
  }, [realizados]);

  const totaisPrevisto = useMemo(() => {
    const entradas = abertos.filter(l => l.tipo === 'entrada').reduce((s, l) => s + valorLancamento(l), 0);
    const saidas = abertos.filter(l => l.tipo === 'saida').reduce((s, l) => s + valorLancamento(l), 0);
    return { entradas, saidas, resultado: entradas - saidas };
  }, [abertos]);

  const hoje = new Date().toISOString().slice(0, 10);
  const vencidos = useMemo(() => abertos.filter(l => l.data_prevista && dateKey(l.data_prevista) < hoje), [abertos, hoje]);
  const contasPagar = useMemo(() => abertos.filter(l => l.tipo === 'saida').sort((a,b)=>dateKey(a.data_prevista).localeCompare(dateKey(b.data_prevista))), [abertos]);
  const contasReceber = useMemo(() => abertos.filter(l => l.tipo === 'entrada').sort((a,b)=>dateKey(a.data_prevista).localeCompare(dateKey(b.data_prevista))), [abertos]);

  const saldoAtual = useMemo(() => {
    if (!posicoes.length) return 0;
    const ultimaData = [...posicoes].map(p => dateKey(p.data)).filter(Boolean).sort().at(-1);
    return posicoes.filter(p => dateKey(p.data) === ultimaData)
      .reduce((s,p)=>s+Number(p.saldo_final_bancario || 0),0);
  }, [posicoes]);

  const projecao = useMemo(() => {
    let saldo = saldoAtual;
    return previstoDia.map((d) => {
      saldo += d.entradas - d.saidas;
      return { ...d, saldo };
    });
  }, [previstoDia, saldoAtual]);

  const menorSaldo = useMemo(() => {
    if (!projecao.length) return { saldo: saldoAtual, periodo: hoje };
    return projecao.reduce((min, item) => item.saldo < min.saldo ? item : min, projecao[0]);
  }, [projecao, saldoAtual, hoje]);

  const porCategoria = useMemo(() => agruparCampo(filtrados, 'categoria'), [filtrados]);
  const porSubcategoria = useMemo(() => agruparCampo(filtrados, 'subcategoria'), [filtrados]);
  const porAnotacao = useMemo(() => agruparCampo(filtrados, 'observacoes'), [filtrados]);
  const maioresSaidas = useMemo(() => [...filtrados].filter(l=>l.tipo==='saida').sort((a,b)=>valorLancamento(b,Boolean(b.data_realizada))-valorLancamento(a,Boolean(a.data_realizada))).slice(0,15), [filtrados]);
  const maioresEntradas = useMemo(() => [...filtrados].filter(l=>l.tipo==='entrada').sort((a,b)=>valorLancamento(b,Boolean(b.data_realizada))-valorLancamento(a,Boolean(a.data_realizada))).slice(0,15), [filtrados]);

  const pontualidade = useMemo(() => {
    const comparaveis = realizados.filter(l => l.data_prevista && l.data_realizada);
    const grupos = { antecipados: 0, noPrazo: 0, atrasados: 0 };
    comparaveis.forEach(l => {
      const p = dateKey(l.data_prevista), r = dateKey(l.data_realizada);
      if (r < p) grupos.antecipados += 1;
      else if (r === p) grupos.noPrazo += 1;
      else grupos.atrasados += 1;
    });
    return { ...grupos, total: comparaveis.length };
  }, [realizados]);

  const liquidez = useMemo(() => {
    const datas = [...new Set(posicoes.map(p => dateKey(p.data)).filter(Boolean))].sort();
    return datas.map((data) => {
      const linhas = posicoes.filter(p => dateKey(p.data) === data);
      return {
        data,
        total: linhas.reduce((s,p)=>s+Number(p.saldo_final_bancario || 0),0),
        gerencial: linhas.reduce((s,p)=>s+Number(p.saldo_financeiro_gerencial || 0),0),
      };
    });
  }, [posicoes]);

  const ultimaPosicaoPorConta = useMemo(() => contas.map((c): { conta: string; banco: string; tipo: string; saldo: number; data?: string | null } => {
    const lista = posicoes.filter(p => p.conta_bancaria_id === c.id).sort((a,b)=>dateKey(b.data).localeCompare(dateKey(a.data)));
    return { conta: c.nome, banco: c.banco, tipo: c.tipo, ...(lista[0] || {}), saldo: Number(lista[0]?.saldo_final_bancario || 0) };
  }), [contas, posicoes]);

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    const linhas = filtrados.map(l => ({
      Situação: l.status,
      'Data prevista': dataPt(l.data_prevista),
      'Data realizada': dataPt(l.data_realizada),
      Tipo: l.tipo,
      Descrição: l.descricao,
      Categoria: l.categoria || '',
      Subcategoria: l.subcategoria || '',
      'Projeto / Centro': l.projeto_centro_custo || '',
      'Valor previsto': Number(l.valor_previsto || 0),
      'Valor realizado': Number(l.valor_realizado || 0),
      Anotação: l.observacoes || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), 'Lançamentos');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ultimaPosicaoPorConta.map(p => ({
      Conta: p.conta, Banco: p.banco, Tipo: p.tipo, Data: dataPt(p.data), Saldo: p.saldo,
    }))), 'Liquidez');
    XLSX.writeFile(wb, `relatorios-financeiros-${hoje}.xlsx`);
  };

  const exportarPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Relatório Financeiro', 14, 14);
    doc.setFontSize(9);
    doc.text(`Período: ${dataInicio || 'início'} a ${dataFim || 'fim'} | Registros: ${filtrados.length}`, 14, 20);
    autoTable(doc, {
      startY: 25,
      head: [['Situação','Prevista','Realizada','Tipo','Descrição','Categoria','Subcategoria','Valor']],
      body: filtrados.slice(0, 500).map(l => [
        l.status || '', dataPt(l.data_prevista), dataPt(l.data_realizada), l.tipo || '',
        l.descricao || '', l.categoria || '', l.subcategoria || '',
        moeda(valorLancamento(l, Boolean(l.data_realizada))),
      ]),
      styles: { fontSize: 7 },
    });
    doc.save(`relatorio-financeiro-${hoje}.pdf`);
  };

  const limpar = () => {
    setDataInicio(''); setDataFim(''); setSituacao('todos'); setTipo('todos');
    setCategoria('todos'); setSubcategoria('todos'); setProjeto('todos'); setBusca('');
  };

  const Kpi = ({ titulo, valor, subtitulo }: { titulo: string; valor: string; subtitulo?: string }) => (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{titulo}</CardDescription>
        <CardTitle className="text-2xl">{valor}</CardTitle>
        {subtitulo && <CardDescription>{subtitulo}</CardDescription>}
      </CardHeader>
    </Card>
  );

  const TabelaFluxo = ({ dados }: { dados: {periodo:string;entradas:number;saidas:number;resultado:number}[] }) => (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader><TableRow><TableHead>Período</TableHead><TableHead className="text-right">Entradas</TableHead><TableHead className="text-right">Saídas</TableHead><TableHead className="text-right">Resultado</TableHead></TableRow></TableHeader>
        <TableBody>{dados.map(d=><TableRow key={d.periodo}><TableCell>{dataPt(d.periodo)}</TableCell><TableCell className="text-right">{moeda(d.entradas)}</TableCell><TableCell className="text-right">{moeda(d.saidas)}</TableCell><TableCell className="text-right font-medium">{moeda(d.resultado)}</TableCell></TableRow>)}</TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Relatórios Financeiros</CardTitle>
          <CardDescription>Relatórios derivados do mesmo fluxo oficial. Os filtros abaixo afetam todos os blocos e as exportações.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input type="date" value={dataInicio} onChange={e=>setDataInicio(e.target.value)} aria-label="Data inicial"/>
            <Input type="date" value={dataFim} onChange={e=>setDataFim(e.target.value)} aria-label="Data final"/>
            <Select value={situacao} onValueChange={setSituacao}><SelectTrigger><SelectValue placeholder="Situação"/></SelectTrigger><SelectContent><SelectItem value="todos">Todas as situações</SelectItem>{opcoes.situacoes.map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
            <Select value={tipo} onValueChange={setTipo}><SelectTrigger><SelectValue placeholder="Tipo"/></SelectTrigger><SelectContent><SelectItem value="todos">Entradas e saídas</SelectItem><SelectItem value="entrada">Entradas</SelectItem><SelectItem value="saida">Saídas</SelectItem></SelectContent></Select>
            <Select value={categoria} onValueChange={setCategoria}><SelectTrigger><SelectValue placeholder="Categoria"/></SelectTrigger><SelectContent><SelectItem value="todos">Todas as categorias</SelectItem>{opcoes.categorias.map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
            <Select value={subcategoria} onValueChange={setSubcategoria}><SelectTrigger><SelectValue placeholder="Subcategoria"/></SelectTrigger><SelectContent><SelectItem value="todos">Todas as subcategorias</SelectItem>{opcoes.subcategorias.map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
            <Select value={projeto} onValueChange={setProjeto}><SelectTrigger><SelectValue placeholder="Projeto / Centro"/></SelectTrigger><SelectContent><SelectItem value="todos">Todos os projetos / centros</SelectItem>{opcoes.projetos.map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar..." className="pl-9"/></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={limpar}>Limpar filtros</Button>
            <Button variant="outline" onClick={exportarExcel}><Download className="mr-2 h-4 w-4"/>Exportar Excel</Button>
            <Button variant="outline" onClick={exportarPdf}><FileText className="mr-2 h-4 w-4"/>Exportar PDF</Button>
            <Badge variant="outline" className="ml-auto">{filtrados.length} lançamentos no filtro</Badge>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="realizado">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="realizado">Realizado</TabsTrigger>
          <TabsTrigger value="projetado">Projetado</TabsTrigger>
          <TabsTrigger value="compromissos">Compromissos</TabsTrigger>
          <TabsTrigger value="analises">Análises</TabsTrigger>
          <TabsTrigger value="liquidez">Liquidez</TabsTrigger>
        </TabsList>

        <TabsContent value="realizado" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Kpi titulo="Entradas realizadas" valor={moeda(totaisRealizado.entradas)} />
            <Kpi titulo="Saídas realizadas" valor={moeda(totaisRealizado.saidas)} />
            <Kpi titulo="Resultado realizado" valor={moeda(totaisRealizado.resultado)} />
          </div>
          <Card><CardHeader><CardTitle>Fluxo realizado diário</CardTitle><CardDescription>Entradas e saídas efetivamente realizadas por dia.</CardDescription></CardHeader><CardContent className="h-[320px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={realizadoDia}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="periodo"/><YAxis/><Tooltip formatter={(v:number)=>moeda(v)}/><Legend/><Bar dataKey="entradas" name="Entradas"/><Bar dataKey="saidas" name="Saídas"/></BarChart></ResponsiveContainer></CardContent></Card>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card><CardHeader><CardTitle>Fluxo semanal</CardTitle></CardHeader><CardContent><TabelaFluxo dados={realizadoSemana}/></CardContent></Card>
            <Card><CardHeader><CardTitle>Fluxo mensal</CardTitle></CardHeader><CardContent><TabelaFluxo dados={realizadoMes}/></CardContent></Card>
          </div>
          <Card><CardHeader><CardTitle>Pontualidade financeira</CardTitle><CardDescription>Compara Data Prevista com Data Realizada quando ambas estão disponíveis.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-4"><Kpi titulo="Comparáveis" valor={String(pontualidade.total)}/><Kpi titulo="Antecipados" valor={String(pontualidade.antecipados)}/><Kpi titulo="No prazo" valor={String(pontualidade.noPrazo)}/><Kpi titulo="Atrasados" valor={String(pontualidade.atrasados)}/></CardContent></Card>
        </TabsContent>

        <TabsContent value="projetado" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Kpi titulo="Saldo de partida" valor={moeda(saldoAtual)} />
            <Kpi titulo="Entradas previstas" valor={moeda(totaisPrevisto.entradas)} />
            <Kpi titulo="Saídas previstas" valor={moeda(totaisPrevisto.saidas)} />
            <Kpi titulo="Menor saldo projetado" valor={moeda(menorSaldo.saldo)} subtitulo={dataPt(menorSaldo.periodo)} />
          </div>
          <Card><CardHeader><CardTitle>Projeção de saldo de caixa</CardTitle><CardDescription>Saldo atual acrescido das entradas previstas e reduzido pelas saídas previstas.</CardDescription></CardHeader><CardContent className="h-[360px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={projecao}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="periodo"/><YAxis/><Tooltip formatter={(v:number)=>moeda(v)}/><Legend/><Line type="monotone" dataKey="saldo" name="Saldo projetado"/><Line type="monotone" dataKey="entradas" name="Entradas"/><Line type="monotone" dataKey="saidas" name="Saídas"/></LineChart></ResponsiveContainer></CardContent></Card>
          <Card><CardHeader><CardTitle>Fluxo previsto</CardTitle></CardHeader><CardContent><TabelaFluxo dados={previstoDia}/></CardContent></Card>
        </TabsContent>

        <TabsContent value="compromissos" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Kpi titulo="Contas a pagar abertas" valor={moeda(contasPagar.reduce((s,l)=>s+valorLancamento(l),0))} subtitulo={`${contasPagar.length} lançamentos`} />
            <Kpi titulo="Contas a receber abertas" valor={moeda(contasReceber.reduce((s,l)=>s+valorLancamento(l),0))} subtitulo={`${contasReceber.length} lançamentos`} />
            <Kpi titulo="Vencidos não realizados" valor={moeda(vencidos.reduce((s,l)=>s+valorLancamento(l),0))} subtitulo={`${vencidos.length} lançamentos`} />
          </div>
          <Card><CardHeader><CardTitle>Agenda financeira</CardTitle><CardDescription>Compromissos futuros ordenados pela Data Prevista.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Situação</TableHead><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader><TableBody>{[...abertos].sort((a,b)=>dateKey(a.data_prevista).localeCompare(dateKey(b.data_prevista))).map(l=><TableRow key={l.id}><TableCell>{dataPt(l.data_prevista)}</TableCell><TableCell>{l.tipo}</TableCell><TableCell>{l.status}</TableCell><TableCell><div className="flex min-w-[220px] flex-wrap items-center gap-2"><span>{l.descricao}</span><IndicadorPagina54 dados={l}/></div></TableCell><TableCell>{l.categoria||'—'}</TableCell><TableCell className="text-right">{moeda(valorLancamento(l))}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
        </TabsContent>

        <TabsContent value="analises" className="mt-4 space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card><CardHeader><CardTitle>Fluxo por categoria</CardTitle></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead className="text-right">Entradas</TableHead><TableHead className="text-right">Saídas</TableHead><TableHead className="text-right">Líquido</TableHead></TableRow></TableHeader><TableBody>{porCategoria.map(x=><TableRow key={x.nome}><TableCell>{x.nome}</TableCell><TableCell className="text-right">{moeda(x.entradas)}</TableCell><TableCell className="text-right">{moeda(x.saidas)}</TableCell><TableCell className="text-right">{moeda(x.total)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
            <Card><CardHeader><CardTitle>Fluxo por subcategoria</CardTitle></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Subcategoria</TableHead><TableHead className="text-right">Entradas</TableHead><TableHead className="text-right">Saídas</TableHead></TableRow></TableHeader><TableBody>{porSubcategoria.slice(0,30).map(x=><TableRow key={x.nome}><TableCell>{x.nome}</TableCell><TableCell className="text-right">{moeda(x.entradas)}</TableCell><TableCell className="text-right">{moeda(x.saidas)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card><CardHeader><CardTitle>Principais saídas</CardTitle></CardHeader><CardContent>{maioresSaidas.map((l,i)=><div key={l.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm"><div className="flex min-w-0 items-center gap-2"><span className="truncate">{i+1}. {l.descricao}</span><IndicadorPagina54 dados={l}/></div><span className="shrink-0 font-medium">{moeda(valorLancamento(l,Boolean(l.data_realizada)))}</span></div>)}</CardContent></Card>
            <Card><CardHeader><CardTitle>Principais entradas</CardTitle></CardHeader><CardContent>{maioresEntradas.map((l,i)=><div key={l.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm"><div className="flex min-w-0 items-center gap-2"><span className="truncate">{i+1}. {l.descricao}</span><IndicadorPagina54 dados={l}/></div><span className="shrink-0 font-medium">{moeda(valorLancamento(l,Boolean(l.data_realizada)))}</span></div>)}</CardContent></Card>
          </div>
          <Card><CardHeader><CardTitle>Fluxo por anotação</CardTitle><CardDescription>A granularidade depende da padronização do campo Anotação.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Anotação</TableHead><TableHead className="text-right">Entradas</TableHead><TableHead className="text-right">Saídas</TableHead></TableRow></TableHeader><TableBody>{porAnotacao.slice(0,40).map(x=><TableRow key={x.nome}><TableCell>{x.nome}</TableCell><TableCell className="text-right">{moeda(x.entradas)}</TableCell><TableCell className="text-right">{moeda(x.saidas)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
        </TabsContent>

        <TabsContent value="liquidez" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Kpi titulo="Liquidez consolidada atual" valor={moeda(saldoAtual)} />
            <Kpi titulo="Contas / aplicações monitoradas" valor={String(ultimaPosicaoPorConta.length)} />
            <Kpi titulo="Última posição disponível" valor={dataPt(liquidez.at(-1)?.data)} />
          </div>
          <Card><CardHeader><CardTitle>Evolução do saldo bancário</CardTitle></CardHeader><CardContent className="h-[340px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={liquidez}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="data"/><YAxis/><Tooltip formatter={(v:number)=>moeda(v)}/><Legend/><Line type="monotone" dataKey="total" name="Saldo bancário"/><Line type="monotone" dataKey="gerencial" name="Saldo gerencial"/></LineChart></ResponsiveContainer></CardContent></Card>
          <Card><CardHeader><CardTitle>Posição por banco / conta</CardTitle></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Conta</TableHead><TableHead>Banco</TableHead><TableHead>Tipo</TableHead><TableHead>Data</TableHead><TableHead className="text-right">Saldo</TableHead></TableRow></TableHeader><TableBody>{ultimaPosicaoPorConta.map(p=><TableRow key={p.conta}><TableCell>{p.conta}</TableCell><TableCell>{p.banco}</TableCell><TableCell>{p.tipo||'—'}</TableCell><TableCell>{dataPt(p.data)}</TableCell><TableCell className="text-right">{moeda(p.saldo)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
        </TabsContent>
      </Tabs>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Cobertura da matriz de relatórios</CardTitle>
          <CardDescription>
            Esta área consolida realizado diário/semanal/mensal, previsto, previsto x realizado, saldo projetado, menor saldo, contas a pagar/receber, vencidos, agenda, categorias, subcategorias, anotação, maiores entradas/saídas, pontualidade, evolução bancária, posição por banco e liquidez. Cenários simulados e desvio histórico de valor previsto x realizado exigem preservar versões do planejamento antes de alterações futuras.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
};
