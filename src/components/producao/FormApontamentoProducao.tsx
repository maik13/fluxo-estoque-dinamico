import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Clock, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { LocalUtilizacaoConfig, SolicitanteConfig } from '@/hooks/useConfiguracoes';
import { calcularDuracaoProducao } from '@/hooks/useProducao';
import type {
  NovoApontamentoProducao,
  ProducaoApontamento,
  ProducaoLocalTipo,
  ProducaoTarefa,
} from '@/types/producao';

interface FormApontamentoProducaoProps {
  tarefas: ProducaoTarefa[];
  locais: LocalUtilizacaoConfig[];
  solicitantes: SolicitanteConfig[];
  podeApontar: boolean;
  criarApontamento: (dados: NovoApontamentoProducao) => Promise<ProducaoApontamento>;
  editarApontamento: (
    id: string,
    dados: Partial<Omit<NovoApontamentoProducao, 'membros_ids'>>,
    membrosIds?: string[],
  ) => Promise<ProducaoApontamento>;
  apontamentoInicial?: ProducaoApontamento | null;
  membrosIniciais?: string[];
  onSuccess?: () => void | Promise<void>;
  compacto?: boolean;
}

const hoje = () => new Date().toISOString().slice(0, 10);
const MEMBROS_INICIAIS_VAZIOS: string[] = [];

export const FormApontamentoProducao = ({
  tarefas,
  locais,
  solicitantes,
  podeApontar,
  criarApontamento,
  editarApontamento,
  apontamentoInicial = null,
  membrosIniciais = MEMBROS_INICIAIS_VAZIOS,
  onSuccess,
  compacto = false,
}: FormApontamentoProducaoProps) => {
  const [data, setData] = useState(hoje());
  const [projetoLocalId, setProjetoLocalId] = useState('');
  const [localTipo, setLocalTipo] = useState<ProducaoLocalTipo>('Fábrica');
  const [tarefaId, setTarefaId] = useState('');
  const [inicio, setInicio] = useState('');
  const [termino, setTermino] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [membrosIds, setMembrosIds] = useState<string[]>([]);
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);

  const editando = Boolean(apontamentoInicial);

  useEffect(() => {
    if (!apontamentoInicial) {
      setData(hoje());
      setProjetoLocalId('');
      setLocalTipo('Fábrica');
      setTarefaId('');
      setInicio('');
      setTermino('');
      setQuantidade('');
      setMembrosIds([]);
      setObservacoes('');
      return;
    }

    setData(apontamentoInicial.data);
    setProjetoLocalId(apontamentoInicial.projeto_local_id);
    setLocalTipo(apontamentoInicial.local_tipo);
    setTarefaId(apontamentoInicial.tarefa_id);
    setInicio(apontamentoInicial.inicio.slice(0, 5));
    setTermino(apontamentoInicial.termino.slice(0, 5));
    setQuantidade(
      apontamentoInicial.quantidade_produzida === null
        ? ''
        : String(apontamentoInicial.quantidade_produzida),
    );
    setMembrosIds(membrosIniciais);
    setObservacoes(apontamentoInicial.observacoes ?? '');
  }, [apontamentoInicial, membrosIniciais]);

  const duracao = useMemo(() => {
    if (!inicio || !termino) return null;

    try {
      return calcularDuracaoProducao(inicio, termino);
    } catch {
      return null;
    }
  }, [inicio, termino]);

  const alternarMembro = (membroId: string, marcado: boolean) => {
    setMembrosIds((atuais) =>
      marcado
        ? [...new Set([...atuais, membroId])]
        : atuais.filter((id) => id !== membroId),
    );
  };

  const limparFormulario = () => {
    setData(hoje());
    setProjetoLocalId('');
    setLocalTipo('Fábrica');
    setTarefaId('');
    setInicio('');
    setTermino('');
    setQuantidade('');
    setMembrosIds([]);
    setObservacoes('');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!podeApontar) return;
    if (!projetoLocalId) {
      toast.error('Selecione o projeto/local.');
      return;
    }
    if (!tarefaId) {
      toast.error('Selecione a tarefa.');
      return;
    }
    if (membrosIds.length === 0) {
      toast.error('Selecione pelo menos um membro da equipe.');
      return;
    }
    if (!duracao || duracao <= 0) {
      toast.error('O término deve ser maior que o início.');
      return;
    }

    const quantidadeProduzida = quantidade.trim()
      ? Number(quantidade.replace(',', '.'))
      : null;

    if (
      quantidadeProduzida !== null &&
      (!Number.isFinite(quantidadeProduzida) || quantidadeProduzida < 0)
    ) {
      toast.error('Informe uma quantidade produzida válida.');
      return;
    }

    const dados: NovoApontamentoProducao = {
      data,
      projeto_local_id: projetoLocalId,
      tarefa_id: tarefaId,
      local_tipo: localTipo,
      quantidade_produzida: quantidadeProduzida,
      inicio,
      termino,
      observacoes: observacoes.trim() || null,
      membros_ids: membrosIds,
    };

    setSalvando(true);
    try {
      if (apontamentoInicial) {
        const { membros_ids: membros, ...alteracoes } = dados;
        await editarApontamento(apontamentoInicial.id, alteracoes, membros);
        toast.success('Apontamento atualizado.');
      } else {
        await criarApontamento(dados);
        toast.success('Apontamento lançado.');
        limparFormulario();
      }

      await onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o apontamento.',
      );
    } finally {
      setSalvando(false);
    }
  };

  const conteudo = (
    <>
      {!podeApontar && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Acesso somente para consulta</AlertTitle>
          <AlertDescription>
            Seu perfil não possui permissão para lançar apontamentos de Produção.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="producao-data">Data</Label>
            <Input
              id="producao-data"
              type="date"
              value={data}
              onChange={(event) => setData(event.target.value)}
              disabled={!podeApontar}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Projeto/local</Label>
            <Select
              value={projetoLocalId}
              onValueChange={setProjetoLocalId}
              disabled={!podeApontar}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o projeto" />
              </SelectTrigger>
              <SelectContent>
                {locais.filter((local) => local.ativo).map((local) => (
                  <SelectItem key={local.id} value={local.id}>
                    {local.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Local de execução</Label>
            <Select
              value={localTipo}
              onValueChange={(valor) => setLocalTipo(valor as ProducaoLocalTipo)}
              disabled={!podeApontar}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Fábrica">Fábrica</SelectItem>
                <SelectItem value="Execução">Execução</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tarefa</Label>
            <Select
              value={tarefaId}
              onValueChange={setTarefaId}
              disabled={!podeApontar}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a tarefa" />
              </SelectTrigger>
              <SelectContent>
                {tarefas.filter((tarefa) => tarefa.ativo).map((tarefa) => (
                  <SelectItem key={tarefa.id} value={tarefa.id}>
                    {tarefa.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="producao-inicio">Início</Label>
            <Input
              id="producao-inicio"
              type="time"
              value={inicio}
              onChange={(event) => setInicio(event.target.value)}
              disabled={!podeApontar}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="producao-termino">Término</Label>
            <Input
              id="producao-termino"
              type="time"
              value={termino}
              onChange={(event) => setTermino(event.target.value)}
              disabled={!podeApontar}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Duração calculada</Label>
            <div className="flex h-10 items-center gap-2 rounded-md border bg-muted/30 px-3 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {duracao ? `${duracao} min` : 'Informe um período válido'}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="producao-quantidade">Quantidade produzida</Label>
            <Input
              id="producao-quantidade"
              inputMode="decimal"
              value={quantidade}
              onChange={(event) => setQuantidade(event.target.value)}
              placeholder="Opcional"
              disabled={!podeApontar}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Membros/equipe</Label>
          <div className="grid max-h-44 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-3">
            {solicitantes.filter((membro) => membro.ativo).map((membro) => (
              <label
                key={membro.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
              >
                <Checkbox
                  checked={membrosIds.includes(membro.id)}
                  onCheckedChange={(valor) => alternarMembro(membro.id, valor === true)}
                  disabled={!podeApontar}
                />
                <span className="text-sm">{membro.nome}</span>
              </label>
            ))}
            {solicitantes.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum membro disponível.</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="producao-observacoes">Observações</Label>
          <Textarea
            id="producao-observacoes"
            value={observacoes}
            onChange={(event) => setObservacoes(event.target.value)}
            rows={3}
            placeholder="Informações operacionais do apontamento"
            disabled={!podeApontar}
          />
        </div>

        {podeApontar && (
          <div className="flex justify-end">
            <Button type="submit" disabled={salvando}>
              <Save className="mr-2 h-4 w-4" />
              {salvando
                ? 'Salvando...'
                : editando
                  ? 'Salvar alterações'
                  : 'Lançar apontamento'}
            </Button>
          </div>
        )}
      </form>
    </>
  );

  if (compacto) return <div className="space-y-5">{conteudo}</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apontamento de Produção</CardTitle>
        <CardDescription>
          Registre o trabalho executado sem gerar qualquer movimentação de estoque.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">{conteudo}</CardContent>
    </Card>
  );
};
