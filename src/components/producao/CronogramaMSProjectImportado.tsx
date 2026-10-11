import { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isSameDay,
  isSaturday,
  isSunday,
  parseISO,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, FileClock, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { ArquivoMSProjectNormalizado, lerArquivoMSProjectNormalizado } from '@/utils/msprojectImportacao';

type Escala = 'plano' | '14dias' | 'mes';

export type ProjetoDoSistemaNoCronograma = {
  id: string;
  nome: string;
  cidade: string | null;
};

type ImportacaoMSProject = {
  id: string;
  arquivo_nome: string;
  inicio_planejado_original: string | null;
  fim_planejado_original: string | null;
  total_tarefas: number;
  status: string;
  criado_em: string;
};

type TarefaMSProject = {
  id: string;
  uid_origem: number;
  nome: string;
  referencia_msproject: string | null;
  cidade_msproject: string | null;
  inicio_planejado_original: string;
  fim_planejado_original: string;
  percentual_concluido_origem: number;
};

type LinhaProjeto = {
  tipo: 'projeto';
  id: string;
  titulo: string;
};

type LinhaTarefa = {
  tipo: 'tarefa';
  id: string;
  tarefa: TarefaMSProject;
};

type Linha = LinhaProjeto | LinhaTarefa;

type CronogramaMSProjectImportadoProps = {
  projetosDoSistema?: ProjetoDoSistemaNoCronograma[];
};

type ConsultaImportacoes = {
  select: (colunas: string) => {
    order: (coluna: string, opcoes: { ascending: boolean }) => {
      limit: (quantidade: number) => Promise<{ data: ImportacaoMSProject[] | null; error: Error | null }>;
    };
  };
};

type ConsultaTarefas = {
  select: (colunas: string) => {
    eq: (coluna: string, valor: string) => {
      order: (coluna: string, opcoes: { ascending: boolean }) => Promise<{ data: TarefaMSProject[] | null; error: Error | null }>;
    };
  };
};

type ClienteMSProject = {
  from: (tabela: 'producao_msproject_importacoes') => ConsultaImportacoes;
  from: (tabela: 'producao_msproject_tarefas_importadas') => ConsultaTarefas;
};

const bancoMSProject = supabase as unknown as ClienteMSProject;
const larguraRotulo = 380;
const alturaProjeto = 38;
const alturaTarefa = 46;

const data = (valor: string) => parseISO(valor);

const normalizarTexto = (valor: string | null | undefined) =>
  (valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');

const projetoDoSistema = (tarefa: TarefaMSProject, porCidade: Map<string, ProjetoDoSistemaNoCronograma | null>) =>
  porCidade.get(normalizarTexto(tarefa.cidade_msproject)) ?? null;

const chaveProjeto = (tarefa: TarefaMSProject, porCidade: Map<string, ProjetoDoSistemaNoCronograma | null>) => {
  const projeto = projetoDoSistema(tarefa, porCidade);
  return projeto ? `sistema::${projeto.id}` : `${tarefa.referencia_msproject ?? 'Sem referência'}::${tarefa.cidade_msproject ?? 'Sem cidade'}`;
};

const tituloProjeto = (tarefa: TarefaMSProject, porCidade: Map<string, ProjetoDoSistemaNoCronograma | null>) => {
  const projeto = projetoDoSistema(tarefa, porCidade);
  if (projeto) return projeto.nome;
  return [tarefa.referencia_msproject ?? 'Sem referência no Project', tarefa.cidade_msproject]
    .filter(Boolean)
    .join(' · ');
};

const periodoDaEscala = (referencia: Date, escala: Escala, inicioPlano: string | null, fimPlano: string | null) => {
  if (escala === 'plano' && inicioPlano && fimPlano) {
    return { inicio: startOfDay(data(inicioPlano)), fim: startOfDay(data(fimPlano)) };
  }
  if (escala === 'mes') {
    const inicio = startOfMonth(referencia);
    return { inicio, fim: endOfMonth(referencia) };
  }
  return { inicio: referencia, fim: addDays(referencia, 13) };
};

export const CronogramaMSProjectImportado = ({ projetosDoSistema = [] }: CronogramaMSProjectImportadoProps) => {
  const [importacoes, setImportacoes] = useState<ImportacaoMSProject[]>([]);
  const [importacaoId, setImportacaoId] = useState<string | null>(null);
  const [tarefas, setTarefas] = useState<TarefaMSProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [escala, setEscala] = useState<Escala>('plano');
  const [referencia, setReferencia] = useState(new Date());
  const [previsualizacaoLocal, setPrevisualizacaoLocal] = useState<ArquivoMSProjectNormalizado | null>(null);

  const carregarImportacoes = async () => {
    setLoading(true);
    setErro(null);
    try {
      const { data: dados, error } = await bancoMSProject
        .from('producao_msproject_importacoes')
        .select('id,arquivo_nome,inicio_planejado_original,fim_planejado_original,total_tarefas,status,criado_em')
        .order('criado_em', { ascending: false })
        .limit(20);
      if (error) throw error;
      const resultado = dados ?? [];
      setImportacoes(resultado);
      setImportacaoId((atual) => atual && resultado.some((item) => item.id === atual) ? atual : resultado[0]?.id ?? null);
    } catch (causa) {
      setImportacoes([]);
      setImportacaoId(null);
      setErro(causa instanceof Error ? causa.message : 'Não foi possível carregar as importações do Project.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void carregarImportacoes(); }, []);

  const carregarPlanoLocal = async () => {
    if (!import.meta.env.DEV) return;
    try {
      const resposta = await fetch('/_local/msproject/natal-2026');
      if (!resposta.ok) throw new Error('O plano local do Project ainda não foi gerado.');
      const arquivo = new File([await resposta.blob()], 'Natal 2026 v21.mpp', { type: 'application/json' });
      const documento = await lerArquivoMSProjectNormalizado(arquivo);
      setPrevisualizacaoLocal(documento);
      setErro(null);
      const inicio = documento.inicio_planejado_original ?? documento.tarefas[0]?.inicio_planejado_original;
      if (inicio) setReferencia(data(inicio));
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível carregar o plano local do Project.');
    }
  };

  useEffect(() => { void carregarPlanoLocal(); }, []);

  useEffect(() => {
    if (!importacaoId) {
      setTarefas([]);
      return;
    }
    let ativo = true;
    void (async () => {
      setLoading(true);
      try {
        const { data: dados, error } = await bancoMSProject
          .from('producao_msproject_tarefas_importadas')
          .select('id,uid_origem,nome,referencia_msproject,cidade_msproject,inicio_planejado_original,fim_planejado_original,percentual_concluido_origem')
          .eq('importacao_id', importacaoId)
          .order('inicio_planejado_original', { ascending: true });
        if (error) throw error;
        if (!ativo) return;
        const resultado = dados ?? [];
        setTarefas(resultado);
        if (resultado[0]) setReferencia(data(resultado[0].inicio_planejado_original));
      } catch (causa) {
        if (ativo) {
          setTarefas([]);
          setErro(causa instanceof Error ? causa.message : 'Não foi possível carregar as tarefas do Project.');
        }
      } finally {
        if (ativo) setLoading(false);
      }
    })();
    return () => { ativo = false; };
  }, [importacaoId]);

  const importacaoRemota = importacoes.find((item) => item.id === importacaoId) ?? null;
  const importacaoLocal: ImportacaoMSProject | null = previsualizacaoLocal ? {
    id: 'previsualizacao-local',
    arquivo_nome: previsualizacaoLocal.arquivo_nome,
    inicio_planejado_original: previsualizacaoLocal.inicio_planejado_original,
    fim_planejado_original: previsualizacaoLocal.fim_planejado_original,
    total_tarefas: previsualizacaoLocal.tarefas.length,
    status: 'previsualizacao_local',
    criado_em: new Date().toISOString(),
  } : null;
  const importacao = importacaoLocal ?? importacaoRemota;
  const tarefasDaVisualizacao = previsualizacaoLocal
    ? previsualizacaoLocal.tarefas.map((tarefa) => ({
      id: `local-${tarefa.uid_origem}`,
      uid_origem: tarefa.uid_origem,
      nome: tarefa.nome,
      referencia_msproject: tarefa.referencia_msproject,
      cidade_msproject: tarefa.cidade_msproject,
      inicio_planejado_original: tarefa.inicio_planejado_original,
      fim_planejado_original: tarefa.fim_planejado_original,
      percentual_concluido_origem: tarefa.percentual_concluido_origem,
    }))
    : tarefas;
  const erroVisivel = previsualizacaoLocal ? null : erro;
  const projetosPorCidade = useMemo(() => {
    const candidatos = new Map<string, ProjetoDoSistemaNoCronograma[]>();
    projetosDoSistema.forEach((projeto) => {
      const cidade = normalizarTexto(projeto.cidade);
      if (!cidade) return;
      const itens = candidatos.get(cidade) ?? [];
      if (!itens.some((item) => item.id === projeto.id)) itens.push(projeto);
      candidatos.set(cidade, itens);
    });
    return new Map([...candidatos.entries()].map(([cidade, itens]) => [cidade, itens.length === 1 ? itens[0] : null]));
  }, [projetosDoSistema]);
  const periodo = useMemo(() => periodoDaEscala(
    referencia,
    escala,
    importacao?.inicio_planejado_original ?? null,
    importacao?.fim_planejado_original ?? null,
  ), [escala, importacao?.fim_planejado_original, importacao?.inicio_planejado_original, referencia]);
  const dias = useMemo(() => Array.from(
    { length: differenceInCalendarDays(periodo.fim, periodo.inicio) + 1 },
    (_, indice) => addDays(periodo.inicio, indice),
  ), [periodo]);
  const pixelsPorDia = escala === 'plano' ? 20 : escala === 'mes' ? 48 : 78;
  const larguraTimeline = dias.length * pixelsPorDia;

  const linhas = useMemo<Linha[]>(() => {
    const visiveis = tarefasDaVisualizacao.filter((tarefa) => {
      const inicio = data(tarefa.inicio_planejado_original);
      const fim = data(tarefa.fim_planejado_original);
      return fim >= periodo.inicio && inicio <= periodo.fim;
    });
    const grupos = new Map<string, TarefaMSProject[]>();
    visiveis.forEach((tarefa) => {
      const chave = chaveProjeto(tarefa, projetosPorCidade);
      const itens = grupos.get(chave) ?? [];
      itens.push(tarefa);
      grupos.set(chave, itens);
    });
    return [...grupos.entries()]
      .sort(([, a], [, b]) => tituloProjeto(a[0], projetosPorCidade).localeCompare(tituloProjeto(b[0], projetosPorCidade), 'pt-BR'))
      .flatMap(([chave, itens]) => [
        { tipo: 'projeto' as const, id: `projeto-${chave}`, titulo: tituloProjeto(itens[0], projetosPorCidade) },
        ...itens.map((tarefa) => ({ tipo: 'tarefa' as const, id: tarefa.id, tarefa })),
      ]);
  }, [periodo.fim, periodo.inicio, projetosPorCidade, tarefasDaVisualizacao]);

  const resumoCompatibilizacao = useMemo(() => {
    const cidadesComProjeto = new Set<string>();
    const cidadesSemProjeto = new Set<string>();
    tarefasDaVisualizacao.forEach((tarefa) => {
      const cidade = normalizarTexto(tarefa.cidade_msproject);
      if (!cidade) return;
      if (projetoDoSistema(tarefa, projetosPorCidade)) cidadesComProjeto.add(cidade);
      else cidadesSemProjeto.add(cidade);
    });
    return { cidadesComProjeto: cidadesComProjeto.size, cidadesSemProjeto: cidadesSemProjeto.size };
  }, [projetosPorCidade, tarefasDaVisualizacao]);

  const navegar = (direcao: -1 | 1) => {
    if (escala === 'plano') return;
    setReferencia((atual) => escala === 'mes'
      ? new Date(atual.getFullYear(), atual.getMonth() + direcao, 1)
      : addDays(atual, direcao * 14));
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2"><FileClock className="h-5 w-5 text-primary" /><h4 className="font-semibold">Plano original — Microsoft Project</h4></div>
            <p className="mt-1 text-sm text-muted-foreground">Cronograma do Project, separado da execução real das OPs e dos apontamentos.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => { void carregarImportacoes(); void carregarPlanoLocal(); }} disabled={loading}><RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />Atualizar plano</Button>
          </div>
        </div>
      </Card>

      {erroVisivel && (
        <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Plano do Project indisponível</AlertTitle><AlertDescription>{erroVisivel}</AlertDescription></Alert>
      )}

      {!loading && !erroVisivel && !previsualizacaoLocal && importacoes.length === 0 && (
        <Alert><FileClock className="h-4 w-4" /><AlertTitle>Nenhum plano do Project foi pré-importado</AlertTitle><AlertDescription>Use “Abrir prévia local” para conferir o JSON extraído do Project sem alterar a base, ou faça a pré-importação controlada em Produção → Configurações para disponibilizá-lo para toda a equipe.</AlertDescription></Alert>
      )}

      {importacao && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b p-3 print:hidden">
            {!previsualizacaoLocal && <Select value={importacaoId ?? undefined} onValueChange={setImportacaoId}>
              <SelectTrigger className="w-[320px]"><SelectValue /></SelectTrigger>
              <SelectContent>{importacoes.map((item) => <SelectItem key={item.id} value={item.id}>{item.arquivo_nome} · {item.total_tarefas} tarefas</SelectItem>)}</SelectContent>
            </Select>}
            <Select value={escala} onValueChange={(valor) => setEscala(valor as Escala)}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="plano">Plano completo</SelectItem><SelectItem value="14dias">14 dias</SelectItem><SelectItem value="mes">Mês</SelectItem></SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => navegar(-1)} disabled={escala === 'plano'}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" onClick={() => setReferencia(new Date(importacao.inicio_planejado_original ?? referencia))}><CalendarDays className="mr-2 h-4 w-4" />Início do plano</Button>
            <Button variant="outline" size="icon" onClick={() => navegar(1)} disabled={escala === 'plano'}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="border-b bg-muted/20 px-4 py-2 text-sm text-muted-foreground">
            Origem: {importacao.arquivo_nome} · {format(data(importacao.inicio_planejado_original ?? referencia.toISOString()), 'dd/MM/yyyy')} a {format(data(importacao.fim_planejado_original ?? referencia.toISOString()), 'dd/MM/yyyy')} · {previsualizacaoLocal ? 'plano local carregado automaticamente — ainda não gravado no banco' : 'planejamento original'}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 border-b px-4 py-2 text-xs text-muted-foreground">
            <span>{resumoCompatibilizacao.cidadesComProjeto} cidade(s) exibida(s) sob um projeto já cadastrado</span>
            <span>{resumoCompatibilizacao.cidadesSemProjeto} cidade(s) ainda sem vínculo inequívoco com projeto do sistema</span>
          </div>
          <div className="max-h-[70vh] overflow-auto">
            <div className="flex" style={{ width: larguraRotulo + larguraTimeline }}>
              <div className="sticky left-0 z-20 shrink-0 border-r bg-card" style={{ width: larguraRotulo }}>
                <div className="sticky top-0 z-30 flex h-14 items-end border-b bg-muted/70 px-3 pb-3 text-xs font-semibold">Projeto / atividade do Project</div>
                {linhas.map((linha) => linha.tipo === 'projeto' ? (
                  <div key={linha.id} className="flex items-center border-b bg-muted/35 px-3 text-xs font-semibold" style={{ height: alturaProjeto }}>{linha.titulo}</div>
                ) : (
                  <div key={linha.id} className="flex min-w-0 items-center gap-2 border-b px-3 text-xs" style={{ height: alturaTarefa }}><span className="h-2 w-2 shrink-0 rounded-full border border-primary/70" /><div className="min-w-0"><div className="truncate font-medium">{linha.tarefa.nome}</div><div className="text-[11px] text-muted-foreground">{linha.tarefa.referencia_msproject ?? 'Sem referência'} · UID {linha.tarefa.uid_origem} · {Math.round(linha.tarefa.percentual_concluido_origem)}% no Project</div></div></div>
                ))}
              </div>
              <div className="relative" style={{ width: larguraTimeline }}>
                <div className="sticky top-0 z-10 flex h-14 border-b bg-muted/70">{dias.map((dia) => <div key={dia.toISOString()} className={cn('flex shrink-0 flex-col items-center justify-center border-r text-center', (isSaturday(dia) || isSunday(dia)) && 'bg-muted/60', isSameDay(dia, new Date()) && 'bg-emerald-500/15')} style={{ width: pixelsPorDia }}><span className="text-[11px] font-semibold">{format(dia, 'dd')}</span><span className="text-[10px] uppercase text-muted-foreground">{format(dia, 'EEEEE', { locale: ptBR })}</span></div>)}</div>
                {linhas.map((linha) => {
                  if (linha.tipo === 'projeto') return <div key={linha.id} className="relative border-b bg-muted/20" style={{ height: alturaProjeto }} />;
                  const inicio = data(linha.tarefa.inicio_planejado_original);
                  const fim = data(linha.tarefa.fim_planejado_original);
                  const inicioVisivel = inicio < periodo.inicio ? periodo.inicio : inicio;
                  const fimVisivel = fim > periodo.fim ? periodo.fim : fim;
                  const esquerda = differenceInCalendarDays(inicioVisivel, periodo.inicio) * pixelsPorDia;
                  const largura = Math.max(pixelsPorDia, (differenceInCalendarDays(fimVisivel, inicioVisivel) + 1) * pixelsPorDia);
                  const percentual = Math.max(0, Math.min(100, linha.tarefa.percentual_concluido_origem));
                  return <div key={linha.id} className="relative border-b bg-card" style={{ height: alturaTarefa }}>{dias.map((dia, indice) => <div key={dia.toISOString()} className="absolute inset-y-0 border-r" style={{ left: indice * pixelsPorDia, width: pixelsPorDia }} />)}<div className="absolute top-2.5 flex h-7 items-center overflow-hidden rounded-md bg-indigo-500 text-[11px] font-bold text-white shadow-sm" style={{ left: esquerda + 4, width: Math.max(28, largura - 8) }} title={`${linha.tarefa.nome} · ${format(inicio, 'dd/MM/yyyy')} a ${format(fim, 'dd/MM/yyyy')}`}><span className="absolute inset-y-0 left-0 bg-black/20" style={{ width: `${percentual}%` }} /><span className="relative z-10 w-full truncate px-2 text-center">{Math.round(percentual)}%</span></div></div>;
                })}
              </div>
            </div>
            {!loading && linhas.length === 0 && <div className="p-10 text-center text-sm text-muted-foreground">Não há atividades deste plano no período exibido.</div>}
          </div>
        </Card>
      )}
    </div>
  );
};
