import { FormEvent, useMemo, useState } from 'react';
import { ClipboardList, Loader2, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  editarOrdemProducao,
  formatarNumeroOrdemProducao,
  notificarOrdensProducaoAlteradas,
} from '@/hooks/useOrdensProducao';
import type {
  NovaOrdemProducao,
  ProducaoLocalTipo,
  ProducaoOrdemProducao,
  ProducaoPrioridade,
  ProducaoProcesso,
} from '@/types/producao';

interface Props {
  processo: ProducaoProcesso;
  ordens: ProducaoOrdemProducao[];
  onEmitir: (dados: NovaOrdemProducao) => Promise<unknown>;
}

const numero = (value: string) => Number(value.replace(',', '.'));

const formatarQuantidade = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 4,
  }).format(value);

export const FormOrdemProducao = ({ processo, ordens, onEmitir }: Props) => {
  const [aberto, setAberto] = useState(false);
  const [quantidade, setQuantidade] = useState('');
  const [inicio, setInicio] = useState(
    processo.data_inicio_prevista ?? processo.data_inicio_desejada ?? '',
  );
  const [fim, setFim] = useState(
    processo.data_fim_prevista ?? processo.data_limite ?? '',
  );
  const [localTipo, setLocalTipo] =
    useState<ProducaoLocalTipo>('Fábrica');
  const [responsavel, setResponsavel] = useState(
    processo.responsavel_nome_snapshot ?? '',
  );
  const [equipe, setEquipe] = useState(
    processo.pessoas_necessarias == null
      ? ''
      : String(processo.pessoas_necessarias),
  );
  const [prioridade, setPrioridade] =
    useState<ProducaoPrioridade>(processo.prioridade);
  const [descricao, setDescricao] = useState('');
  const [instrucoes, setInstrucoes] = useState('');
  const [salvando, setSalvando] = useState(false);

  const [edicaoAberta, setEdicaoAberta] = useState(false);
  const [ordemEdicaoId, setOrdemEdicaoId] = useState('');
  const [editQuantidade, setEditQuantidade] = useState('');
  const [editInicio, setEditInicio] = useState('');
  const [editFim, setEditFim] = useState('');
  const [editLocalTipo, setEditLocalTipo] =
    useState<ProducaoLocalTipo>('Fábrica');
  const [editResponsavel, setEditResponsavel] = useState('');
  const [editEquipe, setEditEquipe] = useState('');
  const [editPrioridade, setEditPrioridade] =
    useState<ProducaoPrioridade>('normal');
  const [editDescricao, setEditDescricao] = useState('');
  const [editInstrucoes, setEditInstrucoes] = useState('');
  const [editJustificativa, setEditJustificativa] = useState('');
  const [editando, setEditando] = useState(false);

  const ordensDaEtapa = useMemo(
    () => ordens.filter((ordem) => ordem.processo_id === processo.id),
    [ordens, processo.id],
  );

  const ordensEditaveis = useMemo(
    () =>
      ordensDaEtapa.filter((ordem) =>
        ['liberada', 'em_execucao'].includes(ordem.status),
      ),
    [ordensDaEtapa],
  );

  const ordemSelecionada = useMemo(
    () => ordensEditaveis.find((ordem) => ordem.id === ordemEdicaoId) ?? null,
    [ordemEdicaoId, ordensEditaveis],
  );

  const resumo = useMemo(() => {
    const abertas = ordensDaEtapa.filter((ordem) =>
      ['rascunho', 'liberada', 'em_execucao'].includes(ordem.status),
    );
    const concluidas = ordensDaEtapa.filter(
      (ordem) => ordem.status === 'concluida',
    );
    const canceladas = ordensDaEtapa.filter(
      (ordem) => ordem.status === 'cancelada',
    );
    const naoCanceladas = ordensDaEtapa.filter(
      (ordem) => ordem.status !== 'cancelada',
    );
    const planejadoNaoCancelado = naoCanceladas.reduce(
      (soma, ordem) => soma + Number(ordem.quantidade_planejada || 0),
      0,
    );
    const confirmado = ordensDaEtapa.reduce(
      (soma, ordem) => soma + Number(ordem.quantidade_realizada || 0),
      0,
    );
    const meta = Number(processo.quantidade_planejada || 0);

    return {
      abertas: abertas.length,
      concluidas: concluidas.length,
      canceladas: canceladas.length,
      planejadoNaoCancelado,
      confirmado,
      saldoMeta: meta > 0 ? Math.max(meta - confirmado, 0) : null,
      excedenteMeta: meta > 0 ? Math.max(confirmado - meta, 0) : 0,
    };
  }, [ordensDaEtapa, processo.quantidade_planejada]);

  const preencherEdicao = (ordem: ProducaoOrdemProducao) => {
    setOrdemEdicaoId(ordem.id);
    setEditQuantidade(String(ordem.quantidade_planejada));
    setEditInicio(ordem.data_inicio_prevista);
    setEditFim(ordem.data_fim_prevista);
    setEditLocalTipo(ordem.local_tipo);
    setEditResponsavel(ordem.responsavel_nome_snapshot ?? '');
    setEditEquipe(
      ordem.equipe_prevista == null ? '' : String(ordem.equipe_prevista),
    );
    setEditPrioridade(ordem.prioridade);
    setEditDescricao(ordem.descricao ?? '');
    setEditInstrucoes(ordem.instrucoes ?? '');
    setEditJustificativa('');
  };

  const abrir = (open: boolean) => {
    setAberto(open);
    if (!open) return;
    setQuantidade('');
    setInicio(
      processo.data_inicio_prevista ?? processo.data_inicio_desejada ?? '',
    );
    setFim(processo.data_fim_prevista ?? processo.data_limite ?? '');
  };

  const abrirEdicao = (open: boolean) => {
    if (editando) return;
    setEdicaoAberta(open);
    if (!open) return;

    const ordemInicial = ordensEditaveis[ordensEditaveis.length - 1];
    if (ordemInicial) preencherEdicao(ordemInicial);
  };

  const emitir = async (event: FormEvent) => {
    event.preventDefault();
    const quantidadeNormalizada = numero(quantidade);
    const equipeNormalizada = equipe.trim() ? Number(equipe) : null;

    if (!Number.isFinite(quantidadeNormalizada) || quantidadeNormalizada <= 0) {
      toast.error('Informe uma quantidade maior que zero.');
      return;
    }
    if (!inicio || !fim || fim < inicio) {
      toast.error('Informe um período planejado válido.');
      return;
    }
    if (
      equipeNormalizada !== null &&
      (!Number.isInteger(equipeNormalizada) || equipeNormalizada < 0)
    ) {
      toast.error('Informe uma quantidade válida de pessoas.');
      return;
    }

    setSalvando(true);
    try {
      await onEmitir({
        processo_id: processo.id,
        quantidade_planejada: quantidadeNormalizada,
        data_inicio_prevista: inicio,
        data_fim_prevista: fim,
        local_tipo: localTipo,
        responsavel_nome: responsavel.trim() || null,
        equipe_prevista: equipeNormalizada,
        descricao: descricao.trim() || null,
        instrucoes: instrucoes.trim() || null,
        prioridade,
      });
      toast.success(
        'OP criada e liberada. Você pode emitir outras OPs nesta Etapa enquanto ela permanecer aberta.',
      );
      setAberto(false);
      setQuantidade('');
      setDescricao('');
      setInstrucoes('');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível emitir a OP.',
      );
    } finally {
      setSalvando(false);
    }
  };

  const salvarEdicao = async (event: FormEvent) => {
    event.preventDefault();
    if (!ordemSelecionada) {
      toast.error('Selecione uma Ordem de Produção para editar.');
      return;
    }

    const quantidadeNormalizada = numero(editQuantidade);
    const equipeNormalizada = editEquipe.trim() ? Number(editEquipe) : null;
    const justificativa = editJustificativa.trim();

    if (!Number.isFinite(quantidadeNormalizada) || quantidadeNormalizada <= 0) {
      toast.error('Informe uma quantidade maior que zero.');
      return;
    }
    if (quantidadeNormalizada < Number(ordemSelecionada.quantidade_realizada)) {
      toast.error(
        `A quantidade planejada não pode ser menor que ${formatarQuantidade(Number(ordemSelecionada.quantidade_realizada))}, já confirmada nesta OP.`,
      );
      return;
    }
    if (!editInicio || !editFim || editFim < editInicio) {
      toast.error('Informe um período planejado válido.');
      return;
    }
    if (
      equipeNormalizada !== null &&
      (!Number.isInteger(equipeNormalizada) || equipeNormalizada < 0)
    ) {
      toast.error('Informe uma quantidade válida de pessoas.');
      return;
    }
    if (!justificativa) {
      toast.error('Informe o motivo da alteração.');
      return;
    }

    setEditando(true);
    try {
      await editarOrdemProducao({
        ordem_producao_id: ordemSelecionada.id,
        quantidade_planejada: quantidadeNormalizada,
        data_inicio_prevista: editInicio,
        data_fim_prevista: editFim,
        local_tipo: editLocalTipo,
        responsavel_id: ordemSelecionada.responsavel_id,
        responsavel_nome: editResponsavel.trim() || null,
        equipe_prevista: equipeNormalizada,
        descricao: editDescricao.trim() || null,
        instrucoes: editInstrucoes.trim() || null,
        prioridade: editPrioridade,
        justificativa,
      });
      notificarOrdensProducaoAlteradas();
      toast.success(
        `${formatarNumeroOrdemProducao(ordemSelecionada.numero)} atualizada e registrada na auditoria.`,
      );
      setEdicaoAberta(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível editar a OP.',
      );
    } finally {
      setEditando(false);
    }
  };

  const unidade = processo.unidade_medida ?? '';

  return (
    <>
      <Dialog open={aberto} onOpenChange={abrir}>
        <DialogTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            title="Criar uma nova Ordem de Produção nesta Etapa"
          >
            <ClipboardList className="mr-2 h-4 w-4" />
            Emitir nova OP
          </Button>
        </DialogTrigger>

        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Emitir nova Ordem de Produção</DialogTitle>
            <DialogDescription>
              A OP será criada dentro da Etapa {processo.codigo} · {processo.nome}.
              Enquanto a Etapa não estiver finalizada ou cancelada, você poderá
              emitir quantas OPs forem necessárias.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={emitir} className="space-y-5">
            <div className="space-y-4 rounded-lg border bg-muted/20 p-4 text-sm">
              <div>
                <p>
                  <strong>Projeto:</strong> {processo.projeto?.nome ?? '—'}
                </p>
                <p>
                  <strong>Etapa:</strong> {processo.codigo} · {processo.nome}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">Meta da Etapa</p>
                  <p className="font-semibold">
                    {processo.quantidade_planejada == null
                      ? 'Não informada'
                      : `${formatarQuantidade(Number(processo.quantidade_planejada))} ${unidade}`}
                  </p>
                </div>
                <div className="rounded-md border bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">Produção confirmada</p>
                  <p className="font-semibold text-emerald-500">
                    {formatarQuantidade(resumo.confirmado)} {unidade}
                  </p>
                </div>
                <div className="rounded-md border bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">
                    {resumo.excedenteMeta > 0 ? 'Excedente da meta' : 'Saldo da meta'}
                  </p>
                  <p className="font-semibold">
                    {resumo.excedenteMeta > 0
                      ? formatarQuantidade(resumo.excedenteMeta)
                      : resumo.saldoMeta == null
                        ? 'Não calculado'
                        : formatarQuantidade(resumo.saldoMeta)}{' '}
                    {unidade}
                  </p>
                </div>
              </div>

              <div className="grid gap-2 text-xs sm:grid-cols-2">
                <p><strong>OPs abertas:</strong> {resumo.abertas}</p>
                <p><strong>OPs concluídas:</strong> {resumo.concluidas}</p>
                <p><strong>OPs canceladas:</strong> {resumo.canceladas}</p>
                <p>
                  <strong>Planejado em OPs não canceladas:</strong>{' '}
                  {formatarQuantidade(resumo.planejadoNaoCancelado)} {unidade}
                </p>
              </div>

              <p className="text-xs text-muted-foreground">
                Produção confirmada soma somente apontamentos com status
                “Conferido”. Apontamentos cancelados permanecem no Histórico para
                auditoria, mas não entram no realizado nem no saldo da meta. A
                quantidade planejada nas OPs é uma previsão e não representa
                produção executada.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Quantidade desta OP *</Label>
                <Input
                  value={quantidade}
                  onChange={(event) => setQuantidade(event.target.value)}
                  inputMode="decimal"
                  placeholder="Informe a quantidade deste lote"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Local operacional *</Label>
                <Select
                  value={localTipo}
                  onValueChange={(value) =>
                    setLocalTipo(value as ProducaoLocalTipo)
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fábrica">Fábrica</SelectItem>
                    <SelectItem value="Execução">Execução</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Início planejado *</Label>
                <Input type="date" value={inicio} onChange={(event) => setInicio(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Prazo da OP *</Label>
                <Input type="date" value={fim} onChange={(event) => setFim(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Input value={responsavel} onChange={(event) => setResponsavel(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Equipe prevista</Label>
                <Input type="number" min="0" step="1" value={equipe} onChange={(event) => setEquipe(event.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Prioridade</Label>
                <Select value={prioridade} onValueChange={(value) => setPrioridade(value as ProducaoPrioridade)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição do lote</Label>
              <Input value={descricao} onChange={(event) => setDescricao(event.target.value)} placeholder="Ex.: primeiro lote de laços ou segundo lote de painéis" />
            </div>

            <div className="space-y-2">
              <Label>Instruções para execução</Label>
              <Textarea value={instrucoes} onChange={(event) => setInstrucoes(event.target.value)} placeholder="Medidas, critérios, acabamento e demais orientações." rows={4} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAberto(false)} disabled={salvando}>Voltar</Button>
              <Button type="submit" disabled={salvando}>
                {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Criar e liberar OP
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={edicaoAberta} onOpenChange={abrirEdicao}>
        <DialogTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            disabled={ordensEditaveis.length === 0}
            title={
              ordensEditaveis.length === 0
                ? 'Não há OP liberada ou em execução para editar. Reabra uma OP encerrada antes da edição.'
                : 'Editar dados de uma Ordem de Produção desta Etapa'
            }
          >
            <Pencil className="mr-2 h-4 w-4" />
            Editar OP
          </Button>
        </DialogTrigger>

        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Ordem de Produção</DialogTitle>
            <DialogDescription>
              Projeto e Etapa permanecem vinculados. Todas as alterações serão
              registradas na auditoria da OP.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={salvarEdicao} className="space-y-5">
            <div className="space-y-2">
              <Label>Ordem de Produção *</Label>
              <Select
                value={ordemEdicaoId}
                onValueChange={(value) => {
                  const ordem = ordensEditaveis.find((item) => item.id === value);
                  if (ordem) preencherEdicao(ordem);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione a OP" /></SelectTrigger>
                <SelectContent>
                  {ordensEditaveis.map((ordem) => (
                    <SelectItem key={ordem.id} value={ordem.id}>
                      {formatarNumeroOrdemProducao(ordem.numero)} · {ordem.status === 'em_execucao' ? 'Em execução' : 'Liberada'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {ordemSelecionada && (
              <div className="rounded-lg border bg-muted/20 p-4 text-sm">
                <p><strong>Projeto:</strong> {ordemSelecionada.projeto_nome}</p>
                <p><strong>Etapa:</strong> {ordemSelecionada.processo_codigo} · {ordemSelecionada.processo_nome}</p>
                <p><strong>Produção confirmada:</strong> {formatarQuantidade(Number(ordemSelecionada.quantidade_realizada))} {ordemSelecionada.unidade_medida ?? ''}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Número, Projeto e Etapa não podem ser alterados. A quantidade planejada nunca poderá ficar abaixo da produção já confirmada.
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Quantidade planejada *</Label>
                <Input value={editQuantidade} onChange={(event) => setEditQuantidade(event.target.value)} inputMode="decimal" required />
              </div>
              <div className="space-y-2">
                <Label>Local operacional *</Label>
                <Select value={editLocalTipo} onValueChange={(value) => setEditLocalTipo(value as ProducaoLocalTipo)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fábrica">Fábrica</SelectItem>
                    <SelectItem value="Execução">Execução</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Início planejado *</Label>
                <Input type="date" value={editInicio} onChange={(event) => setEditInicio(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Prazo da OP *</Label>
                <Input type="date" value={editFim} onChange={(event) => setEditFim(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Input value={editResponsavel} onChange={(event) => setEditResponsavel(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Equipe prevista</Label>
                <Input type="number" min="0" step="1" value={editEquipe} onChange={(event) => setEditEquipe(event.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Prioridade</Label>
                <Select value={editPrioridade} onValueChange={(value) => setEditPrioridade(value as ProducaoPrioridade)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição do lote</Label>
              <Input value={editDescricao} onChange={(event) => setEditDescricao(event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Instruções para execução</Label>
              <Textarea value={editInstrucoes} onChange={(event) => setEditInstrucoes(event.target.value)} rows={4} />
            </div>

            <div className="space-y-2">
              <Label>Motivo da alteração *</Label>
              <Textarea
                value={editJustificativa}
                onChange={(event) => setEditJustificativa(event.target.value)}
                placeholder="Explique por que os dados da OP estão sendo alterados."
                rows={3}
                required
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEdicaoAberta(false)} disabled={editando}>Voltar</Button>
              <Button type="submit" disabled={editando || !ordemSelecionada || !editJustificativa.trim()}>
                {editando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
                Salvar alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
