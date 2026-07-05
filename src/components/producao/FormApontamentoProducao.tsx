import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronsUpDown,
  Clock,
  ImagePlus,
  Loader2,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import type {
  LocalUtilizacaoConfig,
} from '@/hooks/useConfiguracoes';
import { calcularDuracaoProducao } from '@/hooks/useProducao';
import { useProducaoAnexos } from '@/hooks/useProducaoAnexos';
import { cn } from '@/lib/utils';
import type {
  NovoApontamentoProducao,
  ProducaoApontamento,
  ProducaoLocalTipo,
  ProducaoMembro,
  ProducaoTarefa,
} from '@/types/producao';

interface FormApontamentoProducaoProps {
  tarefas: ProducaoTarefa[];
  locais: LocalUtilizacaoConfig[];
  membros: ProducaoMembro[];
  podeApontar: boolean;
  criarApontamento: (
    dados: NovoApontamentoProducao,
  ) => Promise<ProducaoApontamento>;
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

interface OpcaoPesquisa {
  id: string;
  nome: string;
}

interface CampoPesquisavelProps {
  opcoes: OpcaoPesquisa[];
  valor: string;
  onChange: (valor: string) => void;
  placeholder: string;
  buscaPlaceholder: string;
  vazioTexto: string;
  disabled?: boolean;
  erro?: boolean;
}

type CampoErro =
  | 'data'
  | 'projeto'
  | 'tarefa'
  | 'localTipo'
  | 'inicio'
  | 'termino'
  | 'quantidade'
  | 'membros';

type ErrosFormulario = Partial<Record<CampoErro, string>>;

const hoje = () => new Date().toISOString().slice(0, 10);
const MEMBROS_INICIAIS_VAZIOS: string[] = [];
const TIPOS_IMAGEM_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];
const TAMANHO_MAXIMO_IMAGEM = 10 * 1024 * 1024;
const horaAtual = () =>
  new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

const formatarDuracao = (minutos: number) => {
  const horas = Math.floor(minutos / 60);
  const restante = minutos % 60;

  if (horas === 0) return `${restante}min`;
  if (restante === 0) return `${horas}h`;
  return `${horas}h${String(restante).padStart(2, '0')}`;
};

const SecaoFormulario = ({
  numero,
  titulo,
  children,
}: {
  numero: number;
  titulo: string;
  children: React.ReactNode;
}) => (
  <section className="space-y-4 rounded-xl border border-border/60 bg-muted/10 p-4 sm:p-5">
    <div className="flex items-center gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {numero}
      </span>
      <h3 className="font-semibold">{titulo}</h3>
    </div>
    {children}
  </section>
);

const MensagemErro = ({ texto }: { texto?: string }) =>
  texto ? <p className="text-xs font-medium text-destructive">{texto}</p> : null;

const CampoPesquisavel = ({
  opcoes,
  valor,
  onChange,
  placeholder,
  buscaPlaceholder,
  vazioTexto,
  disabled,
  erro,
}: CampoPesquisavelProps) => {
  const [aberto, setAberto] = useState(false);
  const selecionado = opcoes.find((opcao) => opcao.id === valor);

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={aberto}
          disabled={disabled}
          className={cn(
            'w-full justify-between overflow-hidden font-normal',
            !selecionado && 'text-muted-foreground',
            erro && 'border-destructive focus-visible:ring-destructive',
          )}
        >
          <span className="truncate">{selecionado?.nome ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={buscaPlaceholder} />
          <CommandList>
            <CommandEmpty>{vazioTexto}</CommandEmpty>
            <CommandGroup>
              {opcoes.map((opcao) => (
                <CommandItem
                  key={opcao.id}
                  value={`${opcao.nome} ${opcao.id}`}
                  onSelect={() => {
                    onChange(opcao.id);
                    setAberto(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      valor === opcao.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {opcao.nome}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export const FormApontamentoProducao = ({
  tarefas,
  locais,
  membros,
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
  const [localTipo, setLocalTipo] =
    useState<ProducaoLocalTipo>('Fábrica');
  const [tarefaId, setTarefaId] = useState('');
  const [inicio, setInicio] = useState('');
  const [termino, setTermino] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [membrosIds, setMembrosIds] = useState<string[]>([]);
  const [buscaMembro, setBuscaMembro] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [erros, setErros] = useState<ErrosFormulario>({});
  const [salvando, setSalvando] = useState(false);
  const [imagensPendentes, setImagensPendentes] = useState<File[]>([]);
  const [removendoAnexoId, setRemovendoAnexoId] = useState<string | null>(null);
  const inputImagemRef = useRef<HTMLInputElement>(null);
  const {
    anexos,
    loading: carregandoAnexos,
    listarAnexos,
    anexarImagem,
    removerAnexo,
  } = useProducaoAnexos();

  const editando = Boolean(apontamentoInicial);
  const locaisAtivos = useMemo(
    () =>
      locais
        .filter((local) => local.ativo)
        .map((local) => ({ id: local.id, nome: local.nome })),
    [locais],
  );
  const tarefasAtivas = useMemo(
    () =>
      tarefas
        .filter((tarefa) => tarefa.ativo)
        .map((tarefa) => ({ id: tarefa.id, nome: tarefa.nome })),
    [tarefas],
  );
  const membrosAtivos = useMemo(
    () => membros.filter((membro) => membro.ativo),
    [membros],
  );
  const membrosSelecionados = useMemo(
    () =>
      membrosIds
        .map((id) => membrosAtivos.find((membro) => membro.id === id))
        .filter((membro): membro is ProducaoMembro => Boolean(membro)),
    [membrosAtivos, membrosIds],
  );
  const membrosFiltrados = useMemo(() => {
    const termo = buscaMembro.trim().toLocaleLowerCase('pt-BR');
    if (!termo) return [];

    return membrosAtivos
      .filter(
        (membro) =>
          !membrosIds.includes(membro.id) &&
          membro.nome.toLocaleLowerCase('pt-BR').includes(termo),
      )
      .slice(0, 8);
  }, [buscaMembro, membrosAtivos, membrosIds]);

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
      setBuscaMembro('');
      setObservacoes('');
      setErros({});
      setImagensPendentes([]);
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
    setBuscaMembro('');
    setObservacoes(apontamentoInicial.observacoes ?? '');
    setErros({});
    setImagensPendentes([]);
  }, [apontamentoInicial, membrosIniciais]);

  useEffect(() => {
    if (!apontamentoInicial) return;

    void listarAnexos(apontamentoInicial.id).catch(() => {
      toast.error('Não foi possível carregar as imagens do apontamento.');
    });
  }, [apontamentoInicial, listarAnexos]);

  const duracao = useMemo(() => {
    if (!inicio || !termino) return null;

    try {
      return calcularDuracaoProducao(inicio, termino);
    } catch {
      return null;
    }
  }, [inicio, termino]);

  const limparErro = (campo: CampoErro) => {
    setErros((atuais) => {
      if (!atuais[campo]) return atuais;
      const proximos = { ...atuais };
      delete proximos[campo];
      return proximos;
    });
  };

  const adicionarMembro = (membroId: string) => {
    setMembrosIds((atuais) => [...new Set([...atuais, membroId])]);
    setBuscaMembro('');
    limparErro('membros');
  };

  const removerMembro = (membroId: string) => {
    setMembrosIds((atuais) => atuais.filter((id) => id !== membroId));
  };

  const selecionarImagens = (arquivos: FileList | null) => {
    if (!arquivos) return;

    const validos: File[] = [];
    Array.from(arquivos).forEach((arquivo) => {
      if (!TIPOS_IMAGEM_PERMITIDOS.includes(arquivo.type)) {
        toast.error(`${arquivo.name}: use uma imagem JPEG, PNG ou WebP.`);
        return;
      }
      if (arquivo.size <= 0 || arquivo.size > TAMANHO_MAXIMO_IMAGEM) {
        toast.error(`${arquivo.name}: a imagem deve ter entre 1 byte e 10 MB.`);
        return;
      }
      validos.push(arquivo);
    });

    setImagensPendentes((atuais) => {
      const chavesAtuais = new Set(
        atuais.map(
          (arquivo) =>
            `${arquivo.name}-${arquivo.size}-${arquivo.lastModified}`,
        ),
      );
      return [
        ...atuais,
        ...validos.filter(
          (arquivo) =>
            !chavesAtuais.has(
              `${arquivo.name}-${arquivo.size}-${arquivo.lastModified}`,
            ),
        ),
      ];
    });
  };

  const excluirAnexoExistente = async (anexoId: string) => {
    setRemovendoAnexoId(anexoId);
    try {
      await removerAnexo(anexoId);
      toast.success('Imagem removida.');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível remover a imagem.',
      );
    } finally {
      setRemovendoAnexoId(null);
    }
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
    setBuscaMembro('');
    setObservacoes('');
    setErros({});
    setImagensPendentes([]);
    if (inputImagemRef.current) inputImagemRef.current.value = '';
  };

  const validarFormulario = () => {
    const novosErros: ErrosFormulario = {};

    if (!data) novosErros.data = 'Informe a data do apontamento.';
    if (!projetoLocalId) novosErros.projeto = 'Selecione um projeto/local.';
    if (!tarefaId) novosErros.tarefa = 'Selecione uma tarefa.';
    if (!localTipo) novosErros.localTipo = 'Selecione o local de execução.';
    if (!inicio) novosErros.inicio = 'Informe o horário de início.';
    if (!termino) novosErros.termino = 'Informe o horário de término.';
    if (inicio && termino && !duracao) {
      novosErros.termino = 'O término deve ser maior que o início.';
    }
    if (membrosIds.length === 0) {
      novosErros.membros = 'Selecione pelo menos um membro da equipe.';
    }

    const quantidadeProduzida = quantidade.trim()
      ? Number(quantidade.replace(',', '.'))
      : null;
    if (
      quantidadeProduzida !== null &&
      (!Number.isFinite(quantidadeProduzida) || quantidadeProduzida < 0)
    ) {
      novosErros.quantidade = 'Informe uma quantidade válida.';
    }

    setErros(novosErros);
    return {
      valido: Object.keys(novosErros).length === 0,
      quantidadeProduzida,
    };
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!podeApontar) return;

    const validacao = validarFormulario();
    if (!validacao.valido) {
      toast.error('Revise os campos destacados antes de salvar.');
      return;
    }

    const dados: NovoApontamentoProducao = {
      data,
      projeto_local_id: projetoLocalId,
      tarefa_id: tarefaId,
      local_tipo: localTipo,
      quantidade_produzida: validacao.quantidadeProduzida,
      inicio,
      termino,
      observacoes: observacoes.trim() || null,
      membros_ids: membrosIds,
    };

    setSalvando(true);
    try {
      let apontamentoSalvo: ProducaoApontamento;
      if (apontamentoInicial) {
        const { membros_ids: membros, ...alteracoes } = dados;
        apontamentoSalvo = await editarApontamento(
          apontamentoInicial.id,
          alteracoes,
          membros,
        );
      } else {
        apontamentoSalvo = await criarApontamento(dados);
      }

      let imagensComErro = 0;
      for (const imagem of imagensPendentes) {
        try {
          await anexarImagem(apontamentoSalvo.id, imagem);
        } catch {
          imagensComErro += 1;
        }
      }

      if (imagensComErro > 0) {
        toast.warning(
          `Apontamento salvo, mas ${imagensComErro} imagem(ns) não foram enviadas.`,
        );
      } else {
        toast.success(
          apontamentoInicial
            ? 'Apontamento atualizado.'
            : 'Apontamento salvo.',
        );
      }

      if (!apontamentoInicial) limparFormulario();
      else setImagensPendentes([]);
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

      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        <SecaoFormulario numero={1} titulo="Projeto e tarefa">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="producao-data">Data</Label>
              <Input
                id="producao-data"
                type="date"
                value={data}
                onChange={(event) => {
                  setData(event.target.value);
                  limparErro('data');
                }}
                disabled={!podeApontar}
                className={cn(erros.data && 'border-destructive')}
              />
              <MensagemErro texto={erros.data} />
            </div>

            <div className="space-y-2">
              <Label>Projeto/local</Label>
              <CampoPesquisavel
                opcoes={locaisAtivos}
                valor={projetoLocalId}
                onChange={(valor) => {
                  setProjetoLocalId(valor);
                  limparErro('projeto');
                }}
                placeholder="Buscar ou selecionar projeto"
                buscaPlaceholder="Buscar projeto..."
                vazioTexto="Nenhum projeto encontrado."
                disabled={!podeApontar}
                erro={Boolean(erros.projeto)}
              />
              <MensagemErro texto={erros.projeto} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Tarefa</Label>
              {tarefasAtivas.length > 0 ? (
                <>
                  <CampoPesquisavel
                    opcoes={tarefasAtivas}
                    valor={tarefaId}
                    onChange={(valor) => {
                      setTarefaId(valor);
                      limparErro('tarefa');
                    }}
                    placeholder="Buscar ou selecionar tarefa"
                    buscaPlaceholder="Buscar tarefa..."
                    vazioTexto="Nenhuma tarefa encontrada."
                    disabled={!podeApontar}
                    erro={Boolean(erros.tarefa)}
                  />
                  <MensagemErro texto={erros.tarefa} />
                </>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Nenhuma tarefa cadastrada. Cadastre uma tarefa antes de lançar
                    apontamentos.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </SecaoFormulario>

        <SecaoFormulario numero={2} titulo="Horário e produção">
          <div className="space-y-2">
            <Label>Local de execução</Label>
            <div
              className={cn(
                'grid max-w-md grid-cols-2 rounded-lg border bg-background p-1',
                erros.localTipo && 'border-destructive',
              )}
            >
              {(['Fábrica', 'Execução'] as ProducaoLocalTipo[]).map((tipo) => (
                <Button
                  key={tipo}
                  type="button"
                  variant={localTipo === tipo ? 'default' : 'ghost'}
                  className="h-9"
                  disabled={!podeApontar}
                  onClick={() => {
                    setLocalTipo(tipo);
                    limparErro('localTipo');
                  }}
                >
                  {tipo}
                </Button>
              ))}
            </div>
            <MensagemErro texto={erros.localTipo} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {[
              {
                id: 'producao-inicio',
                label: 'Início',
                valor: inicio,
                campo: 'inicio' as const,
                alterar: setInicio,
              },
              {
                id: 'producao-termino',
                label: 'Término',
                valor: termino,
                campo: 'termino' as const,
                alterar: setTermino,
              },
            ].map((horario) => (
              <div key={horario.id} className="space-y-2">
                <Label htmlFor={horario.id}>{horario.label}</Label>
                <Input
                  id={horario.id}
                  type="time"
                  value={horario.valor}
                  onChange={(event) => {
                    horario.alterar(event.target.value);
                    limparErro(horario.campo);
                    if (horario.campo === 'inicio') limparErro('termino');
                  }}
                  disabled={!podeApontar}
                  className={cn(erros[horario.campo] && 'border-destructive')}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!podeApontar}
                  onClick={() => {
                    horario.alterar(horaAtual());
                    limparErro(horario.campo);
                    if (horario.campo === 'inicio') limparErro('termino');
                  }}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  Marcar {horario.label.toLocaleLowerCase('pt-BR')}
                </Button>
                <MensagemErro texto={erros[horario.campo]} />
              </div>
            ))}
          </div>

          <div
            className={cn(
              'flex items-center gap-3 rounded-lg border px-4 py-3',
              duracao
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'bg-muted/30 text-muted-foreground',
            )}
          >
            <Clock className="h-5 w-5 shrink-0" />
            <span className="font-medium">
              {duracao
                ? `Duração calculada: ${formatarDuracao(duracao)}`
                : 'Informe início e término válidos'}
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="producao-quantidade">
              Quantidade produzida, quando aplicável
            </Label>
            <Input
              id="producao-quantidade"
              inputMode="decimal"
              value={quantidade}
              onChange={(event) => {
                setQuantidade(event.target.value);
                limparErro('quantidade');
              }}
              placeholder="Ex.: 7 módulos, 12 peças..."
              disabled={!podeApontar}
              className={cn(erros.quantidade && 'border-destructive')}
            />
            <MensagemErro texto={erros.quantidade} />
          </div>
        </SecaoFormulario>

        <SecaoFormulario numero={3} titulo="Equipe">
          <div className="space-y-2">
            <Label htmlFor="busca-membro-producao">Membros/equipe</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="busca-membro-producao"
                value={buscaMembro}
                onChange={(event) => setBuscaMembro(event.target.value)}
                placeholder="Buscar membro da equipe"
                disabled={!podeApontar || membrosAtivos.length === 0}
                className={cn(
                  'pl-9',
                  erros.membros && 'border-destructive',
                )}
                autoComplete="off"
              />
            </div>

            {buscaMembro.trim() && (
              <div className="max-h-48 overflow-y-auto rounded-lg border bg-popover p-1 shadow-sm">
                {membrosFiltrados.length > 0 ? (
                  membrosFiltrados.map((membro) => (
                    <button
                      key={membro.id}
                      type="button"
                      onClick={() => adicionarMembro(membro.id)}
                      className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      {membro.nome}
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                    Nenhum membro encontrado.
                  </p>
                )}
              </div>
            )}

            {membrosSelecionados.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {membrosSelecionados.map((membro) => (
                  <Badge key={membro.id} variant="secondary" className="gap-1 py-1 pl-2.5">
                    {membro.nome}
                    <button
                      type="button"
                      onClick={() => removerMembro(membro.id)}
                      className="rounded-full p-0.5 hover:bg-background/60"
                      aria-label={`Remover ${membro.nome}`}
                      disabled={!podeApontar}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nenhum membro selecionado.
              </p>
            )}

            {membrosAtivos.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Nenhum membro ativo está disponível para seleção.
                </AlertDescription>
              </Alert>
            )}
            <MensagemErro texto={erros.membros} />
          </div>
        </SecaoFormulario>

        <SecaoFormulario numero={4} titulo="Imagens">
          <input
            ref={inputImagemRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(event) => {
              selecionarImagens(event.target.files);
              event.target.value = '';
            }}
            disabled={!podeApontar || salvando}
          />

          <div className="rounded-lg border border-dashed bg-muted/10 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">Fotos do serviço</p>
                <p className="text-xs text-muted-foreground">
                  JPEG, PNG ou WebP, com até 10 MB por imagem.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={!podeApontar || salvando}
                onClick={() => inputImagemRef.current?.click()}
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                Adicionar imagem
              </Button>
            </div>

            {carregandoAnexos ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando imagens...
              </div>
            ) : (
              (anexos.length > 0 || imagensPendentes.length > 0) && (
                <div className="mt-4 space-y-2">
                  {anexos.map((anexo) => (
                    <div
                      key={anexo.id}
                      className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2"
                    >
                      <span className="min-w-0 truncate text-sm">
                        {anexo.file_name}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remover ${anexo.file_name}`}
                        disabled={
                          !podeApontar || removendoAnexoId === anexo.id
                        }
                        onClick={() => void excluirAnexoExistente(anexo.id)}
                      >
                        {removendoAnexoId === anexo.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                  {imagensPendentes.map((imagem) => {
                    const chave = `${imagem.name}-${imagem.size}-${imagem.lastModified}`;
                    return (
                      <div
                        key={chave}
                        className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm">{imagem.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Pronta para enviar ao salvar
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remover ${imagem.name}`}
                          disabled={!podeApontar || salvando}
                          onClick={() =>
                            setImagensPendentes((atuais) =>
                              atuais.filter(
                                (arquivo) =>
                                  `${arquivo.name}-${arquivo.size}-${arquivo.lastModified}` !==
                                  chave,
                              ),
                            )
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </SecaoFormulario>

        <SecaoFormulario numero={5} titulo="Observações e confirmação">
          <div className="space-y-2">
            <Label htmlFor="producao-observacoes">Observações</Label>
            <Textarea
              id="producao-observacoes"
              value={observacoes}
              onChange={(event) => setObservacoes(event.target.value)}
              rows={3}
              placeholder="Inclua informações importantes para a equipe"
              disabled={!podeApontar}
            />
          </div>

          {podeApontar && (
            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Este apontamento não gera movimentação de estoque.
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={limparFormulario}
                  disabled={salvando}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Limpar
                </Button>
                <Button
                  type="submit"
                  disabled={salvando || tarefasAtivas.length === 0}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {salvando
                    ? 'Salvando...'
                    : editando
                      ? 'Salvar alterações'
                      : 'Salvar apontamento'}
                </Button>
              </div>
            </div>
          )}
        </SecaoFormulario>
      </form>
    </>
  );

  if (compacto) return <div className="space-y-5">{conteudo}</div>;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/10">
        <CardTitle>Apontamento de Produção</CardTitle>
        <CardDescription>
          Registre horas, equipe e produção executada. Este lançamento não
          movimenta estoque.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 p-4 sm:p-6">{conteudo}</CardContent>
    </Card>
  );
};
