import { FormEvent, useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
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
} from '@/hooks/useOrdensProducao';
import type {
  ProducaoLocalTipo,
  ProducaoOrdemProducao,
  ProducaoPrioridade,
} from '@/types/producao';

interface Props {
  ordem: ProducaoOrdemProducao;
  onSuccess: () => Promise<void> | void;
}

const numero = (value: string) => Number(value.replace(',', '.'));

const formatarQuantidade = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 4,
  }).format(value);

export const FormEditarOrdemProducao = ({ ordem, onSuccess }: Props) => {
  const [aberto, setAberto] = useState(false);
  const [quantidade, setQuantidade] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [localTipo, setLocalTipo] =
    useState<ProducaoLocalTipo>('Fábrica');
  const [responsavel, setResponsavel] = useState('');
  const [equipe, setEquipe] = useState('');
  const [prioridade, setPrioridade] =
    useState<ProducaoPrioridade>('normal');
  const [descricao, setDescricao] = useState('');
  const [instrucoes, setInstrucoes] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [salvando, setSalvando] = useState(false);

  const editavel = ['liberada', 'em_execucao'].includes(ordem.status);

  const preencher = () => {
    setQuantidade(String(ordem.quantidade_planejada));
    setInicio(ordem.data_inicio_prevista);
    setFim(ordem.data_fim_prevista);
    setLocalTipo(ordem.local_tipo);
    setResponsavel(ordem.responsavel_nome_snapshot ?? '');
    setEquipe(ordem.equipe_prevista == null ? '' : String(ordem.equipe_prevista));
    setPrioridade(ordem.prioridade);
    setDescricao(ordem.descricao ?? '');
    setInstrucoes(ordem.instrucoes ?? '');
    setJustificativa('');
  };

  const alterarAbertura = (open: boolean) => {
    if (salvando) return;
    setAberto(open);
    if (open) preencher();
  };

  const salvar = async (event: FormEvent) => {
    event.preventDefault();

    const quantidadeNormalizada = numero(quantidade);
    const equipeNormalizada = equipe.trim() ? Number(equipe) : null;
    const motivo = justificativa.trim();

    if (!Number.isFinite(quantidadeNormalizada) || quantidadeNormalizada <= 0) {
      toast.error('Informe uma quantidade maior que zero.');
      return;
    }

    if (quantidadeNormalizada < Number(ordem.quantidade_realizada)) {
      toast.error(
        `A quantidade planejada não pode ser menor que ${formatarQuantidade(Number(ordem.quantidade_realizada))}, já confirmada nesta OP.`,
      );
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

    if (!motivo) {
      toast.error('Informe o motivo da alteração da OP.');
      return;
    }

    setSalvando(true);
    try {
      await editarOrdemProducao({
        ordem_producao_id: ordem.id,
        quantidade_planejada: quantidadeNormalizada,
        data_inicio_prevista: inicio,
        data_fim_prevista: fim,
        local_tipo: localTipo,
        responsavel_id: ordem.responsavel_id,
        responsavel_nome: responsavel.trim() || null,
        equipe_prevista: equipeNormalizada,
        descricao: descricao.trim() || null,
        instrucoes: instrucoes.trim() || null,
        prioridade,
        justificativa: motivo,
      });

      await onSuccess();
      toast.success(
        `${formatarNumeroOrdemProducao(ordem.numero)} atualizada e registrada na auditoria.`,
      );
      setAberto(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível editar a OP.',
      );
    } finally {
      setSalvando(false);
    }
  };

  if (!editavel) return null;

  return (
    <Dialog open={aberto} onOpenChange={alterarAbertura}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          title={`Editar ${formatarNumeroOrdemProducao(ordem.numero)}`}
        >
          <Pencil className="mr-2 h-4 w-4" />
          Editar OP
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Editar {formatarNumeroOrdemProducao(ordem.numero)}
          </DialogTitle>
          <DialogDescription>
            Você está alterando esta Ordem de Produção específica. Projeto,
            Etapa, número e status permanecem inalterados.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={salvar} className="space-y-5">
          <div className="rounded-lg border bg-muted/20 p-4 text-sm">
            <p>
              <strong>Projeto:</strong> {ordem.projeto_nome}
            </p>
            <p>
              <strong>Etapa:</strong> {ordem.processo_codigo} ·{' '}
              {ordem.processo_nome}
            </p>
            <p>
              <strong>Produção confirmada:</strong>{' '}
              {formatarQuantidade(Number(ordem.quantidade_realizada))}{' '}
              {ordem.unidade_medida ?? ''}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Quantidade planejada *</Label>
              <Input
                value={quantidade}
                onChange={(event) => setQuantidade(event.target.value)}
                inputMode="decimal"
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
              <Label>Início planejado *</Label>
              <Input
                type="date"
                value={inicio}
                onChange={(event) => setInicio(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Prazo da OP *</Label>
              <Input
                type="date"
                value={fim}
                onChange={(event) => setFim(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Responsável</Label>
              <Input
                value={responsavel}
                onChange={(event) => setResponsavel(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Equipe prevista</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={equipe}
                onChange={(event) => setEquipe(event.target.value)}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Prioridade</Label>
              <Select
                value={prioridade}
                onValueChange={(value) =>
                  setPrioridade(value as ProducaoPrioridade)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
            <Input
              value={descricao}
              onChange={(event) => setDescricao(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Instruções para execução</Label>
            <Textarea
              value={instrucoes}
              onChange={(event) => setInstrucoes(event.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Motivo da alteração *</Label>
            <Textarea
              value={justificativa}
              onChange={(event) => setJustificativa(event.target.value)}
              placeholder="Explique por que esta OP está sendo alterada."
              rows={3}
              required
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAberto(false)}
              disabled={salvando}
            >
              Voltar
            </Button>
            <Button type="submit" disabled={salvando || !justificativa.trim()}>
              {salvando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Pencil className="mr-2 h-4 w-4" />
              )}
              Salvar alterações da OP
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
