import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Plus,
  Loader2,
  AlertCircle,
  Trash2,
  Check,
  ChevronsUpDown,
  Hash,
  Factory,
  Package,
  Workflow,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  useProcessosProducao,
  type DependenciaEtapaInput,
} from '@/hooks/useProcessosProducao';
import { useProjetosProducao } from '@/hooks/useProjetosProducao';
import { cn } from '@/lib/utils';
import type { ProducaoPrioridade } from '@/types/producao';

interface FormProps {
  onSuccess: () => void;
}

interface FormData {
  projeto_local_id: string;
  nome: string;
  descricao: string;
  prioridade: ProducaoPrioridade;
  unidade_medida: string;
  quantidade_planejada: string;
  data_inicio_prevista: string;
  data_fim_prevista: string;
  grupo_cronograma: string;
  sequencia: string;
  capacidade_diaria: string;
  pessoas_necessarias: string;
  aceita_producao_proporcional: boolean;
}

interface ObraDisponivel {
  id: string;
  nome: string;
  quantidadePecas: number;
}

const OBRA_SEM_GRUPO = '__sem_obra_vinculada__';

const numeroOpcional = (valor: string) => {
  if (!valor.trim()) return null;
  const numero = Number(valor.replace(',', '.'));
  if (!Number.isFinite(numero)) throw new Error('Valor numérico inválido.');
  return numero;
};

export const FormProcessoProducao = ({ onSuccess }: FormProps) => {
  const [aberto, setAberto] = useState(false);
  const [obraId, setObraId] = useState('');
  const [seletorPecaAberto, setSeletorPecaAberto] = useState(false);
  const [codigoPrevisto, setCodigoPrevisto] = useState('Carregando...');
  const [dependencias, setDependencias] = useState<DependenciaEtapaInput[]>([]);
  const [novaDependenciaId, setNovaDependenciaId] = useState('');
  const [novoTipoDependencia, setNovoTipoDependencia] = useState<
    'fim_inicio' | 'inicio_inicio'
  >('fim_inicio');

  const {
    criarProcesso,
    processos,
    listarProcessos,
    obterProximoCodigo,
  } = useProcessosProducao();
  const {
    projetos,
    listarProjetos,
    loading: carregandoProjetos,
    erro,
  } = useProjetosProducao();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      projeto_local_id: '',
      prioridade: 'normal',
      sequencia: '0',
      aceita_producao_proporcional: false,
    },
  });

  useEffect(() => {
    if (!aberto) return;

    setDependencias([]);
    setCodigoPrevisto('Carregando...');

    void Promise.all([
      listarProjetos(true),
      listarProcessos(),
      obterProximoCodigo().then(setCodigoPrevisto),
    ]).catch(() => setCodigoPrevisto('Será definido ao salvar'));
  }, [aberto, listarProcessos, listarProjetos, obterProximoCodigo]);

  const projetoLocalId = watch('projeto_local_id');
  const prioridade = watch('prioridade');
  const proporcional = watch('aceita_producao_proporcional');

  const obrasDisponiveis = useMemo<ObraDisponivel[]>(() => {
    const obras = new Map<string, ObraDisponivel>();

    projetos.forEach((projeto) => {
      const id = projeto.group_id ?? OBRA_SEM_GRUPO;
      const nome = projeto.grupo_nome?.trim() || 'Sem obra/evento vinculado';
      const existente = obras.get(id);

      if (existente) {
        existente.quantidadePecas += 1;
      } else {
        obras.set(id, { id, nome, quantidadePecas: 1 });
      }
    });

    return Array.from(obras.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR'),
    );
  }, [projetos]);

  const pecasDaObra = useMemo(
    () =>
      projetos
        .filter(
          (projeto) =>
            (projeto.group_id ?? OBRA_SEM_GRUPO) === obraId,
        )
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [obraId, projetos],
  );

  const obraSelecionada =
    obrasDisponiveis.find((obra) => obra.id === obraId) ?? null;
  const pecaSelecionada =
    projetos.find(
      (projeto) => projeto.local_utilizacao_id === projetoLocalId,
    ) ?? null;

  const etapasMesmaPeca = useMemo(
    () =>
      processos.filter(
        (processo) =>
          processo.projeto?.local_utilizacao_id === projetoLocalId &&
          processo.status !== 'cancelado',
      ),
    [processos, projetoLocalId],
  );

  const selecionarObra = (novaObraId: string) => {
    setObraId(novaObraId);
    setValue('projeto_local_id', '', {
      shouldDirty: true,
      shouldValidate: true,
    });
    setDependencias([]);
    setNovaDependenciaId('');
    setSeletorPecaAberto(false);
  };

  const selecionarPeca = (localUtilizacaoId: string) => {
    setValue('projeto_local_id', localUtilizacaoId, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setDependencias([]);
    setNovaDependenciaId('');
    setSeletorPecaAberto(false);
  };

  const adicionarDependencia = () => {
    if (
      !novaDependenciaId ||
      dependencias.some((item) => item.etapa_id === novaDependenciaId)
    ) {
      return;
    }

    setDependencias((atuais) => [
      ...atuais,
      { etapa_id: novaDependenciaId, tipo: novoTipoDependencia },
    ]);
    setNovaDependenciaId('');
    setNovoTipoDependencia('fim_inicio');
  };

  const onSubmit = async (data: FormData) => {
    try {
      if (!obraSelecionada) {
        throw new Error('Selecione a obra ou evento desta Etapa.');
      }
      if (!pecaSelecionada) {
        throw new Error('Selecione a peça ou produto que receberá esta Etapa.');
      }
      if (
        data.data_inicio_prevista &&
        data.data_fim_prevista &&
        data.data_fim_prevista < data.data_inicio_prevista
      ) {
        throw new Error(
          'A data limite não pode ser anterior à data inicial desejada.',
        );
      }

      const quantidade = numeroOpcional(data.quantidade_planejada);
      const capacidade = numeroOpcional(data.capacidade_diaria);
      const pessoas = numeroOpcional(data.pessoas_necessarias);
      const sequencia = numeroOpcional(data.sequencia) ?? 0;

      if (quantidade !== null && quantidade < 0) {
        throw new Error('Quantidade planejada inválida.');
      }
      if (capacidade !== null && capacidade <= 0) {
        throw new Error('Capacidade diária deve ser maior que zero.');
      }
      if (pessoas !== null && pessoas < 0) {
        throw new Error('Quantidade de pessoas inválida.');
      }

      await criarProcesso({
        projeto_local_id: data.projeto_local_id,
        codigo: null,
        nome: data.nome,
        descricao: data.descricao || null,
        prioridade: data.prioridade,
        produto_entregavel: pecaSelecionada.nome,
        unidade_medida: data.unidade_medida || null,
        quantidade_planejada: quantidade,
        data_inicio_prevista: data.data_inicio_prevista || null,
        data_fim_prevista: data.data_fim_prevista || null,
        grupo_cronograma: data.grupo_cronograma || null,
        sequencia,
        capacidade_diaria: capacidade,
        pessoas_necessarias: pessoas,
        aceita_producao_proporcional:
          data.aceita_producao_proporcional,
        dependencias,
      });

      reset({
        projeto_local_id: '',
        prioridade: 'normal',
        sequencia: '0',
        aceita_producao_proporcional: false,
      });
      setObraId('');
      setDependencias([]);
      setAberto(false);
      toast.success(
        `Etapa criada para ${obraSelecionada.nome} · ${pecaSelecionada.nome}.`,
      );
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Erro ao salvar Etapa.',
      );
    }
  };

  const rotuloPeca = pecaSelecionada
    ? `${pecaSelecionada.nome}${
        pecaSelecionada.cidade
          ? ` · ${pecaSelecionada.cidade}/${pecaSelecionada.uf ?? ''}`
          : ''
      }`
    : obraId
      ? 'Selecione ou pesquise uma peça/produto'
      : 'Selecione primeiro a obra/evento';

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Nova Etapa
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>Nova Etapa de Produção</DialogTitle>
          <DialogDescription>
            Escolha primeiro a obra, depois a peça. A Etapa descreve o que será
            executado nessa peça; as Ordens de Produção serão emitidas dentro da
            Etapa.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
          {erro && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Não foi possível consultar as obras e peças: {erro}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Factory className="h-4 w-4 text-primary" />
              1. Obra
            </div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Package className="h-4 w-4 text-primary" />
              2. Peça
            </div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Workflow className="h-4 w-4 text-primary" />
              3. Etapa
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Hash className="h-4 w-4" />
              4. OP
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Obra/Evento *</Label>
              <Select
                value={obraId}
                onValueChange={selecionarObra}
                disabled={carregandoProjetos || obrasDisponiveis.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a obra ou evento" />
                </SelectTrigger>
                <SelectContent>
                  {obrasDisponiveis.map((obra) => (
                    <SelectItem key={obra.id} value={obra.id}>
                      {obra.nome} · {obra.quantidadePecas}{' '}
                      {obra.quantidadePecas === 1 ? 'peça' : 'peças'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Ex.: Natal Brusque, Natal Cianorte ou obra arquitetônica.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Peça/Produto *</Label>
              <Popover
                open={seletorPecaAberto}
                onOpenChange={setSeletorPecaAberto}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={seletorPecaAberto}
                    className="w-full justify-between font-normal"
                    disabled={
                      !obraId ||
                      carregandoProjetos ||
                      pecasDaObra.length === 0
                    }
                  >
                    <span className="truncate">{rotuloPeca}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[--radix-popover-trigger-width] p-0"
                  align="start"
                >
                  <Command>
                    <CommandInput placeholder="Buscar peça, cliente ou cidade..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma peça encontrada.</CommandEmpty>
                      <CommandGroup heading={obraSelecionada?.nome}>
                        {pecasDaObra.map((projeto) => {
                          const rotulo = `${projeto.nome}${
                            projeto.cidade
                              ? ` · ${projeto.cidade}/${projeto.uf ?? ''}`
                              : ''
                          }`;

                          return (
                            <CommandItem
                              key={projeto.local_utilizacao_id}
                              value={`${rotulo} ${projeto.cliente ?? ''} ${
                                projeto.local_execucao ?? ''
                              }`}
                              onSelect={() =>
                                selecionarPeca(projeto.local_utilizacao_id)
                              }
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  projetoLocalId === projeto.local_utilizacao_id
                                    ? 'opacity-100'
                                    : 'opacity-0',
                                )}
                              />
                              {rotulo}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <input
                type="hidden"
                {...register('projeto_local_id', { required: true })}
              />
              {errors.projeto_local_id && (
                <span className="text-sm text-destructive">
                  Peça/produto obrigatório
                </span>
              )}
            </div>
          </div>

          {pecaSelecionada && (
            <Alert>
              <Package className="h-4 w-4" />
              <AlertDescription>
                <strong>Contexto da Etapa:</strong>{' '}
                {obraSelecionada?.nome ?? 'Obra não identificada'} →{' '}
                {pecaSelecionada.nome}
                {pecaSelecionada.local_execucao
                  ? ` → ${pecaSelecionada.local_execucao}`
                  : ''}
                . O produto/entregável será herdado automaticamente desta peça.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Código automático</Label>
              <div className="relative">
                <Hash className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  value={codigoPrevisto}
                  readOnly
                  className="pl-9 font-mono"
                  aria-label="Próximo código automático da etapa"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                O banco confirma o código sequencial definitivo ao salvar.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select
                value={prioridade}
                onValueChange={(value) =>
                  setValue('prioridade', value as ProducaoPrioridade)
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
            <Label>Nome da Etapa *</Label>
            <Input
              placeholder="Ex.: Montagem da estrutura da Caixa de Presente"
              {...register('nome', { required: 'Nome obrigatório' })}
            />
            {errors.nome && (
              <span className="text-sm text-destructive">
                {errors.nome.message}
              </span>
            )}
            <p className="text-xs text-muted-foreground">
              Descreva a atividade a executar, não repita apenas o nome da peça.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              placeholder="Detalhes técnicos e resultado esperado desta Etapa"
              {...register('descricao')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Grupo do cronograma</Label>
              <Input
                placeholder="Ex.: Estrutura, Elétrica, Acabamento"
                {...register('grupo_cronograma')}
              />
            </div>
            <div className="space-y-2">
              <Label>Ordem no cronograma</Label>
              <Input type="number" min="0" {...register('sequencia')} />
              <p className="text-xs text-muted-foreground">
                Define a posição relativa da Etapa no planejamento.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Data inicial desejada</Label>
              <Input type="date" {...register('data_inicio_prevista')} />
            </div>
            <div className="space-y-2">
              <Label>Data limite</Label>
              <Input type="date" {...register('data_fim_prevista')} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-1">
              <Label>Produto/entregável</Label>
              <Input
                value={pecaSelecionada?.nome ?? ''}
                placeholder="Preenchido ao selecionar a peça"
                readOnly
              />
              <p className="text-xs text-muted-foreground">
                Herdado da peça para manter a rastreabilidade.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Input placeholder="peças, m²..." {...register('unidade_medida')} />
            </div>
            <div className="space-y-2">
              <Label>Quantidade planejada</Label>
              <Input inputMode="decimal" {...register('quantidade_planejada')} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Capacidade diária</Label>
              <Input
                inputMode="decimal"
                placeholder="Quanto pode produzir por dia"
                {...register('capacidade_diaria')}
              />
            </div>
            <div className="space-y-2">
              <Label>Pessoas necessárias</Label>
              <Input
                inputMode="decimal"
                placeholder="Equipe prevista"
                {...register('pessoas_necessarias')}
              />
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              checked={proporcional}
              onCheckedChange={(checked) =>
                setValue('aceita_producao_proporcional', checked === true)
              }
            />
            <span>
              <span className="block text-sm font-medium">
                Aceita produção proporcional
              </span>
              <span className="text-xs text-muted-foreground">
                Permite reduzir a meta diária quando houver menos pessoas
                disponíveis.
              </span>
            </span>
          </label>

          <div className="space-y-3 rounded-lg border p-4">
            <div>
              <Label>Dependências da Etapa</Label>
              <p className="text-xs text-muted-foreground">
                Selecione Etapas anteriores da mesma peça. O cronograma
                respeitará essa relação.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_170px_auto]">
              <Select
                value={novaDependenciaId}
                onValueChange={setNovaDependenciaId}
                disabled={!projetoLocalId || etapasMesmaPeca.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Etapa predecessora" />
                </SelectTrigger>
                <SelectContent>
                  {etapasMesmaPeca
                    .filter(
                      (etapa) =>
                        !dependencias.some(
                          (item) => item.etapa_id === etapa.id,
                        ),
                    )
                    .map((etapa) => (
                      <SelectItem key={etapa.id} value={etapa.id}>
                        {etapa.codigo} · {etapa.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Select
                value={novoTipoDependencia}
                onValueChange={(value) =>
                  setNovoTipoDependencia(
                    value as 'fim_inicio' | 'inicio_inicio',
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fim_inicio">Fim → Início</SelectItem>
                  <SelectItem value="inicio_inicio">Início → Início</SelectItem>
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="outline"
                onClick={adicionarDependencia}
                disabled={!novaDependenciaId}
              >
                Adicionar
              </Button>
            </div>

            {dependencias.map((dependencia) => {
              const etapa = processos.find(
                (item) => item.id === dependencia.etapa_id,
              );

              return (
                <div
                  key={dependencia.etapa_id}
                  className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2 text-sm"
                >
                  <span>
                    {etapa?.codigo} · {etapa?.nome} —{' '}
                    {dependencia.tipo === 'fim_inicio'
                      ? 'Fim → Início'
                      : 'Início → Início'}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setDependencias((atuais) =>
                        atuais.filter(
                          (item) =>
                            item.etapa_id !== dependencia.etapa_id,
                        ),
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}

            {projetoLocalId && etapasMesmaPeca.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Esta será a primeira Etapa da peça; não há predecessora
                disponível.
              </p>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                carregandoProjetos ||
                projetos.length === 0 ||
                !obraId ||
                !projetoLocalId
              }
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Salvar Etapa
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
