import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Clock, Info, Search, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { LocalUtilizacaoConfig } from '@/hooks/useConfiguracoes';
import { calcularDuracaoProducao } from '@/hooks/useProducao';
import { useProducaoAnexos } from '@/hooks/useProducaoAnexos';
import { useProcessosProducao } from '@/hooks/useProcessosProducao';
import { useProjetosProducao } from '@/hooks/useProjetosProducao';
import type { NovoApontamentoProducao, ProducaoApontamento, ProducaoLocalTipo, ProducaoMembro, ProducaoTarefa } from '@/types/producao';

interface Props {
  tarefas: ProducaoTarefa[];
  locais: LocalUtilizacaoConfig[];
  membros: ProducaoMembro[];
  podeApontar: boolean;
  criarApontamento: (dados: NovoApontamentoProducao) => Promise<ProducaoApontamento>;
  onSuccess?: () => Promise<unknown> | unknown;
}

const hoje = () => new Date().toISOString().slice(0, 10);
const horaAtual = () => new Date().toTimeString().slice(0, 5);
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];
const TAMANHO_MAXIMO = 10 * 1024 * 1024;

export const FormApontamentoProducaoV2 = ({ tarefas, membros, podeApontar, criarApontamento, onSuccess }: Props) => {
  const [data, setData] = useState(hoje());
  const [processoId, setProcessoId] = useState('');
  const [projetoId, setProjetoId] = useState('');
  const [localOperacionalId, setLocalOperacionalId] = useState('');
  const [tarefaId, setTarefaId] = useState('');
  const [localTipo, setLocalTipo] = useState<ProducaoLocalTipo>('Fábrica');
  const [inicio, setInicio] = useState('');
  const [termino, setTermino] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [minutosImprodutivos, setMinutosImprodutivos] = useState('0');
  const [motivoImprodutivo, setMotivoImprodutivo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [membrosIds, setMembrosIds] = useState<string[]>([]);
  const [buscaMembro, setBuscaMembro] = useState('');
  const [fotos, setFotos] = useState<File[]>([]);
  const [salvando, setSalvando] = useState(false);
  const inputFotosRef = useRef<HTMLInputElement>(null);
  const { processos, listarProcessos } = useProcessosProducao();
  const { projetos, listarProjetos } = useProjetosProducao();
  const { anexarImagem } = useProducaoAnexos();

  useEffect(() => { void Promise.all([listarProcessos('em_andamento'), listarProjetos(true)]); }, [listarProcessos, listarProjetos]);

  const processoSelecionado = processos.find((processo) => processo.id === processoId) ?? null;
  const projetoSelecionado = projetos.find((projeto) => projeto.id === projetoId) ?? null;
  const locaisAvulsos = projetoSelecionado?.locais.filter((local) => local.ativo) ?? [];
  const duracao = useMemo(() => {
    if (!inicio || !termino) return null;
    try { return calcularDuracaoProducao(inicio, termino); } catch { return null; }
  }, [inicio, termino]);

  const membrosFiltrados = useMemo(() => {
    const termo = buscaMembro.trim().toLocaleLowerCase('pt-BR');
    if (!termo) return [];
    return membros.filter((membro) => membro.ativo && !membrosIds.includes(membro.id))
      .filter((membro) => membro.nome.toLocaleLowerCase('pt-BR').includes(termo)).slice(0, 8);
  }, [buscaMembro, membros, membrosIds]);

  const selecionarProcesso = (value: string) => {
    const novo = value === '__nenhum__' ? '' : value;
    setProcessoId(novo);
    if (!novo) return;
    const processo = processos.find((item) => item.id === novo);
    setProjetoId('');
    setLocalOperacionalId('');
    const tipo = processo?.local_operacional?.tipo;
    setLocalTipo(tipo && ['execucao', 'logistica', 'manutencao'].includes(tipo) ? 'Execução' : 'Fábrica');
  };

  const limpar = () => {
    setData(hoje()); setProcessoId(''); setProjetoId(''); setLocalOperacionalId(''); setTarefaId('');
    setLocalTipo('Fábrica'); setInicio(''); setTermino(''); setQuantidade(''); setMinutosImprodutivos('0');
    setMotivoImprodutivo(''); setObservacoes(''); setMembrosIds([]); setBuscaMembro(''); setFotos([]);
    if (inputFotosRef.current) inputFotosRef.current.value = '';
  };

  const selecionarFotos = (arquivos: FileList | null) => {
    if (!arquivos) return;
    const validas: File[] = [];
    Array.from(arquivos).forEach((arquivo) => {
      if (!TIPOS_PERMITIDOS.includes(arquivo.type)) return void toast.error(`${arquivo.name}: formato não permitido.`);
      if (arquivo.size <= 0 || arquivo.size > TAMANHO_MAXIMO) return void toast.error(`${arquivo.name}: a imagem deve possuir até 10 MB.`);
      validas.push(arquivo);
    });
    setFotos((atuais) => {
      const chaves = new Set(atuais.map((arquivo) => `${arquivo.name}-${arquivo.size}-${arquivo.lastModified}`));
      return [...atuais, ...validas.filter((arquivo) => !chaves.has(`${arquivo.name}-${arquivo.size}-${arquivo.lastModified}`))];
    });
  };

  const salvar = async (event: FormEvent) => {
    event.preventDefault();
    if (!podeApontar) return;
    if (!processoId && (!projetoId || !localOperacionalId)) return void toast.error('Selecione uma etapa ou informe projeto e local operacional.');
    if (!tarefaId) return void toast.error('Selecione uma tarefa.');
    if (!duracao) return void toast.error('Informe horários válidos de início e término.');
    if (membrosIds.length === 0) return void toast.error('Selecione pelo menos um membro da equipe.');
    const improdutivos = Number(minutosImprodutivos || 0);
    if (!Number.isInteger(improdutivos) || improdutivos < 0 || improdutivos > duracao) return void toast.error('O tempo improdutivo deve ficar entre zero e a duração total.');
    if (improdutivos > 0 && !motivoImprodutivo.trim()) return void toast.error('Informe o motivo do tempo improdutivo.');
    const quantidadeNormalizada = quantidade.trim() ? Number(quantidade.replace(',', '.')) : null;
    if (quantidadeNormalizada !== null && (!Number.isFinite(quantidadeNormalizada) || quantidadeNormalizada < 0)) return void toast.error('Informe uma quantidade válida.');

    setSalvando(true);
    try {
      const apontamento = await criarApontamento({
        data,
        processo_id: processoId || null,
        projeto_id: processoId ? null : projetoId,
        projeto_local_operacional_id: processoId ? null : localOperacionalId,
        tarefa_id: tarefaId,
        local_tipo: localTipo,
        quantidade_produzida: quantidadeNormalizada,
        inicio, termino,
        minutos_produtivos: duracao - improdutivos,
        minutos_improdutivos: improdutivos,
        motivo_improdutivo: improdutivos > 0 ? motivoImprodutivo.trim() : null,
        observacoes: observacoes.trim() || null,
        membros_ids: membrosIds,
      });
      let falhas = 0;
      for (const foto of fotos) { try { await anexarImagem(apontamento.id, foto); } catch { falhas += 1; } }
      if (falhas > 0) toast.warning(`Apontamento salvo, mas ${falhas} foto(s) não foram enviadas.`);
      else toast.success(fotos.length > 0 ? `Apontamento salvo com ${fotos.length} foto(s), pendente de conferência.` : 'Apontamento salvo como pendente de conferência.');
      limpar();
      await onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o apontamento.');
    } finally { setSalvando(false); }
  };

  return (
    <form onSubmit={salvar} className="space-y-6 rounded-lg border bg-card p-5">
      <div><h3 className="text-lg font-semibold">Novo Apontamento</h3><p className="text-sm text-muted-foreground">Registre a execução real, a equipe e as evidências fotográficas.</p></div>
      <Alert><Info className="h-4 w-4" /><AlertDescription>Ao escolher uma <strong>etapa</strong>, projeto e local operacional são herdados automaticamente. Para registro avulso, selecione ambos manualmente.</AlertDescription></Alert>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label>Data</Label><Input type="date" value={data} onChange={(event) => setData(event.target.value)} disabled={!podeApontar} /></div>
        <div className="space-y-2"><Label>Etapa em andamento — opcional</Label><Select value={processoId || '__nenhum__'} onValueChange={selecionarProcesso} disabled={!podeApontar}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__nenhum__">Apontamento avulso</SelectItem>{processos.map((processo) => <SelectItem key={processo.id} value={processo.id}>{processo.codigo} · {processo.nome} · {processo.projeto?.nome ?? 'Projeto'} · {processo.local_operacional?.nome ?? 'Local'}</SelectItem>)}</SelectContent></Select>{processoSelecionado && <p className="text-xs text-muted-foreground">Herdado: {processoSelecionado.projeto?.nome} · {processoSelecionado.local_operacional?.nome}</p>}</div>
        <div className="space-y-2"><Label>Projeto avulso {processoId ? '(herdado)' : '*'}</Label><Select value={projetoId} onValueChange={(value) => { setProjetoId(value); setLocalOperacionalId(''); }} disabled={!podeApontar || Boolean(processoId)}><SelectTrigger><SelectValue placeholder="Selecione o projeto" /></SelectTrigger><SelectContent>{projetos.map((projeto) => <SelectItem key={projeto.id} value={projeto.id}>{projeto.nome}{projeto.cidade ? ` · ${projeto.cidade}/${projeto.uf ?? ''}` : ''}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Local operacional {processoId ? '(herdado)' : '*'}</Label><Select value={localOperacionalId} onValueChange={(value) => { setLocalOperacionalId(value); const local = locaisAvulsos.find((item) => item.id === value); setLocalTipo(local && ['execucao', 'logistica', 'manutencao'].includes(local.tipo) ? 'Execução' : 'Fábrica'); }} disabled={!podeApontar || Boolean(processoId) || !projetoId}><SelectTrigger><SelectValue placeholder="Selecione onde a atividade ocorreu" /></SelectTrigger><SelectContent>{locaisAvulsos.map((local) => <SelectItem key={local.id} value={local.id}>{local.nome} · {local.tipo}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Tarefa *</Label><Select value={tarefaId} onValueChange={setTarefaId} disabled={!podeApontar}><SelectTrigger><SelectValue placeholder="Selecione a atividade" /></SelectTrigger><SelectContent>{tarefas.filter((tarefa) => tarefa.ativo).map((tarefa) => <SelectItem key={tarefa.id} value={tarefa.id}>{tarefa.nome}</SelectItem>)}</SelectContent></Select></div>
      </div>

      <div className="space-y-2"><Label>Contexto da execução</Label><div className="flex gap-2">{(['Fábrica', 'Execução'] as ProducaoLocalTipo[]).map((tipo) => <Button key={tipo} type="button" variant={localTipo === tipo ? 'default' : 'outline'} onClick={() => setLocalTipo(tipo)} disabled={!podeApontar}>{tipo}</Button>)}</div></div>
      <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Início *</Label><div className="flex gap-2"><Input type="time" value={inicio} onChange={(event) => setInicio(event.target.value)} /><Button type="button" variant="outline" onClick={() => setInicio(horaAtual())}><Clock className="mr-2 h-4 w-4" />Agora</Button></div></div><div className="space-y-2"><Label>Término *</Label><div className="flex gap-2"><Input type="time" value={termino} onChange={(event) => setTermino(event.target.value)} /><Button type="button" variant="outline" onClick={() => setTermino(horaAtual())}><Clock className="mr-2 h-4 w-4" />Agora</Button></div></div></div>
      {duracao && <p className="rounded-md border bg-muted/20 p-3 text-sm">Duração calculada: <strong>{duracao} minutos</strong></p>}
      <div className="grid gap-4 md:grid-cols-3"><div className="space-y-2"><Label>Quantidade produzida</Label><Input inputMode="decimal" value={quantidade} onChange={(event) => setQuantidade(event.target.value)} /></div><div className="space-y-2"><Label>Minutos improdutivos</Label><Input inputMode="numeric" value={minutosImprodutivos} onChange={(event) => setMinutosImprodutivos(event.target.value)} /></div><div className="space-y-2"><Label>Motivo improdutivo</Label><Input value={motivoImprodutivo} onChange={(event) => setMotivoImprodutivo(event.target.value)} disabled={Number(minutosImprodutivos || 0) === 0} /></div></div>

      <div className="space-y-2"><Label>Equipe *</Label><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={buscaMembro} onChange={(event) => setBuscaMembro(event.target.value)} placeholder="Buscar membro" /></div>{membrosFiltrados.length > 0 && <div className="rounded-md border">{membrosFiltrados.map((membro) => <button key={membro.id} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { setMembrosIds((atuais) => [...atuais, membro.id]); setBuscaMembro(''); }}>{membro.nome}</button>)}</div>}<div className="flex flex-wrap gap-2">{membrosIds.map((id) => { const membro = membros.find((item) => item.id === id); return <Button key={id} type="button" size="sm" variant="secondary" onClick={() => setMembrosIds((atuais) => atuais.filter((item) => item !== id))}>{membro?.nome ?? id} ×</Button>; })}</div></div>

      <div className="space-y-3 rounded-lg border p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><Label>Evidências fotográficas</Label><p className="text-xs text-muted-foreground">JPEG, PNG ou WebP, até 10 MB por foto.</p></div><input ref={inputFotosRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(event) => selecionarFotos(event.target.files)} /><Button type="button" variant="outline" onClick={() => inputFotosRef.current?.click()} disabled={!podeApontar}><Camera className="mr-2 h-4 w-4" />Adicionar fotos</Button></div>{fotos.length === 0 ? <div className="flex items-center gap-2 rounded-md bg-muted/20 p-3 text-sm text-muted-foreground"><Upload className="h-4 w-4" />Nenhuma foto selecionada.</div> : <div className="grid gap-2 sm:grid-cols-2">{fotos.map((foto, indice) => <div key={`${foto.name}-${foto.size}-${foto.lastModified}`} className="flex items-center justify-between gap-2 rounded-md border p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{foto.name}</p><p className="text-xs text-muted-foreground">{(foto.size / 1024 / 1024).toFixed(2)} MB</p></div><Button type="button" size="icon" variant="ghost" onClick={() => setFotos((atuais) => atuais.filter((_, i) => i !== indice))}><Trash2 className="h-4 w-4 text-red-500" /></Button></div>)}</div>}</div>
      <div className="space-y-2"><Label>Observações</Label><Textarea value={observacoes} onChange={(event) => setObservacoes(event.target.value)} rows={4} /></div>
      <div className="flex justify-end"><Button type="submit" disabled={!podeApontar || salvando}>{salvando ? 'Salvando...' : 'Salvar como pendente'}</Button></div>
    </form>
  );
};
