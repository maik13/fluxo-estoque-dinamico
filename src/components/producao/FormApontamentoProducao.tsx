import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronsUpDown,
  Clock,
  ImageIcon,
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
  ProducaoApontamentoAnexo,
  ProducaoLocalTipo,
  ProducaoMembro,
  ProducaoTarefa,
} from '@/types/producao';

interface FormApontamentoProducaoProps {
  tarefas: ProducaoTarefa[];
  locais: LocalUtilizacaoConfig[];
  membros: ProducaoMembro[];
  podeApontar: boolean;
  podeConferir?: boolean;
  criarApontamento: (
    dados: NovoApontamentoProducao,
  ) => Promise<ProducaoApontamento>;
  editarApontamento: (
    id: string,
    dados: Partial<Omit<NovoApontamentoProducao, 'membros_ids'>>,
    membrosIds?: string[],
  ) => Promise<ProducaoApontamento>;
  conferirApontamento?: (id: string) => Promise<ProducaoApontamento>;
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
  | 'tempos'
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

const formatarMoeda = (valor: number | null | undefined) =>
  valor === null || valor === undefined
    ? 'Custo incompleto'
    : valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const mensagemErro = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const parseTempoHHmm = (valor: string) => {
  if (!valor.trim()) return 0;
  const match = /^(\d{1,3}):([0-5]\d)$/.exec(valor.trim());
  if (!match) throw new Error('Informe o tempo no formato HH:mm.');
  return Number(match[1]) * 60 + Number(match[2]);
};

const minutosParaHHmm = (minutos: number) => {
  const horas = Math.floor(Math.max(0, minutos) / 60);
  const resto = Math.max(0, minutos) % 60;
  return `${String(horas).padStart(2, '0')}:${String(resto).padStart(2, '0')}`;
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

const MiniaturaImagem = ({ src, alt }: { src: string; alt: string }) => (
  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30">
    {src ? (
      <img src={src} alt={alt} className="h-full w-full object-cover" />
    ) : (
      <ImageIcon className="h-5 w-5 text-muted-foreground" />
    )}
  </div>
);

const MiniaturaImagemPendente = ({ arquivo }: { arquivo: File }) => {
  const [src, setSrc] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(arquivo);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [arquivo]);

  return <MiniaturaImagem src={src} alt={arquivo.name} />;
};

const MiniaturaAnexoExistente = ({
  anexo,
  obterUrl,
}: {
  anexo: ProducaoApontamentoAnexo;
  obterUrl: (filePath: string) => Promise<string>;
}) => {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let ativo = true;

    void obterUrl(anexo.file_path)
      .then((url) => {
        if (ativo) setSrc(url);
      })
      .catch(() => {
        if (ativo) setSrc('');
      });

    return () => {
      ativo = false;
    };
  }, [anexo.file_path, obterUrl]);

  return <MiniaturaImagem src={src} alt={anexo.file_name} />;
};

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
  podeConferir = false,
  criarApontamento,
  editarApontamento,
  conferirApontamento,
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
  const [tempoImprodutivo, setTempoImprodutivo] = useState('00:00');
  const [motivoImprodutivo, setMotivoImprodutivo] = useState('');
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
    obterUrlAnexo,
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
      setTempoImprodutivo('00:00');
      setMotivoImprodutivo('');
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
    setTempoImprodutivo(
      minutosParaHHmm(apontamentoInicial.minutos_improdutivos ?? 0),
    );
    setMotivoImprodutivo(apontamentoInicial.motivo_improdutivo ?? '');
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

  const resumoCustos = useMemo(() => {
    if (!duracao) return null;
    let minutosImprodutivos = 0;
    try {
      minutosImprodutivos = parseTempoHHmm(tempoImprodutivo);
    } catch {
      minutosImprodutivos = 0;
    }
    const minutosProdutivos = Math.max(0, duracao - minutosImprodutivos);
    const eficiencia =
      duracao > 0 ? Number(((minutosProdutivos / duracao) * 100).toFixed(1)) : 0;
    const membrosSemValor = membrosSelecionados
      .filter((membro) => membro.valor_hora === null || membro.valor_hora === undefined)
      .map((membro) => membro.nome);
    const custoIncompleto = membrosSemValor.length > 0;
    const somarCusto = (minutos: number) =>
      membrosSelecionados.reduce((total, membro) => {
        if (membro.valor_hora === null || membro.valor_hora === undefined) {
          return total;
        }
        return total + (membro.valor_hora * minutos) / 60;
      }, 0);

    return {
      minutosProdutivos,
      minutosImprodutivos,
      eficiencia,
      horasHomem: (duracao / 60) * membrosSelecionados.length,
      custoIncompleto,
      membrosSemValor,
      custoTotal: custoIncompleto ? null : somarCusto(duracao),
      custoProdutivo: custoIncompleto ? null : somarCusto(minutosProdutivos),
      custoImprodutivo: custoIncompleto ? null : somarCusto(minutosImprodutivos),
    };
  }, [duracao, membrosSelecionados, tempoImprodutivo]);

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
    setTempoImprodutivo('00:00');
    setMotivoImprodutivo('');
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
    let minutosImprodutivos = 0;
    if (duracao) {
      try {
        minutosImprodutivos = parseTempoHHmm(tempoImprodutivo);
        if (minutosImprodutivos > duracao) {
          novosErros.tempos =
            'O tempo improdutivo não pode ser maior que a duração total.';
        }
        if (minutosImprodutivos > 0 && !motivoImprodutivo.trim()) {
          novosErros.tempos =
            'Informe o motivo quando houver tempo improdutivo.';
        }
      } catch (error) {
        novosErros.tempos = mensagemErro(
          error,
          'Informe o tempo improdutivo no formato HH:mm.',
        );
      }
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
      minutosImprodutivos,
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
      minutos_produtivos: duracao ? duracao - validacao.minutosImprodutivos : 0,
      minutos_improdutivos: validacao.minutosImprodutivos,
      motivo_improdutivo:
        validacao.minutosImprodutivos > 0
          ? motivoImprodutivo.trim()
          : null,
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
      } else if (podeConferir && conferirApontamento) {
        await conferirApontamento(apontamentoSalvo.id);
        toast.success('Apontamento registrado com sucesso.');
      } else {
        toast.success(
          apontamentoInicial
            ? 'Apontamento atualizado.'
            : 'Apontamento salvo como pendente.',
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

          {duracao && (
            <div className="grid gap-4 rounded-lg border bg-muted/10 p-4 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="tempo-produtivo">Tempo efetivamente produtivo</Label>
                <Input
                  id="tempo-produtivo"
                  value={minutosParaHHmm(resumoCustos?.minutosProdutivos ?? duracao)}
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tempo-improdutivo">Tempo improdutivo/perdido</Label>
                <Input
                  id="tempo-improdutivo"
                  value={tempoImprodutivo}
                  onChange={(event) => {
                    setTempoImprodutivo(event.target.value);
                    limparErro('tempos');
                  }}
                  placeholder="00:00"
                  disabled={!podeApontar}
                  className={cn(erros.tempos && 'border-destructive')}
                />
              </div>
              <div className="space-y-2 lg:col-span-3">
                <Label htmlFor="motivo-improdutivo">Motivo da perda</Label>
                <Input
                  id="motivo-improdutivo"
                  value={motivoImprodutivo}
                  onChange={(event) => {
                    setMotivoImprodutivo(event.target.value);
                    limparErro('tempos');
                  }}
                  placeholder="Ex.: espera de material"
                  disabled={!podeApontar}
                  className={cn(erros.tempos && 'border-destructive')}
                />
                <MensagemErro texto={erros.tempos} />
              </div>
            </div>
          )}

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
                    {membro.nome} ·{' '}
                    {membro.valor_hora === null || membro.valor_hora === undefined
                      ? 'sem valor/h'
                      : `${formatarMoeda(membro.valor_hora)}/h`}
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
                  Nenhum membro ativo. Cadastre a equipe em Configurações da
                  Produção.
                </AlertDescription>
              </Alert>
            )}
            <MensagemErro texto={erros.membros} />
          </div>
        </SecaoFormulario>

        {resumoCustos && (
          <SecaoFormulario numero={4} titulo="Prévia de mão de obra">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Horas-relógio</p>
                <p className="text-lg font-semibold">{formatarDuracao(duracao ?? 0)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Horas-homem</p>
                <p className="text-lg font-semibold">
                  {resumoCustos.horasHomem.toLocaleString('pt-BR', {
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Eficiência</p>
                <p className="text-lg font-semibold">{resumoCustos.eficiencia}%</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Membros</p>
                <p className="text-lg font-semibold">{membrosSelecionados.length}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Custo total</p>
                <p className="text-lg font-semibold">{formatarMoeda(resumoCustos.custoTotal)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Custo produtivo</p>
                <p className="text-lg font-semibold">{formatarMoeda(resumoCustos.custoProdutivo)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Custo desperdiçado</p>
                <p className="text-lg font-semibold">{formatarMoeda(resumoCustos.custoImprodutivo)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Tempo perdido</p>
                <p className="text-lg font-semibold">
                  {formatarDuracao(resumoCustos.minutosImprodutivos)}
                </p>
              </div>
            </div>
            {resumoCustos.custoIncompleto && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Custo incompleto</AlertTitle>
                <AlertDescription>
                  Membros sem valor/hora:{' '}
                  {resumoCustos.membrosSemValor.join(', ')}.
                </AlertDescription>
              </Alert>
            )}
          </SecaoFormulario>
        )}

        <SecaoFormulario numero={5} titulo="Imagens">
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
                <p className="mt-1 text-xs text-muted-foreground">
                  As imagens ficam vinculadas ao apontamento e não movimentam
                  estoque.
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
                      <div className="flex min-w-0 items-center gap-3">
                        <MiniaturaAnexoExistente
                          anexo={anexo}
                          obterUrl={obterUrlAnexo}
                        />
                        <span className="min-w-0 truncate text-sm">
                          {anexo.file_name}
                        </span>
                      </div>
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
                        <div className="flex min-w-0 items-center gap-3">
                          <MiniaturaImagemPendente arquivo={imagem} />
                          <div className="min-w-0">
                            <p className="truncate text-sm">{imagem.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Pronta para enviar ao salvar
                            </p>
                          </div>
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

        <SecaoFormulario numero={6} titulo="Observações e confirmação">
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
