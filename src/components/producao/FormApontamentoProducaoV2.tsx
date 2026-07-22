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
import type {
  NovoApontamentoProducao,
  ProducaoApontamento,
  ProducaoLocalTipo,
  ProducaoMembro,
  ProducaoTarefa,
} from '@/types/producao';

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

export const FormApontamentoProducaoV2 = ({
  tarefas,
  locais,
  membros,
  podeApontar,
  criarApontamento,
  onSuccess,
}: Props) => {
  const [data, setData] = useState(hoje());
  const [processoId, setProcessoId] = useState('');
  const [projetoLocalId, setProjetoLocalId] = useState('');
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
  const { anexarImagem } = useProducaoAnexos();

  useEffect(() => {
    void listarProcessos('em_andamento');
  }, [listarProcessos]);

  const processoSelecionado = processos.find((processo) => processo.id === processoId) ?? null;
  const projetoHerdado = processoSelecionado?.projeto?.local_utilizacao_id ?? null;
  const duracao = useMemo(() => {
    if (!inicio || !termino) return null;
    try {
      return calcularDuracaoProducao(inicio, termino);
    } catch {
      return null;
    }
  }, [inicio, termino]);

  const membrosFiltrados = useMemo(() => {
    const termo = buscaMembro.trim().toLocaleLowerCase('pt-BR');
    if (!termo) return [];
    return membros
      .filter((membro) => membro.ativo && !membrosIds.includes(membro.id))
      .filter((membro) => membro.nome.toLocaleLowerCase('pt-BR').includes(termo))
      .slice(0, 8);
  }, [buscaMembro, membros, membrosIds]);

  const limpar = () => {
    setData(hoje());
    setProcessoId('');
    setProjetoLocalId('');
    setTarefaId('');
    setLocalTipo('Fábrica');
    setInicio('');
    setTermino('');
    setQuantidade('');
    setMinutosImprodutivos('0');
    setMotivoImprodutivo('');
    setObservacoes('');
    setMembrosIds([]);
    setBuscaMembro('');
    setFotos([]);
    if (inputFotosRef.current) inputFotosRef.current.value = '';
  };

  const selecionarFotos = (arquivos: FileList | null) => {
    if (!arquivos) return;
    const validas: File[] = [];
    Array.from(arquivos).forEach((arquivo) => {
      if (!TIPOS_PERMITIDOS.includes(arquivo.type)) {
        toast.error(`${arquivo.name}: formato não permitido.`);
        return;
      }
      if (arquivo.size <= 0 || arquivo.size > TAMANHO_MAXIMO) {
        toast.error(`${arquivo.name}: a imagem deve possuir até 10 MB.`);
        return;
      }
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

    if ((processoId ? 1 : 0) + (projetoLocalId ? 1 : 0) !== 1) {
      toast.error('Selecione um processo em andamento ou um projeto/local avulso.');
      return;
    }
    if (!tarefaId) return void toast.error('Selecione uma tarefa.');
    if (!duracao) return void toast.error('Informe horários válidos de início e término.');
    if (membrosIds.length === 0) return void toast.error('Selecione pelo menos um membro da equipe.');

    const improdutivos = Number(minutosImprodutivos || 0);
    if (!Number.isInteger(improdutivos) || improdutivos < 0 || improdutivos > duracao) {
      toast.error('O tempo improdutivo deve ser um número inteiro entre zero e a duração total.');
      return;
    }
    if (improdutivos > 0 && !motivoImprodutivo.trim()) {
      toast.error('Informe o motivo do tempo improdutivo.');
      return;
    }

    const quantidadeNormalizada = quantidade.trim() ? Number(quantidade.replace(',', '.')) : null;
    if (quantidadeNormalizada !== null && (!Number.isFinite(quantidadeNormalizada) || quantidadeNormalizada < 0)) {
      toast.error('Informe uma quantidade válida.');
      return;
    }

    setSalvando(true);
    try {
      const apontamento = await criarApontamento({
        data,
        processo_id: processoId || null,
        projeto_local_id: processoId ? null : projetoLocalId,
        tarefa_id: tarefaId,
        local_tipo: localTipo,
        quantidade_produzida: quantidadeNormalizada,
        inicio,
        termino,
        minutos_produtivos: duracao - improdutivos,
        minutos_improdutivos: improdutivos,
        motivo_improdutivo: improdutivos > 0 ? motivoImprodutivo.trim() : null,
        observacoes: observacoes.trim() || null,
        membros_ids: membrosIds,
      });

      let falhas = 0;
      for (const foto of fotos) {
        try {
          await anexarImagem(apontamento.id, foto);
        } catch {
          falhas += 1;
        }
      }

      if (falhas > 0) {
        toast.warning(`Apontamento salvo, mas ${falhas} foto(s) não foram enviadas.`);
      } else {
        toast.success(fotos.length > 0
          ? `Apontamento salvo com ${fotos.length} foto(s), pendente de conferência.`
          : 'Apontamento salvo como pendente de conferência.');
      }
      limpar();
      await onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o apontamento.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={salvar} className="space-y-6 rounded-lg border bg-card p-5">
      <div>
        <h3 className="text-lg font-semibold">Novo Apontamento</h3>
        <p className="text-sm text-muted-foreground">Registre a execução real, a equipe e as evidências fotográficas.</p>
      </div>

      <Alert><Info className="h-4 w-4" /><AlertDescription><strong>Processo</strong> é a frente macro. <strong>Tarefa</strong> é a atividade específica. O processo é opcional; a tarefa é obrigatória.</AlertDescription></Alert>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label>Data</Label><Input type="date" value={data} onChange={(event) => setData(event.target.value)} disabled={!podeApontar} /></div>
        <div className="space-y-2"><Label>Vincular a processo em andamento — opcional</Label><Select value={processoId || '__nenhum__'} onValueChange={(value) => { const novo = value === '__nenhum__' ? '' : value; setProcessoId(novo); if (novo) setProjetoLocalId(''); }} disabled={!podeApontar}><SelectTrigger><SelectValue placeholder="Selecione um processo" /></SelectTrigger><SelectContent><SelectItem value="__nenhum__">Sem processo — apontamento avulso</SelectItem>{processos.map((processo) => <SelectItem key={processo.id} value={processo.id}>{processo.codigo} · {processo.nome} · {processo.projeto?.nome ?? 'Projeto não identificado'}</SelectItem>)}</SelectContent></Select>{processoSelecionado && <p className="text-xs text-muted-foreground">Projeto herdado: {processoSelecionado.projeto?.nome ?? '—'}{processoSelecionado.projeto?.cidade ? ` · ${processoSelecionado.projeto.cidade}/${processoSelecionado.projeto.uf ?? ''}` : ''}</p>}</div>
        <div className="space-y-2"><Label>Projeto/local avulso {processoId ? '(herdado do processo)' : '*'}</Label><Select value={processoId ? projetoHerdado ?? '' : projetoLocalId} onValueChange={(value) => { setProjetoLocalId(value); if (value) setProcessoId(''); }} disabled={!podeApontar || Boolean(processoId)}><SelectTrigger><SelectValue placeholder={processoId ? 'Definido pelo processo' : 'Selecione o projeto/local'} /></SelectTrigger><SelectContent>{locais.filter((local) => local.ativo).map((local) => <SelectItem key={local.id} value={local.id}>{local.nome}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Tarefa *</Label><Select value={tarefaId} onValueChange={setTarefaId} disabled={!podeApontar}><SelectTrigger><SelectValue placeholder="Selecione a atividade executada" /></SelectTrigger><SelectContent>{tarefas.filter((tarefa) => tarefa.ativo).map((tarefa) => <SelectItem key={tarefa.id} value={tarefa.id}>{tarefa.nome}</SelectItem>)}</SelectContent></Select></div>
      </div>

      <div className="space-y-2"><Label>Local de execução</Label><div className="flex gap-2">{(['Fábrica', 'Execução'] as ProducaoLocalTipo[]).map((tipo) => <Button key={tipo} type="button" variant={localTipo === tipo ? 'default' : 'outline'} onClick={() => setLocalTipo(tipo)} disabled={!podeApontar}>{tipo}</Button>)}</div></div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label>Início *</Label><div className="flex gap-2"><Input type="time" value={inicio} onChange={(event) => setInicio(event.target.value)} /><Button type="button" variant="outline" onClick={() => setInicio(horaAtual())}><Clock className="mr-2 h-4 w-4" />Agora</Button></div></div>
        <div className="space-y-2"><Label>Término *</Label><div className="flex gap-2"><Input type="time" value={termino} onChange={(event) => setTermino(event.target.value)} /><Button type="button" variant="outline" onClick={() => setTermino(horaAtual())}><Clock className="mr-2 h-4 w-4" />Agora</Button></div></div>
      </div>
      {duracao && <p className="rounded-md border bg-muted/20 p-3 text-sm">Duração calculada: <strong>{duracao} minutos</strong></p>}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2"><Label>Quantidade produzida</Label><Input inputMode="decimal" value={quantidade} onChange={(event) => setQuantidade(event.target.value)} /></div>
        <div className="space-y-2"><Label>Minutos improdutivos</Label><Input inputMode="numeric" value={minutosImprodutivos} onChange={(event) => setMinutosImprodutivos(event.target.value)} /></div>
        <div className="space-y-2"><Label>Motivo improdutivo</Label><Input value={motivoImprodutivo} onChange={(event) => setMotivoImprodutivo(event.target.value)} disabled={Number(minutosImprodutivos || 0) === 0} /></div>
      </div>

      <div className="space-y-2"><Label>Equipe *</Label><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={buscaMembro} onChange={(event) => setBuscaMembro(event.target.value)} placeholder="Buscar membro" /></div>{buscaMembro.trim() && <div className="max-h-40 overflow-y-auto rounded-md border p-1">{membrosFiltrados.map((membro) => <button key={membro.id} type="button" className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => { setMembrosIds((atuais) => [...new Set([...atuais, membro.id])]); setBuscaMembro(''); }}>{membro.nome}</button>)}</div>}<div className="flex flex-wrap gap-2">{membrosIds.map((id) => { const membro = membros.find((item) => item.id === id); return <Button key={id} type="button" size="sm" variant="secondary" onClick={() => setMembrosIds((atuais) => atuais.filter((item) => item !== id))}>{membro?.nome ?? id} ×</Button>; })}</div></div>

      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div><Label>Evidências fotográficas</Label><p className="text-xs text-muted-foreground">JPEG, PNG ou WebP, até 10 MB por foto.</p></div>
          <input ref={inputFotosRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(event) => selecionarFotos(event.target.files)} />
          <Button type="button" variant="outline" onClick={() => inputFotosRef.current?.click()} disabled={!podeApontar}><Camera className="mr-2 h-4 w-4" />Adicionar fotos</Button>
        </div>
        {fotos.length === 0 ? <div className="flex items-center gap-2 rounded-md bg-muted/20 p-3 text-sm text-muted-foreground"><Upload className="h-4 w-4" />Nenhuma foto selecionada.</div> : <div className="grid gap-2 sm:grid-cols-2">{fotos.map((foto, indice) => <div key={`${foto.name}-${foto.size}-${foto.lastModified}`} className="flex items-center justify-between gap-2 rounded-md border p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{foto.name}</p><p className="text-xs text-muted-foreground">{(foto.size / 1024 / 1024).toFixed(2)} MB</p></div><Button type="button" size="icon" variant="ghost" title="Remover foto" onClick={() => setFotos((atuais) => atuais.filter((_, i) => i !== indice))}><Trash2 className="h-4 w-4 text-red-500" /></Button></div>)}</div>}
      </div>

      <div className="space-y-2"><Label>Observações</Label><Textarea value={observacoes} onChange={(event) => setObservacoes(event.target.value)} rows={4} /></div>
      <div className="flex justify-end"><Button type="submit" disabled={!podeApontar || salvando}>{salvando ? 'Salvando apontamento e fotos...' : 'Salvar como pendente'}</Button></div>
    </form>
  );
};
