import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { AlertTriangle, Check, Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  useProcessosProducao,
  type DependenciaEtapaInput,
} from '@/hooks/useProcessosProducao';
import type { ProducaoPrioridade, ProducaoProcesso } from '@/types/producao';

interface Props {
  processo: ProducaoProcesso;
  temOps: boolean;
  onSuccess: () => void | Promise<void>;
}

interface FormData {
  nome: string;
  descricao: string;
  prioridade: ProducaoPrioridade;
  produto_entregavel: string;
  unidade_medida: string;
  quantidade_planejada: string;
  data_inicio_prevista: string;
  data_fim_prevista: string;
  grupo_cronograma: string;
  sequencia: string;
  capacidade_diaria: string;
  pessoas_necessarias: string;
  aceita_producao_proporcional: boolean;
  justificativa: string;
}

const numeroOpcional = (valor: string) => {
  if (!valor.trim()) return null;
  const numero = Number(valor.replace(',', '.'));
  if (!Number.isFinite(numero)) throw new Error('Valor numérico inválido.');
  return numero;
};

const textoNumero = (valor: number | null | undefined) =>
  valor === null || valor === undefined ? '' : String(valor).replace('.', ',');

export const FormRetificarProcesso = ({ processo, temOps, onSuccess }: Props) => {
  const [aberto, setAberto] = useState(false);
  const [dependencias, setDependencias] = useState<DependenciaEtapaInput[]>([]);
  const [novaDependenciaId, setNovaDependenciaId] = useState('');
  const [novoTipoDependencia, setNovoTipoDependencia] = useState<'fim_inicio' | 'inicio_inicio'>('fim_inicio');
  const [carregando, setCarregando] = useState(false);
  const {
    processos,
    listarProcessos,
    listarDependencias,
    retificarProcesso,
  } = useProcessosProducao();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>();

  const prioridade = watch('prioridade');
  const proporcional = watch('aceita_producao_proporcional');

  const preencherFormulario = () => {
    reset({
      nome: processo.nome,
      descricao: processo.descricao ?? '',
      prioridade: processo.prioridade,
      produto_entregavel: processo.produto_entregavel ?? '',
      unidade_medida: processo.unidade_medida ?? '',
      quantidade_planejada: textoNumero(processo.quantidade_planejada),
      data_inicio_prevista: processo.data_inicio_desejada ?? '',
      data_fim_prevista: processo.data_limite ?? '',
      grupo_cronograma: processo.grupo_cronograma ?? '',
      sequencia: String(processo.sequencia ?? 0),
      capacidade_diaria: textoNumero(processo.capacidade_diaria),
      pessoas_necessarias: textoNumero(processo.pessoas_necessarias),
      aceita_producao_proporcional: processo.aceita_producao_proporcional,
      justificativa: '',
    });
  };

  useEffect(() => {
    if (!aberto) return;
    preencherFormulario();
    setNovaDependenciaId('');
    setNovoTipoDependencia('fim_inicio');
    setCarregando(true);
    void Promise.all([
      listarProcessos(),
      listarDependencias(processo.id),
    ])
      .then(([, dependenciasAtuais]) => setDependencias(dependenciasAtuais))
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Não foi possível preparar a retificação.');
        setAberto(false);
      })
      .finally(() => setCarregando(false));
  // As funções são estáveis; processo é o registro que abriu o modal.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, processo.id]);

  const etapasMesmoProjeto = useMemo(() => processos.filter((item) =>
    item.id !== processo.id &&
    item.projeto_id === processo.projeto_id &&
    item.status !== 'cancelado',
  ), [processo.id, processo.projeto_id, processos]);

  const adicionarDependencia = () => {
    if (!novaDependenciaId || dependencias.some((item) => item.etapa_id === novaDependenciaId)) return;
    setDependencias((atuais) => [...atuais, {
      etapa_id: novaDependenciaId,
      tipo: novoTipoDependencia,
    }]);
    setNovaDependenciaId('');
    setNovoTipoDependencia('fim_inicio');
  };

  const onSubmit = async (data: FormData) => {
    try {
      if (data.data_inicio_prevista && data.data_fim_prevista && data.data_fim_prevista < data.data_inicio_prevista) {
        throw new Error('A data limite não pode ser anterior à data inicial desejada.');
      }

      const quantidade = numeroOpcional(data.quantidade_planejada);
      const capacidade = numeroOpcional(data.capacidade_diaria);
      const pessoas = numeroOpcional(data.pessoas_necessarias);
      const sequencia = numeroOpcional(data.sequencia) ?? 0;

      if (quantidade !== null && quantidade < 0) throw new Error('Quantidade planejada inválida.');
      if (capacidade !== null && capacidade <= 0) throw new Error('Capacidade diária deve ser maior que zero.');
      if (pessoas !== null && (!Number.isInteger(pessoas) || pessoas < 0)) {
        throw new Error('Pessoas necessárias deve ser um número inteiro igual ou maior que zero.');
      }
      if (!Number.isInteger(sequencia) || sequencia < 0) throw new Error('Ordem no cronograma inválida.');
      if (data.justificativa.trim().length < 5) throw new Error('Informe uma justificativa com pelo menos 5 caracteres.');

      await retificarProcesso(processo.id, {
        nome: data.nome.trim(),
        descricao: data.descricao.trim() || null,
        prioridade: data.prioridade,
        produto_entregavel: data.produto_entregavel.trim() || null,
        unidade_medida: data.unidade_medida.trim() || null,
        quantidade_planejada: quantidade,
        data_inicio_prevista: data.data_inicio_prevista || null,
        data_fim_prevista: data.data_fim_prevista || null,
        grupo_cronograma: data.grupo_cronograma.trim() || null,
        sequencia,
        capacidade_diaria: capacidade,
        pessoas_necessarias: pessoas,
        aceita_producao_proporcional: data.aceita_producao_proporcional,
        dependencias,
        justificativa: data.justificativa.trim(),
      });

      setAberto(false);
      await onSuccess();
      toast.success(`Etapa ${processo.codigo} retificada e registrada na auditoria.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível retificar a etapa.');
    }
  };

  const projeto = `${processo.projeto?.nome ?? 'Projeto não identificado'}${
    processo.projeto?.cidade ? ` · ${processo.projeto.cidade}/${processo.projeto.uf ?? ''}` : ''
  }`;

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil className="mr-2 h-4 w-4" />Retificar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[780px]">
        <DialogHeader>
          <DialogTitle>Retificar Etapa {processo.codigo}</DialogTitle>
          <DialogDescription>
            Corrija o cadastro sem alterar o código, o Projeto, o status ou a rastreabilidade da Etapa.
          </DialogDescription>
        </DialogHeader>

        {carregando ? (
          <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando dados da Etapa...
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pt-2">
            <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2">
              <div><p className="text-xs text-muted-foreground">Código preservado</p><p className="font-mono text-sm font-semibold">{processo.codigo}</p></div>
              <div><p className="text-xs text-muted-foreground">Projeto preservado</p><p className="text-sm font-semibold">{projeto}</p></div>
            </div>

            {temOps && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Esta Etapa já possui OP. A retificação não altera as OPs emitidas. A quantidade da Etapa não poderá ficar abaixo do total já distribuído.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <div className="space-y-2">
                <Label>Nome da Etapa *</Label>
                <Input {...register('nome', { required: 'Nome obrigatório' })} />
                {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={prioridade} onValueChange={(value) => setValue('prioridade', value as ProducaoPrioridade)}>
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
              <Textarea rows={3} {...register('descricao')} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Grupo do cronograma</Label><Input {...register('grupo_cronograma')} /></div>
              <div className="space-y-2"><Label>Ordem no cronograma</Label><Input type="number" min="0" step="1" {...register('sequencia')} /></div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Data inicial desejada</Label><Input type="date" {...register('data_inicio_prevista')} /></div>
              <div className="space-y-2"><Label>Data limite</Label><Input type="date" {...register('data_fim_prevista')} /></div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2"><Label>Produto/entregável</Label><Input {...register('produto_entregavel')} /></div>
              <div className="space-y-2"><Label>Unidade</Label><Input placeholder="UN, peças, m²..." {...register('unidade_medida')} /></div>
              <div className="space-y-2"><Label>Quantidade planejada</Label><Input inputMode="decimal" {...register('quantidade_planejada')} /></div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Capacidade diária</Label>
                <Input inputMode="decimal" placeholder="Ex.: 10" {...register('capacidade_diaria')} />
              </div>
              <div className="space-y-2">
                <Label>Quantidade de pessoas necessárias</Label>
                <Input type="number" min="0" step="1" placeholder="Ex.: 2" {...register('pessoas_necessarias')} />
                <p className="text-xs text-muted-foreground">Informe apenas a quantidade. Os nomes são definidos na OP e no apontamento.</p>
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-lg border p-3">
              <Checkbox checked={proporcional} onCheckedChange={(checked) => setValue('aceita_producao_proporcional', checked === true)} />
              <span>
                <span className="block text-sm font-medium">Aceita produção proporcional</span>
                <span className="text-xs text-muted-foreground">Permite reduzir a meta diária quando houver menos pessoas disponíveis.</span>
              </span>
            </label>

            <div className="space-y-3 rounded-lg border p-4">
              <div>
                <Label>Dependências da Etapa</Label>
                <p className="text-xs text-muted-foreground">Apenas Etapas ativas do mesmo Projeto podem ser predecessoras.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_160px_auto]">
                <Select value={novaDependenciaId} onValueChange={setNovaDependenciaId}>
                  <SelectTrigger><SelectValue placeholder="Etapa predecessora" /></SelectTrigger>
                  <SelectContent>
                    {etapasMesmoProjeto
                      .filter((item) => !dependencias.some((dependencia) => dependencia.etapa_id === item.id))
                      .map((item) => <SelectItem key={item.id} value={item.id}>{item.codigo} · {item.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={novoTipoDependencia} onValueChange={(value) => setNovoTipoDependencia(value as 'fim_inicio' | 'inicio_inicio')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fim_inicio">Fim → Início</SelectItem>
                    <SelectItem value="inicio_inicio">Início → Início</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={adicionarDependencia} disabled={!novaDependenciaId}>Adicionar</Button>
              </div>

              {dependencias.map((dependencia) => {
                const etapa = processos.find((item) => item.id === dependencia.etapa_id);
                return (
                  <div key={dependencia.etapa_id} className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2 text-sm">
                    <span className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" />{etapa?.codigo ?? 'Etapa'} · {etapa?.nome ?? dependencia.etapa_id} — {dependencia.tipo === 'fim_inicio' ? 'Fim → Início' : 'Início → Início'}</span>
                    <Button type="button" size="icon" variant="ghost" onClick={() => setDependencias((atuais) => atuais.filter((item) => item.etapa_id !== dependencia.etapa_id))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <Label>Justificativa da retificação *</Label>
              <Textarea
                rows={3}
                placeholder="Ex.: Correção da quantidade e da equipe previstas após revisão do planejamento."
                {...register('justificativa', {
                  required: 'Justificativa obrigatória',
                  minLength: { value: 5, message: 'Use pelo menos 5 caracteres' },
                })}
              />
              {errors.justificativa && <p className="text-xs text-destructive">{errors.justificativa.message}</p>}
              <p className="text-xs text-muted-foreground">A justificativa e os valores anteriores ficarão registrados na auditoria.</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAberto(false)} disabled={isSubmitting}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar retificação e recalcular
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
