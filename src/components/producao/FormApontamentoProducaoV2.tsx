import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Camera, Clock, Info, Search, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { LocalUtilizacaoConfig } from '@/hooks/useConfiguracoes';
import {
  useOrdensProducao,
  formatarIdentificacaoOrdemProducao,
  ordemProducaoEDePintura,
} from '@/hooks/useOrdensProducao';
import { calcularDuracaoProducao } from '@/hooks/useProducao';
import { useProducaoAnexos } from '@/hooks/useProducaoAnexos';
import {
  finalizarJornadaOp,
  obterJornadaOpAberta,
  salvarContextoJornadaOp,
  type ContextoFechamentoJornadaOp,
} from '@/services/producao/jornadasOrdemProducao';
import type {
  HorarioMembroApontamento,
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
  jornadaContexto?: ContextoFechamentoJornadaOp | null;
  onJornadaFinalizada?: () => Promise<unknown> | unknown;
}

type HorarioPersonalizado = { inicio: string; termino: string };
type ConsumoTintaForm = { cor: string; quantidadeUnitariaMl: string };

const consumoTintaVazio = (): ConsumoTintaForm => ({ cor: '', quantidadeUnitariaMl: '' });

const dataLocal = (valor = new Date()) => {
  const ano = valor.getFullYear();
  const mes = String(valor.getMonth() + 1).padStart(2, '0');
  const dia = String(valor.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
};

const horaLocal = (valor = new Date()) =>
  `${String(valor.getHours()).padStart(2, '0')}:${String(valor.getMinutes()).padStart(2, '0')}`;

const normalizarHora = (valor: string | null | undefined) =>
  valor ? valor.slice(0, 5) : '';

const normalizarTexto = (valor: string | null | undefined) =>
  (valor ?? '').trim().toLocaleLowerCase('pt-BR');

const hoje = () => dataLocal();
const horaAtual = () => horaLocal();
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];
const TAMANHO_MAXIMO = 10 * 1024 * 1024;
const ORIGEM_AVULSA = '__avulso__';
const MOTIVOS_REGULARIZACAO = [
  'Esquecimento de fechamento',
  'Falha de internet/sistema',
  'Apontador indisponível',
  'Horário informado posteriormente pela equipe',
  'Correção de lançamento',
  'Outro',
];

export const FormApontamentoProducaoV2 = ({
  tarefas,
  locais,
  membros,
  podeApontar,
  criarApontamento,
  onSuccess,
  jornadaContexto = null,
  onJornadaFinalizada,
}: Props) => {
  const [data, setData] = useState(hoje());
  const [origem, setOrigem] = useState('');
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
  const [horariosMembros, setHorariosMembros] = useState<Record<string, HorarioPersonalizado>>({});
  const [membroHorarioAberto, setMembroHorarioAberto] = useState<string | null>(null);
  const [fotos, setFotos] = useState<File[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [contextoPronto, setContextoPronto] = useState(false);
  const [motivoRegularizacao, setMotivoRegularizacao] = useState('');
  const [motivoRegularizacaoOutro, setMotivoRegularizacaoOutro] = useState('');
  const [justificativaConclusao, setJustificativaConclusao] = useState('');
  const [consumosTinta, setConsumosTinta] = useState<ConsumoTintaForm[]>([
    consumoTintaVazio(),
  ]);
  const [demaoNumero, setDemaoNumero] = useState('');
  const [proximaDemao, setProximaDemao] = useState<number | null>(null);
  const [carregandoDemao, setCarregandoDemao] = useState(false);
  const inputFotosRef = useRef<HTMLInputElement>(null);
  const { ordens, listarOrdens } = useOrdensProducao();
  const { anexarImagem } = useProducaoAnexos();

  useEffect(() => {
    void listarOrdens().catch(() => undefined);
  }, [listarOrdens]);

  const ordensDisponiveis = useMemo(
    () => ordens.filter((ordem) => ordem.status === 'liberada' || ordem.status === 'em_execucao'),
    [ordens],
  );
  const ordemSelecionada = ordensDisponiveis.find((ordem) => ordem.id === origem) ?? null;
  const opDePintura = ordemProducaoEDePintura(ordemSelecionada);
  const avulso = origem === ORIGEM_AVULSA;
  const fechamentoRetroativo = Boolean(jornadaContexto && data < hoje());

  useEffect(() => {
    if (!jornadaContexto) {
      setContextoPronto(false);
      return;
    }

    let ativo = true;

    const aplicar = async () => {
      let tarefa = jornadaContexto.tarefaId;
      let equipe = jornadaContexto.membrosIds;
      let horarios = jornadaContexto.horariosMembros;
      let terminoSalvo = jornadaContexto.terminoRascunho;
      let quantidadeSalva = jornadaContexto.quantidadeProduzidaRascunho;
      let improdutivosSalvos = jornadaContexto.minutosImprodutivosRascunho;
      let motivoImprodutivoSalvo = jornadaContexto.motivoImprodutivoRascunho;
      let observacoesSalvas = jornadaContexto.observacoesRascunho;
      let motivoRegularizacaoSalvo = jornadaContexto.motivoRegularizacaoRascunho;
      let justificativaSalva = jornadaContexto.justificativaConclusaoRascunho;

      try {
        const atual = await obterJornadaOpAberta(jornadaContexto.jornadaId);
        if (atual) {
          tarefa = atual.tarefa_id ?? tarefa;
          equipe = atual.membros_ids;
          horarios = atual.horarios_membros_rascunho;
          terminoSalvo = atual.termino_rascunho;
          quantidadeSalva = atual.quantidade_produzida_rascunho;
          improdutivosSalvos = atual.minutos_improdutivos_rascunho;
          motivoImprodutivoSalvo = atual.motivo_improdutivo_rascunho;
          observacoesSalvas = atual.observacoes_rascunho;
          motivoRegularizacaoSalvo = atual.motivo_regularizacao_rascunho;
          justificativaSalva = atual.justificativa_conclusao_rascunho;
        }
      } catch {
        // O contexto recebido da OP continua sendo utilizado como fallback.
      }

      if (!ativo) return;

      const iniciado = new Date(jornadaContexto.iniciadoEm);
      const dataInicio = dataLocal(iniciado);
      const motivoConhecido = motivoRegularizacaoSalvo
        ? MOTIVOS_REGULARIZACAO.includes(motivoRegularizacaoSalvo)
        : false;

      setOrigem(jornadaContexto.ordemProducaoId);
      setData(dataInicio);
      setInicio(horaLocal(iniciado));
      setTarefaId(tarefa ?? '');
      setMembrosIds([...new Set(equipe ?? [])]);
      setHorariosMembros(
        Object.fromEntries(
          (horarios ?? [])
            .filter((item) => item.membro_id)
            .map((item) => [
              item.membro_id,
              {
                inicio: normalizarHora(item.inicio),
                termino: normalizarHora(item.termino),
              },
            ]),
        ),
      );
      setTermino(
        normalizarHora(terminoSalvo) || (dataInicio < hoje() ? '' : horaAtual()),
      );
      setQuantidade(
        quantidadeSalva == null ? '' : String(quantidadeSalva).replace('.', ','),
      );
      setMinutosImprodutivos(
        improdutivosSalvos == null ? '0' : String(improdutivosSalvos),
      );
      setMotivoImprodutivo(motivoImprodutivoSalvo ?? '');
      setObservacoes(observacoesSalvas ?? '');
      setMotivoRegularizacao(
        motivoRegularizacaoSalvo
          ? motivoConhecido
            ? motivoRegularizacaoSalvo
            : 'Outro'
          : '',
      );
      setMotivoRegularizacaoOutro(
        motivoRegularizacaoSalvo && !motivoConhecido
          ? motivoRegularizacaoSalvo
          : '',
      );
      setJustificativaConclusao(justificativaSalva ?? '');
      setContextoPronto(true);
    };

    setContextoPronto(false);
    void aplicar();

    return () => {
      ativo = false;
    };
  }, [jornadaContexto]);

  useEffect(() => {
    if (!ordemSelecionada) return;

    setProjetoLocalId('');
    setLocalTipo(ordemSelecionada.local_tipo);

    const tarefaPorNome = tarefas.find(
      (tarefa) =>
        normalizarTexto(tarefa.nome) ===
        normalizarTexto(ordemSelecionada.tarefa_nome_snapshot),
    );

    setTarefaId((atual) =>
      atual ||
      ordemSelecionada.tarefa_id ||
      tarefaPorNome?.id ||
      jornadaContexto?.tarefaId ||
      '',
    );

    if (jornadaContexto) {
      setMembrosIds((atuais) => {
        if (atuais.length > 0) return atuais;

        const responsavelPorId = membros.find(
          (membro) => membro.id === jornadaContexto.responsavelId,
        );
        if (responsavelPorId) return [responsavelPorId.id];

        const nomeResponsavel = normalizarTexto(
          jornadaContexto.responsavelNome ??
            ordemSelecionada.responsavel_nome_snapshot,
        );
        if (!nomeResponsavel) return atuais;

        const responsavelPorNome = membros.find(
          (membro) =>
            normalizarTexto(membro.nome) === nomeResponsavel ||
            normalizarTexto(membro.apelido) === nomeResponsavel,
        );

        return responsavelPorNome ? [responsavelPorNome.id] : atuais;
      });
    }
  }, [jornadaContexto, membros, ordemSelecionada, tarefas]);

  useEffect(() => {
    if (!opDePintura || !ordemSelecionada?.id) {
      setDemaoNumero('');
      setProximaDemao(null);
      setCarregandoDemao(false);
      return;
    }

    let ativo = true;
    setCarregandoDemao(true);
    setProximaDemao(null);
    setDemaoNumero('');

    void (async () => {
      const { data, error } = await (supabase.rpc as any)(
        'proxima_demao_pintura_v1',
        { p_ordem_producao_id: ordemSelecionada.id },
      );
      if (!ativo) return;
      if (error) {
        setDemaoNumero('');
        setProximaDemao(null);
        toast.error('Não foi possível identificar a próxima demão desta OP.');
        setCarregandoDemao(false);
        return;
      }

      const proxima = Number(data);
      if (!Number.isInteger(proxima) || proxima <= 0) {
        setDemaoNumero('');
        setProximaDemao(null);
        toast.error('A sequência de demãos desta OP está inconsistente.');
        setCarregandoDemao(false);
        return;
      }

      setProximaDemao(proxima);
      setDemaoNumero(String(proxima));
      setCarregandoDemao(false);
    })();

    return () => {
      ativo = false;
    };
  }, [opDePintura, ordemSelecionada?.id]);

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
      .filter((membro) =>
        [membro.nome, membro.apelido, membro.funcao]
          .filter(Boolean)
          .some((valor) =>
            String(valor).toLocaleLowerCase('pt-BR').includes(termo),
          ),
      )
      .slice(0, 8);
  }, [buscaMembro, membros, membrosIds]);

  const horariosPersonalizadosAtuais = useMemo<HorarioMembroApontamento[]>(
    () =>
      membrosIds.flatMap((membroId) => {
        const ajuste = horariosMembros[membroId];
        if (!ajuste?.inicio || !ajuste?.termino) return [];
        if (ajuste.inicio === inicio && ajuste.termino === termino) return [];
        return [
          {
            membro_id: membroId,
            inicio: ajuste.inicio,
            termino: ajuste.termino,
          },
        ];
      }),
    [horariosMembros, inicio, membrosIds, termino],
  );

  useEffect(() => {
    if (!jornadaContexto || !contextoPronto || salvando) return;

    const quantidadeNumerica = quantidade.trim()
      ? Number(quantidade.replace(',', '.'))
      : null;
    const quantidadeRascunho =
      quantidadeNumerica !== null && Number.isFinite(quantidadeNumerica)
        ? quantidadeNumerica
        : null;
    const improdutivos = Number(minutosImprodutivos || 0);
    const motivoRetroativo =
      motivoRegularizacao === 'Outro'
        ? motivoRegularizacaoOutro.trim()
        : motivoRegularizacao.trim();

    const timer = window.setTimeout(() => {
      void salvarContextoJornadaOp({
        jornadaId: jornadaContexto.jornadaId,
        tarefaId: tarefaId || null,
        membrosIds,
        horariosMembros: horariosPersonalizadosAtuais,
        termino: termino || null,
        quantidadeProduzida: quantidadeRascunho,
        minutosImprodutivos:
          Number.isInteger(improdutivos) && improdutivos >= 0
            ? improdutivos
            : 0,
        motivoImprodutivo: motivoImprodutivo.trim() || null,
        observacoes: observacoes.trim() || null,
        motivoRegularizacao: motivoRetroativo || null,
        justificativaConclusao: justificativaConclusao.trim() || null,
      }).catch(() => undefined);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [
    contextoPronto,
    horariosPersonalizadosAtuais,
    jornadaContexto,
    justificativaConclusao,
    membrosIds,
    minutosImprodutivos,
    motivoImprodutivo,
    motivoRegularizacao,
    motivoRegularizacaoOutro,
    observacoes,
    quantidade,
    salvando,
    tarefaId,
    termino,
  ]);

  const limpar = () => {
    setData(hoje());
    setOrigem('');
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
    setHorariosMembros({});
    setMembroHorarioAberto(null);
    setFotos([]);
    setMotivoRegularizacao('');
    setMotivoRegularizacaoOutro('');
    setJustificativaConclusao('');
    setConsumosTinta([consumoTintaVazio()]);
    setDemaoNumero('');
    setProximaDemao(null);
    setContextoPronto(false);
    if (inputFotosRef.current) inputFotosRef.current.value = '';
  };

  const removerMembro = (id: string) => {
    setMembrosIds((atuais) => atuais.filter((item) => item !== id));
    setHorariosMembros((atuais) => {
      const proximo = { ...atuais };
      delete proximo[id];
      return proximo;
    });
    setMembroHorarioAberto((atual) => (atual === id ? null : atual));
  };

  const atualizarHorarioMembro = (
    id: string,
    campo: keyof HorarioPersonalizado,
    valor: string,
  ) => {
    setHorariosMembros((atuais) => ({
      ...atuais,
      [id]: {
        inicio: atuais[id]?.inicio ?? inicio,
        termino: atuais[id]?.termino ?? termino,
        [campo]: valor,
      },
    }));
  };

  const usarHorarioGeral = (id: string) => {
    setHorariosMembros((atuais) => {
      const proximo = { ...atuais };
      delete proximo[id];
      return proximo;
    });
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
      const chaves = new Set(
        atuais.map(
          (arquivo) => `${arquivo.name}-${arquivo.size}-${arquivo.lastModified}`,
        ),
      );
      return [
        ...atuais,
        ...validas.filter(
          (arquivo) =>
            !chaves.has(`${arquivo.name}-${arquivo.size}-${arquivo.lastModified}`),
        ),
      ];
    });
  };

  const salvar = async (event: FormEvent) => {
    event.preventDefault();
    if (!podeApontar) return;
    if (!origem)
      return void toast.error(
        'Selecione a Ordem de Produção ou a opção de atividade avulsa.',
      );
    if (avulso && !projetoLocalId)
      return void toast.error(
        'Selecione o projeto/local da atividade avulsa.',
      );
    if (!tarefaId)
      return void toast.error('Selecione a atividade executada.');
    if (!duracao)
      return void toast.error(
        'Informe horários válidos de início e término.',
      );
    if (membrosIds.length === 0)
      return void toast.error(
        'Selecione pelo menos um membro da equipe.',
      );

    const horariosPersonalizados: HorarioMembroApontamento[] = [];
    for (const membroId of membrosIds) {
      const ajuste = horariosMembros[membroId];
      if (!ajuste) continue;
      if (!ajuste.inicio || !ajuste.termino) {
        const membro = membros.find((item) => item.id === membroId);
        return void toast.error(
          `Informe início e término para ${
            membro?.nome ?? 'o integrante da equipe'
          }.`,
        );
      }
      try {
        calcularDuracaoProducao(ajuste.inicio, ajuste.termino);
      } catch {
        const membro = membros.find((item) => item.id === membroId);
        return void toast.error(
          `O horário individual de ${
            membro?.nome ?? 'um integrante'
          } é inválido.`,
        );
      }
      if (ajuste.inicio < inicio || ajuste.termino > termino) {
        const membro = membros.find((item) => item.id === membroId);
        return void toast.error(
          `O horário de ${
            membro?.nome ?? 'um integrante'
          } deve estar dentro do período geral do apontamento.`,
        );
      }
      if (ajuste.inicio !== inicio || ajuste.termino !== termino) {
        horariosPersonalizados.push({
          membro_id: membroId,
          inicio: ajuste.inicio,
          termino: ajuste.termino,
        });
      }
    }

    const improdutivos = Number(minutosImprodutivos || 0);
    if (
      !Number.isInteger(improdutivos) ||
      improdutivos < 0 ||
      improdutivos > duracao
    ) {
      toast.error(
        'O tempo improdutivo deve ser um número inteiro entre zero e a duração total.',
      );
      return;
    }
    if (improdutivos > 0 && !motivoImprodutivo.trim()) {
      toast.error('Informe o motivo do tempo improdutivo.');
      return;
    }

    const quantidadeNormalizada = quantidade.trim()
      ? Number(quantidade.replace(',', '.'))
      : null;
    if (
      quantidadeNormalizada !== null &&
      (!Number.isFinite(quantidadeNormalizada) ||
        quantidadeNormalizada < 0)
    ) {
      toast.error('Informe uma quantidade válida.');
      return;
    }

    const consumosTintaNormalizados: Array<{
      cor: string | null;
      quantidade_unitaria_ml: number;
    }> = [];

    let demaoValidada: number | null = null;
    if (opDePintura) {
      if (!ordemSelecionada?.id) {
        toast.error('Não foi possível identificar a OP para validar a demão.');
        return;
      }

      const { data: proximaAtual, error: erroDemao } = await (supabase.rpc as any)(
        'proxima_demao_pintura_v1',
        { p_ordem_producao_id: ordemSelecionada.id },
      );
      if (erroDemao) {
        toast.error('Não foi possível validar a demão desta OP. Atualize a tela e tente novamente.');
        return;
      }

      const esperada = Number(proximaAtual);
      if (!Number.isInteger(esperada) || esperada <= 0) {
        toast.error('A sequência de demãos desta OP está inconsistente.');
        return;
      }

      setProximaDemao(esperada);
      if (!demaoNumero) setDemaoNumero(String(esperada));

      const informada = demaoNumero ? Number(demaoNumero) : esperada;
      if (informada !== esperada) {
        setDemaoNumero(String(esperada));
        toast.error(`A demão selecionada já não é válida. A próxima demão desta OP é a ${esperada}ª.`);
        return;
      }
      demaoValidada = esperada;

      if (
        quantidadeNormalizada === null ||
        !Number.isFinite(quantidadeNormalizada) ||
        quantidadeNormalizada <= 0
      ) {
        toast.error(
          'Informe a quantidade de peças produzidas para calcular o consumo total de tinta.',
        );
        return;
      }

      for (const consumo of consumosTinta) {
        const cor = consumo.cor.trim();
        const quantidadeTexto = consumo.quantidadeUnitariaMl.trim();
        if (!cor && !quantidadeTexto) continue;

        const quantidadeUnitariaMl = Number(
          quantidadeTexto.replace(',', '.'),
        );
        if (
          !Number.isFinite(quantidadeUnitariaMl) ||
          quantidadeUnitariaMl <= 0
        ) {
          toast.error(
            'Informe o valor de tinta unitário por peça, em mL, maior que zero.',
          );
          return;
        }

        consumosTintaNormalizados.push({
          cor: cor || null,
          quantidade_unitaria_ml: quantidadeUnitariaMl,
        });
      }

      if (consumosTintaNormalizados.length === 0) {
        toast.error(
          'O valor de tinta unitário por peça é obrigatório nas OPs de pintura.',
        );
        return;
      }
    }

    const motivoRetroativo =
      motivoRegularizacao === 'Outro'
        ? motivoRegularizacaoOutro.trim()
        : motivoRegularizacao.trim();
    if (fechamentoRetroativo && !motivoRetroativo) {
      toast.error('Informe o motivo do fechamento retroativo.');
      return;
    }

    setSalvando(true);
    try {
      const apontamento = jornadaContexto
        ? await finalizarJornadaOp({
            jornadaId: jornadaContexto.jornadaId,
            tarefaId,
            quantidadeProduzida: quantidadeNormalizada,
            termino,
            minutosImprodutivos: improdutivos,
            motivoImprodutivo:
              improdutivos > 0 ? motivoImprodutivo.trim() : null,
            observacoes: observacoes.trim() || null,
            membrosIds,
            horariosMembros: horariosPersonalizados,
            concluirOp: jornadaContexto.concluirOp,
            motivoRegularizacao: fechamentoRetroativo
              ? motivoRetroativo
              : null,
            justificativaConclusao:
              justificativaConclusao.trim() || null,
            consumosTinta: consumosTintaNormalizados,
            demaoNumero: opDePintura ? demaoValidada : null,
          })
        : await criarApontamento({
            data,
            ordem_producao_id: ordemSelecionada?.id ?? null,
            processo_id: ordemSelecionada?.processo_id ?? null,
            projeto_local_id: avulso ? projetoLocalId : null,
            tarefa_id: tarefaId,
            local_tipo: ordemSelecionada?.local_tipo ?? localTipo,
            quantidade_produzida: quantidadeNormalizada,
            inicio,
            termino,
            minutos_produtivos: duracao - improdutivos,
            minutos_improdutivos: improdutivos,
            motivo_improdutivo:
              improdutivos > 0 ? motivoImprodutivo.trim() : null,
            observacoes: observacoes.trim() || null,
            membros_ids: membrosIds,
            horarios_membros: horariosPersonalizados,
            consumos_tinta:
              opDePintura && consumosTintaNormalizados.length > 0
                ? consumosTintaNormalizados
                : undefined,
            demao_numero: opDePintura ? demaoValidada : null,
          });

      let falhas = 0;
      for (const foto of fotos) {
        try {
          await anexarImagem(apontamento.id, foto);
        } catch {
          falhas += 1;
        }
      }

      const contexto = ordemSelecionada
        ? ` dentro da ${formatarIdentificacaoOrdemProducao(
            ordemSelecionada,
          )}`
        : ' como atividade avulsa';

      if (falhas > 0) {
        toast.warning(
          `Apontamento salvo${contexto}, mas ${falhas} foto(s) não foram enviadas.`,
        );
      } else if (jornadaContexto?.concluirOp) {
        toast.success(
          `Apontamento salvo e ${formatarIdentificacaoOrdemProducao(
            ordemSelecionada!,
          )} concluída.`,
        );
      } else if (jornadaContexto) {
        toast.success(
          `Trabalho encerrado${contexto}. A OP permanece em execução.`,
        );
      } else {
        toast.success(
          `Apontamento salvo${contexto} e pendente de conferência.`,
        );
      }

      limpar();
      if (jornadaContexto) {
        await onJornadaFinalizada?.();
      } else {
        await onSuccess?.();
      }
      await listarOrdens();
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

  return (
    <form onSubmit={salvar} className="space-y-6 rounded-lg border bg-card p-5">
      <div>
        <h3 className="text-lg font-semibold">
          {jornadaContexto
            ? jornadaContexto.concluirOp
              ? 'Finalizar OP e registrar apontamento'
              : 'Encerrar trabalho e registrar apontamento'
            : 'Novo Apontamento'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {jornadaContexto
            ? 'Você está fechando a jornada desta OP. O contexto já registrado é recuperado automaticamente; ajuste somente o que realmente mudou.'
            : 'Registre a execução real dentro de uma OP já emitida.'}
        </p>
      </div>

      {jornadaContexto ? (
        <Alert
          className={
            fechamentoRetroativo
              ? 'border-amber-500/40 bg-amber-500/5'
              : ''
          }
        >
          {fechamentoRetroativo ? (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          ) : (
            <Info className="h-4 w-4" />
          )}
          <AlertDescription>
            {fechamentoRetroativo
              ? 'Esta jornada ficou aberta de um dia para o outro. Informe o horário em que o trabalho realmente terminou e o motivo da regularização. O Histórico ficará sinalizado para auditoria.'
              : 'A hora de início veio do clique em “Iniciar OP/Iniciar trabalho”. Atividade, equipe e rascunho do fechamento permanecem vinculados à jornada.'}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Etapa</strong> é o planejamento. <strong>OP</strong> é a
            autorização de execução. <strong>Apontamento</strong> registra o que
            foi realmente feito dentro da OP. Atividade avulsa deve ser usada
            somente para trabalho não planejado.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Data *</Label>
          <Input
            type="date"
            value={data}
            onChange={(event) => setData(event.target.value)}
            disabled={!podeApontar || Boolean(jornadaContexto)}
          />
        </div>

        <div className="space-y-2">
          <Label>Ordem de Produção *</Label>
          <Select
            value={origem}
            onValueChange={setOrigem}
            disabled={!podeApontar || Boolean(jornadaContexto)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a OP em execução" />
            </SelectTrigger>
            <SelectContent>
              {ordensDisponiveis.map((ordem) => (
                <SelectItem key={ordem.id} value={ordem.id}>
                  {formatarIdentificacaoOrdemProducao(ordem)} ·{' '}
                  {ordem.processo_nome} · {ordem.projeto_nome}
                </SelectItem>
              ))}
              {!jornadaContexto && (
                <SelectItem value={ORIGEM_AVULSA}>
                  Atividade não planejada — sem OP
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {ordensDisponiveis.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhuma OP está liberada ou em execução. Emita a OP dentro da
              Etapa.
            </p>
          )}
        </div>

        {ordemSelecionada ? (
          <div className="rounded-lg border bg-muted/20 p-4 text-sm md:col-span-2">
            <p>
              <strong>
                {formatarIdentificacaoOrdemProducao(ordemSelecionada)}
              </strong>{' '}
              ·{' '}
              {ordemSelecionada.status === 'liberada'
                ? 'Liberada'
                : 'Em execução'}
            </p>
            <p>
              <strong>Projeto:</strong> {ordemSelecionada.projeto_nome}
            </p>
            <p>
              <strong>Etapa:</strong> {ordemSelecionada.processo_codigo} ·{' '}
              {ordemSelecionada.processo_nome}
            </p>
            <p>
              <strong>Atividade da OP:</strong>{' '}
              {ordemSelecionada.tarefa_nome_snapshot ?? 'Não informada'}
            </p>
            <p>
              <strong>Local:</strong> {ordemSelecionada.local_tipo}
            </p>
            {ordemSelecionada.responsavel_nome_snapshot && (
              <p>
                <strong>Responsável:</strong>{' '}
                {ordemSelecionada.responsavel_nome_snapshot}
              </p>
            )}
            <p>
              <strong>Progresso:</strong>{' '}
              {ordemSelecionada.quantidade_realizada} de{' '}
              {ordemSelecionada.quantidade_planejada}{' '}
              {ordemSelecionada.unidade_medida ?? ''} (
              {ordemSelecionada.percentual_realizado}%)
            </p>
            {ordemSelecionada.descricao && (
              <p>
                <strong>Descrição:</strong> {ordemSelecionada.descricao}
              </p>
            )}
            {ordemSelecionada.instrucoes && (
              <p>
                <strong>Instruções:</strong> {ordemSelecionada.instrucoes}
              </p>
            )}
          </div>
        ) : avulso ? (
          <>
            <div className="space-y-2">
              <Label>Projeto/local da atividade avulsa *</Label>
              <Select
                value={projetoLocalId}
                onValueChange={setProjetoLocalId}
                disabled={!podeApontar}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o projeto/local" />
                </SelectTrigger>
                <SelectContent>
                  {locais
                    .filter((local) => local.ativo)
                    .map((local) => (
                      <SelectItem key={local.id} value={local.id}>
                        {local.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Local de execução *</Label>
              <div className="flex gap-2">
                {(['Fábrica', 'Execução'] as ProducaoLocalTipo[]).map(
                  (tipo) => (
                    <Button
                      key={tipo}
                      type="button"
                      variant={localTipo === tipo ? 'default' : 'outline'}
                      onClick={() => setLocalTipo(tipo)}
                      disabled={!podeApontar}
                    >
                      {tipo}
                    </Button>
                  ),
                )}
              </div>
            </div>
          </>
        ) : null}

        <div className="space-y-2 md:col-span-2">
          <Label>Atividade executada *</Label>
          <Select
            value={tarefaId}
            onValueChange={setTarefaId}
            disabled={!podeApontar || Boolean(jornadaContexto && tarefaId)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione corte, montagem, acabamento..." />
            </SelectTrigger>
            <SelectContent>
              {tarefas
                .filter((tarefa) => tarefa.ativo)
                .map((tarefa) => (
                  <SelectItem key={tarefa.id} value={tarefa.id}>
                    {tarefa.nome}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {jornadaContexto && tarefaId && (
            <p className="text-xs text-muted-foreground">
              Atividade herdada da OP e mantida nesta jornada.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Início *</Label>
          <div className="flex gap-2">
            <Input
              type="time"
              value={inicio}
              onChange={(event) => setInicio(event.target.value)}
              disabled={Boolean(jornadaContexto)}
            />
            {!jornadaContexto && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setInicio(horaAtual())}
              >
                <Clock className="mr-2 h-4 w-4" />
                Agora
              </Button>
            )}
          </div>
          {jornadaContexto && (
            <p className="text-xs text-muted-foreground">
              Capturado automaticamente no início do trabalho.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Término real *</Label>
          <div className="flex gap-2">
            <Input
              type="time"
              value={termino}
              onChange={(event) => setTermino(event.target.value)}
            />
            {!fechamentoRetroativo && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setTermino(horaAtual())}
              >
                <Clock className="mr-2 h-4 w-4" />
                Agora
              </Button>
            )}
          </div>
          {fechamentoRetroativo && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Informe o horário em que o serviço realmente terminou no dia{' '}
              {new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR')}.
            </p>
          )}
        </div>
      </div>

      {duracao && (
        <p className="rounded-md border bg-muted/20 p-3 text-sm">
          Duração calculada: <strong>{duracao} minutos</strong>
        </p>
      )}

      {fechamentoRetroativo && (
        <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="space-y-2">
            <Label>Motivo do fechamento retroativo *</Label>
            <Select
              value={motivoRegularizacao}
              onValueChange={setMotivoRegularizacao}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS_REGULARIZACAO.map((motivo) => (
                  <SelectItem key={motivo} value={motivo}>
                    {motivo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {motivoRegularizacao === 'Outro' && (
            <div className="space-y-2">
              <Label>Descreva o motivo *</Label>
              <Input
                value={motivoRegularizacaoOutro}
                onChange={(event) =>
                  setMotivoRegularizacaoOutro(event.target.value)
                }
              />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            A ocorrência ficará marcada no Histórico com quem regularizou,
            quando regularizou e o motivo informado.
          </p>
        </div>
      )}

      {opDePintura && (
        <div className="space-y-4 rounded-lg border-2 border-lime-400 bg-lime-300/10 p-4 shadow-lg shadow-lime-400/20">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-base font-bold">Consumo de tinta</Label>
              <span className="rounded-full bg-lime-400 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-black">
                OP de pintura
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Informe o valor de tinta unitário usado em uma peça. Este campo é
              obrigatório. O sistema multiplica automaticamente o valor informado
              pela quantidade de peças produzidas neste apontamento.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Demão deste apontamento *</Label>
            <Select
              value={demaoNumero}
              onValueChange={setDemaoNumero}
              disabled={carregandoDemao || proximaDemao == null}
            >
              <SelectTrigger><SelectValue placeholder="Selecione a demão" /></SelectTrigger>
              <SelectContent>
                {(proximaDemao == null
                  ? []
                  : Array.from({ length: 8 }, (_, i) => proximaDemao + i)
                ).map((numero) => (
                  <SelectItem
                    key={numero}
                    value={String(numero)}
                    disabled={proximaDemao != null && numero !== proximaDemao}
                  >
                    {numero}ª demão{numero === proximaDemao ? ' — próxima obrigatória' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Demãos já concluídas não aparecem novamente. Após fechar a demão atual,
              o próximo apontamento avança automaticamente para a seguinte.
            </p>
          </div>

          <div className="space-y-3">
            {consumosTinta.map((consumo, indice) => (
              <div
                key={indice}
                className="grid gap-3 rounded-md border border-lime-400/50 bg-background/70 p-3 sm:grid-cols-[1fr_180px_auto] sm:items-end"
              >
                <div className="space-y-1.5">
                  <Label className="text-xs">Tinta / cor</Label>
                  <Input
                    value={consumo.cor}
                    onChange={(event) =>
                      setConsumosTinta((atuais) =>
                        atuais.map((item, i) =>
                          i === indice ? { ...item, cor: event.target.value } : item,
                        ),
                      )
                    }
                    placeholder="Ex.: Branco"
                    maxLength={120}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Valor de tinta unitário por peça (mL) *
                  </Label>
                  <Input
                    inputMode="decimal"
                    value={consumo.quantidadeUnitariaMl}
                    onChange={(event) =>
                      setConsumosTinta((atuais) =>
                        atuais.map((item, i) =>
                          i === indice
                            ? {
                                ...item,
                                quantidadeUnitariaMl: event.target.value,
                              }
                            : item,
                        ),
                      )
                    }
                    placeholder="35"
                    required
                  />
                  {(() => {
                    const unitario = Number(
                      consumo.quantidadeUnitariaMl.replace(',', '.'),
                    );
                    const pecas = quantidade.trim()
                      ? Number(quantidade.replace(',', '.'))
                      : 0;
                    if (
                      !Number.isFinite(unitario) ||
                      unitario <= 0 ||
                      !Number.isFinite(pecas) ||
                      pecas <= 0
                    ) {
                      return null;
                    }
                    return (
                      <p className="text-[11px] font-medium text-lime-700 dark:text-lime-300">
                        Total calculado: {new Intl.NumberFormat('pt-BR', {
                          maximumFractionDigits: 2,
                        }).format(unitario * pecas)} mL ={' '}
                        {new Intl.NumberFormat('pt-BR', {
                          maximumFractionDigits: 2,
                        }).format(unitario)} mL ×{' '}
                        {new Intl.NumberFormat('pt-BR', {
                          maximumFractionDigits: 2,
                        }).format(pecas)} peça(s)
                      </p>
                    );
                  })()}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Remover consumo"
                  disabled={consumosTinta.length === 1}
                  onClick={() =>
                    setConsumosTinta((atuais) =>
                      atuais.filter((_, i) => i !== indice),
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setConsumosTinta((atuais) => [...atuais, consumoTintaVazio()])
            }
          >
            + Adicionar outro consumo
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>
            {opDePintura ? 'Quantidade produzida (peças) *' : 'Quantidade produzida'}
          </Label>
          <Input
            inputMode="decimal"
            value={quantidade}
            onChange={(event) => setQuantidade(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Minutos improdutivos</Label>
          <Input
            inputMode="numeric"
            value={minutosImprodutivos}
            onChange={(event) => setMinutosImprodutivos(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Motivo improdutivo</Label>
          <Input
            value={motivoImprodutivo}
            onChange={(event) => setMotivoImprodutivo(event.target.value)}
            disabled={Number(minutosImprodutivos || 0) === 0}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label>Equipe *</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            {jornadaContexto && membrosIds.length > 0
              ? 'Equipe recuperada do contexto desta OP. Ajuste somente se alguém entrou ou saiu.'
              : 'Todos herdam o horário geral. Ajuste somente quem entrou depois ou saiu antes.'}
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            value={buscaMembro}
            onChange={(event) => setBuscaMembro(event.target.value)}
            placeholder="Buscar membro"
          />
        </div>

        {buscaMembro.trim() && (
          <div className="max-h-40 overflow-y-auto rounded-md border p-1">
            {membrosFiltrados.map((membro) => (
              <button
                key={membro.id}
                type="button"
                className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  setMembrosIds((atuais) => [
                    ...new Set([...atuais, membro.id]),
                  ]);
                  setBuscaMembro('');
                }}
              >
                {membro.nome}
                {membro.funcao ? ` · ${membro.funcao}` : ''}
              </button>
            ))}
          </div>
        )}

        {membrosIds.length > 0 && (
          <div className="space-y-2">
            {membrosIds.map((id) => {
              const membro = membros.find((item) => item.id === id);
              const ajuste = horariosMembros[id];
              const inicioEfetivo = ajuste?.inicio || inicio || '--:--';
              const terminoEfetivo = ajuste?.termino || termino || '--:--';
              const personalizado = Boolean(
                ajuste &&
                  (ajuste.inicio !== inicio ||
                    ajuste.termino !== termino),
              );
              const aberto = membroHorarioAberto === id;

              return (
                <div
                  key={id}
                  className="rounded-lg border bg-muted/10 p-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {membro?.nome ?? id}
                        </span>
                        {personalizado && (
                          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                            Horário personalizado
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {inicioEfetivo} → {terminoEfetivo}
                        {personalizado ? '' : ' · horário geral'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setMembroHorarioAberto((atual) =>
                            atual === id ? null : id,
                          )
                        }
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        Ajustar horário
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removerMembro(id)}
                      >
                        Remover
                      </Button>
                    </div>
                  </div>

                  {aberto && (
                    <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          Início individual
                        </Label>
                        <Input
                          type="time"
                          value={ajuste?.inicio ?? inicio}
                          onChange={(event) =>
                            atualizarHorarioMembro(
                              id,
                              'inicio',
                              event.target.value,
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          Término individual
                        </Label>
                        <Input
                          type="time"
                          value={ajuste?.termino ?? termino}
                          onChange={(event) =>
                            atualizarHorarioMembro(
                              id,
                              'termino',
                              event.target.value,
                            )
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => usarHorarioGeral(id)}
                        disabled={!ajuste}
                      >
                        Usar horário geral
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <Label>Evidências fotográficas</Label>
            <p className="text-xs text-muted-foreground">
              JPEG, PNG ou WebP, até 10 MB por foto.
            </p>
          </div>
          <input
            ref={inputFotosRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(event) => selecionarFotos(event.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputFotosRef.current?.click()}
            disabled={!podeApontar}
          >
            <Camera className="mr-2 h-4 w-4" />
            Adicionar fotos
          </Button>
        </div>

        {fotos.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md bg-muted/20 p-3 text-sm text-muted-foreground">
            <Upload className="h-4 w-4" />
            Nenhuma foto selecionada.
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {fotos.map((foto, indice) => (
              <div
                key={`${foto.name}-${foto.size}-${foto.lastModified}`}
                className="flex items-center justify-between gap-2 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{foto.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(foto.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  title="Remover foto"
                  onClick={() =>
                    setFotos((atuais) =>
                      atuais.filter((_, i) => i !== indice),
                    )
                  }
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {jornadaContexto?.concluirOp && (
        <div className="space-y-2 rounded-lg border bg-muted/10 p-4">
          <Label>
            Justificativa caso a quantidade final fique abaixo do planejado
          </Label>
          <Textarea
            value={justificativaConclusao}
            onChange={(event) =>
              setJustificativaConclusao(event.target.value)
            }
            rows={2}
            placeholder="Preencha somente se a OP for concluída com produção parcial."
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea
          value={observacoes}
          onChange={(event) => setObservacoes(event.target.value)}
          rows={4}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={!podeApontar || salvando}>
          {salvando
            ? 'Salvando apontamento e fotos...'
            : jornadaContexto?.concluirOp
              ? 'Salvar apontamento e concluir OP'
              : jornadaContexto
                ? 'Encerrar trabalho e salvar apontamento'
                : 'Salvar como pendente'}
        </Button>
      </div>
    </form>
  );
};
