import { FormEvent, useState } from 'react';
import { Loader2, Pencil, ArrowRightLeft } from 'lucide-react';
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
import { CampoDescricaoComVoz } from './CampoDescricaoComVoz';
import {
  editarOrdemProducao,
  formatarNumeroOrdemProducao,
} from '@/hooks/useOrdensProducao';
import { supabase } from '@/integrations/supabase/client';
import type {
  ProducaoLocalTipo,
  ProducaoOrdemProducao,
  ProducaoPrioridade,
} from '@/types/producao';

interface Props {
  ordem: ProducaoOrdemProducao;
  onSuccess: () => Promise<void> | void;
}

type EtapaDestino = {
  id: string;
  codigo: string;
  nome: string;
  status: string;
};

const numero = (value: string) => Number(value.replace(',', '.'));

const formatarQuantidade = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 4,
  }).format(value);

export const FormEditarOrdemProducao = ({ ordem, onSuccess }: Props) => {
  const [aberto, setAberto] = useState(false);
  const [quantidade, setQuantidade] = useState('');
  const [duracaoHoras, setDuracaoHoras] = useState('');
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
  const [salvando, setSalvando] = useState(false);
  const [reclassificando, setReclassificando] = useState(false);
  const [etapas, setEtapas] = useState<EtapaDestino[]>([]);
  const [etapaSelecionada, setEtapaSelecionada] = useState(ordem.processo_id);

  const editavelPlanejamento = ['rascunho', 'liberada', 'em_execucao'].includes(ordem.status);
  const reclassificavel = ordem.status !== 'cancelada';

  const carregarEtapas = async () => {
    const { data, error } = await supabase
      .from('producao_processos')
      .select('id,codigo,nome,status')
      .eq('projeto_id', ordem.projeto_id)
      .neq('status', 'cancelado')
      .order('sequencia', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      toast.error('Não foi possível carregar as etapas deste projeto.');
      return;
    }

    setEtapas((data ?? []) as EtapaDestino[]);
  };

  const preencher = () => {
    setQuantidade(String(ordem.quantidade_planejada));
    setDuracaoHoras(
      ordem.duracao_estimada_horas == null
        ? ''
        : String(ordem.duracao_estimada_horas).replace('.', ','),
    );
    setInicio(ordem.data_inicio_prevista ?? '');
    setFim(ordem.data_fim_prevista ?? '');
    setLocalTipo(ordem.local_tipo);
    setResponsavel(ordem.responsavel_nome_snapshot ?? '');
    setEquipe(ordem.equipe_prevista == null ? '' : String(ordem.equipe_prevista));
    setPrioridade(ordem.prioridade);
    setDescricao(ordem.descricao ?? '');
    setInstrucoes(ordem.instrucoes ?? '');
    setEtapaSelecionada(ordem.processo_id);
  };

  const alterarAbertura = (open: boolean) => {
    if (salvando || reclassificando) return;
    setAberto(open);
    if (open) {
      preencher();
      void carregarEtapas();
    }
  };

  const alterarEtapa = async () => {
    if (!etapaSelecionada || etapaSelecionada === ordem.processo_id) {
      toast.error('Selecione uma etapa diferente da atual.');
      return;
    }

    setReclassificando(true);
    try {
      const { error } = await (supabase.rpc as any)(
        'reclassificar_ordem_producao_etapa_v1',
        {
          p_ordem_producao_id: ordem.id,
          p_nova_etapa_id: etapaSelecionada,
          p_justificativa: null,
        },
      );
      if (error) throw error;

      await onSuccess();
      const destino = etapas.find((etapa) => etapa.id === etapaSelecionada);
      toast.success(
        `${formatarNumeroOrdemProducao(ordem.numero)} movida para ${destino?.nome ?? 'a nova etapa'}. O histórico de apontamentos foi sincronizado.`,
      );
      setAberto(false);
    } catch (error: any) {
      toast.error(error?.message ?? 'Não foi possível alterar a etapa da OP.');
    } finally {
      setReclassificando(false);
    }
  };

  const salvar = async (event: FormEvent) => {
    event.preventDefault();

    if (!editavelPlanejamento) {
      toast.error('Esta OP não permite alteração dos dados de planejamento. Use apenas a reclassificação de etapa.');
      return;
    }

    const quantidadeNormalizada = numero(quantidade);
    const duracaoNormalizada = numero(duracaoHoras);
    const equipeNormalizada = equipe.trim() ? Number(equipe) : null;

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

    if (!Number.isFinite(duracaoNormalizada) || duracaoNormalizada <= 0) {
      toast.error('Informe o tempo estimado de execução da OP em horas.');
      return;
    }

    if ((inicio && !fim) || (!inicio && fim) || (inicio && fim && fim < inicio)) {
      toast.error('Informe as duas datas da programação ou deixe ambas em branco.');
      return;
    }

    if (
      equipeNormalizada === null ||
      !Number.isInteger(equipeNormalizada) ||
      equipeNormalizada <= 0
    ) {
      toast.error('Informe uma equipe necessária de pelo menos 1 pessoa.');
      return;
    }

    setSalvando(true);
    try {
      await editarOrdemProducao({
        ordem_producao_id: ordem.id,
        quantidade_planejada: quantidadeNormalizada,
        duracao_estimada_horas: duracaoNormalizada,
        data_inicio_prevista: inicio || null,
        data_fim_prevista: fim || null,
        local_tipo: localTipo,
        responsavel_id: ordem.responsavel_id,
        responsavel_nome: responsavel.trim() || null,
        equipe_prevista: equipeNormalizada,
        descricao: descricao.trim() || null,
        instrucoes: instrucoes.trim() || null,
        prioridade,
        justificativa: null,
        tarefa_id: ordem.tarefa_id,
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

  if (!reclassificavel && !editavelPlanejamento) return null;

  return (
    <Dialog open={aberto} onOpenChange={alterarAbertura}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          className="h-9 w-9 shrink-0"
          title={`Editar ${formatarNumeroOrdemProducao(ordem.numero)}`}
          aria-label={`Editar ${formatarNumeroOrdemProducao(ordem.numero)}`}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Editar {formatarNumeroOrdemProducao(ordem.numero)}
          </DialogTitle>
          <DialogDescription>
            Os dados produtivos já apontados permanecem preservados. A etapa pode ser reclassificada dentro do mesmo projeto com sincronização do histórico.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={salvar} className="space-y-5">
          <div className="rounded-lg border bg-muted/20 p-4 text-sm">
            <p><strong>Projeto:</strong> {ordem.projeto_nome}</p>
            <p><strong>Etapa atual:</strong> {ordem.processo_codigo} · {ordem.processo_nome}</p>
            <p><strong>Atividade da OP:</strong> {ordem.tarefa_nome_snapshot ?? 'Ainda não vinculada'}</p>
            <p><strong>Produção confirmada:</strong> {formatarQuantidade(Number(ordem.quantidade_realizada))} {ordem.unidade_medida ?? ''}</p>
          </div>

          {reclassificavel && (
            <div className="rounded-lg border p-4 space-y-3">
              <div>
                <Label>Alterar etapa da OP</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Mostra somente etapas do mesmo projeto. Ao confirmar, a OP e todos os apontamentos vinculados a ela passam a usar a nova etapa.
                </p>
              </div>
              <Select value={etapaSelecionada} onValueChange={setEtapaSelecionada}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {etapas.map((etapa) => (
                    <SelectItem key={etapa.id} value={etapa.id}>
                      {etapa.codigo} · {etapa.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="secondary"
                onClick={alterarEtapa}
                disabled={reclassificando || etapaSelecionada === ordem.processo_id}
              >
                {reclassificando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
                Alterar etapa e sincronizar histórico
              </Button>
            </div>
          )}

          {editavelPlanejamento && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Quantidade planejada da OP *</Label>
                  <Input value={quantidade} onChange={(event) => setQuantidade(event.target.value)} inputMode="decimal" className="font-medium" required />
                </div>
                <div className="space-y-2">
                  <Label>Local operacional *</Label>
                  <Select value={localTipo} onValueChange={(value) => setLocalTipo(value as ProducaoLocalTipo)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fábrica">Fábrica</SelectItem>
                      <SelectItem value="Execução">Execução</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tempo estimado de execução (horas) *</Label>
                  <Input value={duracaoHoras} onChange={(event) => setDuracaoHoras(event.target.value)} inputMode="decimal" placeholder="Ex.: 16" required />
                </div>
                <div className="space-y-2">
                  <Label>Equipe necessária *</Label>
                  <Input type="number" min="1" step="1" value={equipe} onChange={(event) => setEquipe(event.target.value)} required />
                </div>
                <div className="space-y-2 sm:col-span-2 rounded-lg border bg-muted/20 p-3">
                  <p className="text-sm font-medium">Programação da OP</p>
                  <p className="text-xs text-muted-foreground">
                    Sem datas, a OP fica como “A programar”. Ao informar início e prazo, ela passa para “Programada”.
                  </p>
                </div>
                <div className="space-y-2"><Label>Início planejado</Label><Input type="date" value={inicio} onChange={(event) => setInicio(event.target.value)} /></div>
                <div className="space-y-2"><Label>Prazo da OP</Label><Input type="date" value={fim} onChange={(event) => setFim(event.target.value)} /></div>
                <div className="space-y-2 sm:col-span-2"><Label>Responsável</Label><Input value={responsavel} onChange={(event) => setResponsavel(event.target.value)} /></div>
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
                <Label>Descrição</Label>
                <CampoDescricaoComVoz value={descricao} onChange={setDescricao} placeholder="Descreva de forma objetiva o que deve ser executado nesta OP." rows={4} />
              </div>

              <div className="space-y-2">
                <Label>Instruções para execução</Label>
                <Textarea value={instrucoes} onChange={(event) => setInstrucoes(event.target.value)} rows={4} />
              </div>
            </>
          )}

          <DialogFooter className="sticky -bottom-6 -mx-6 border-t bg-background px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setAberto(false)} disabled={salvando || reclassificando}>Voltar</Button>
            {editavelPlanejamento && (
              <Button type="submit" disabled={salvando || reclassificando}>
                {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
                Salvar alterações da OP
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
