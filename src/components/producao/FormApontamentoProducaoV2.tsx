import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Clock, Info, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { LocalUtilizacaoConfig } from '@/hooks/useConfiguracoes';
import { calcularDuracaoProducao } from '@/hooks/useProducao';
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
  const [salvando, setSalvando] = useState(false);
  const { processos, listarProcessos } = useProcessosProducao();

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
  };

  const salvar = async (event: FormEvent) => {
    event.preventDefault();
    if (!podeApontar) return;

    if ((processoId ? 1 : 0) + (projetoLocalId ? 1 : 0) !== 1) {
      toast.error('Selecione um processo em andamento ou um projeto/local avulso.');
      return;
    }
    if (!tarefaId) {
      toast.error('Selecione uma tarefa.');
      return;
    }
    if (!duracao) {
      toast.error('Informe horários válidos de início e término.');
      return;
    }
    if (membrosIds.length === 0) {
      toast.error('Selecione pelo menos um membro da equipe.');
      return;
    }

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
      await criarApontamento({
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
      toast.success('Apontamento salvo como pendente de conferência.');
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
        <p className="text-sm text-muted-foreground">Registre a execução real. Processo e tarefa são informações diferentes.</p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Processo em andamento</strong> é a frente macro de produção. <strong>Tarefa</strong> é a atividade específica executada neste apontamento. O processo é opcional; a tarefa é obrigatória.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Data</Label>
          <Input type="date" value={data} onChange={(event) => setData(event.target.value)} disabled={!podeApontar} />
        </div>

        <div className="space-y-2">
          <Label>Vincular a processo em andamento — opcional</Label>
          <Select
            value={processoId || '__nenhum__'}
            onValueChange={(value) => {
              const novo = value === '__nenhum__' ? '' : value;
              setProcessoId(novo);
              if (novo) setProjetoLocalId('');
            }}
            disabled={!podeApontar}
          >
            <SelectTrigger><SelectValue placeholder="Selecione um processo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__nenhum__">Sem processo — apontamento avulso</SelectItem>
              {processos.map((processo) => (
                <SelectItem key={processo.id} value={processo.id}>
                  {processo.codigo} · {processo.nome} · {processo.projeto?.nome ?? 'Projeto não identificado'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {processoSelecionado && (
            <p className="text-xs text-muted-foreground">
              Projeto herdado: {processoSelecionado.projeto?.nome ?? '—'}{processoSelecionado.projeto?.cidade ? ` · ${processoSelecionado.projeto.cidade}/${processoSelecionado.projeto.uf ?? ''}` : ''}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Projeto/local avulso {processoId ? '(herdado do processo)' : '*'}</Label>
          <Select
            value={processoId ? projetoHerdado ?? '' : projetoLocalId}
            onValueChange={(value) => {
              setProjetoLocalId(value);
              if (value) setProcessoId('');
            }}
            disabled={!podeApontar || Boolean(processoId)}
          >
            <SelectTrigger><SelectValue placeholder={processoId ? 'Definido pelo processo' : 'Selecione o projeto/local'} /></SelectTrigger>
            <SelectContent>{locais.filter((local) => local.ativo).map((local) => <SelectItem key={local.id} value={local.id}>{local.nome}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Tarefa *</Label>
          <Select value={tarefaId} onValueChange={setTarefaId} disabled={!podeApontar}>
            <SelectTrigger><SelectValue placeholder="Selecione a atividade executada" /></SelectTrigger>
            <SelectContent>{tarefas.filter((tarefa) => tarefa.ativo).map((tarefa) => <SelectItem key={tarefa.id} value={tarefa.id}>{tarefa.nome}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Local de execução</Label>
        <div className="flex gap-2">
          {(['Fábrica', 'Execução'] as ProducaoLocalTipo[]).map((tipo) => (
            <Button key={tipo} type="button" variant={localTipo === tipo ? 'default' : 'outline'} onClick={() => setLocalTipo(tipo)} disabled={!podeApontar}>{tipo}</Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Início *</Label>
          <div className="flex gap-2"><Input type="time" value={inicio} onChange={(event) => setInicio(event.target.value)} /><Button type="button" variant="outline" onClick={() => setInicio(horaAtual())}><Clock className="mr-2 h-4 w-4" />Agora</Button></div>
        </div>
        <div className="space-y-2">
          <Label>Término *</Label>
          <div className="flex gap-2"><Input type="time" value={termino} onChange={(event) => setTermino(event.target.value)} /><Button type="button" variant="outline" onClick={() => setTermino(horaAtual())}><Clock className="mr-2 h-4 w-4" />Agora</Button></div>
        </div>
      </div>

      {duracao && <p className="rounded-md border bg-muted/20 p-3 text-sm">Duração calculada: <strong>{duracao} minutos</strong></p>}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2"><Label>Quantidade produzida</Label><Input inputMode="decimal" value={quantidade} onChange={(event) => setQuantidade(event.target.value)} /></div>
        <div className="space-y-2"><Label>Minutos improdutivos</Label><Input inputMode="numeric" value={minutosImprodutivos} onChange={(event) => setMinutosImprodutivos(event.target.value)} /></div>
        <div className="space-y-2"><Label>Motivo improdutivo</Label><Input value={motivoImprodutivo} onChange={(event) => setMotivoImprodutivo(event.target.value)} disabled={Number(minutosImprodutivos || 0) === 0} /></div>
      </div>

      <div className="space-y-2">
        <Label>Equipe *</Label>
        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={buscaMembro} onChange={(event) => setBuscaMembro(event.target.value)} placeholder="Buscar membro" /></div>
        {buscaMembro.trim() && (
          <div className="max-h-40 overflow-y-auto rounded-md border p-1">
            {membrosFiltrados.map((membro) => <button key={membro.id} type="button" className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => { setMembrosIds((atuais) => [...new Set([...atuais, membro.id])]); setBuscaMembro(''); }}>{membro.nome}</button>)}
          </div>
        )}
        <div className="flex flex-wrap gap-2">{membrosIds.map((id) => { const membro = membros.find((item) => item.id === id); return <Button key={id} type="button" size="sm" variant="secondary" onClick={() => setMembrosIds((atuais) => atuais.filter((item) => item !== id))}>{membro?.nome ?? id} ×</Button>; })}</div>
      </div>

      <div className="space-y-2"><Label>Observações</Label><Textarea value={observacoes} onChange={(event) => setObservacoes(event.target.value)} rows={4} /></div>

      <div className="flex justify-end"><Button type="submit" disabled={!podeApontar || salvando}>{salvando ? 'Salvando...' : 'Salvar como pendente'}</Button></div>
    </form>
  );
};
