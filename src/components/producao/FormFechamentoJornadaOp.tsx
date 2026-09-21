import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Camera, Clock, Info, Search, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatarNumeroOrdemProducao, ordemProducaoEDePintura } from '@/hooks/useOrdensProducao';
import { calcularDuracaoProducao } from '@/hooks/useProducao';
import { useProducaoAnexos } from '@/hooks/useProducaoAnexos';
import { supabase } from '@/integrations/supabase/client';
import { descartarJornadaOp } from '@/services/producao/descartarJornadaOp';
import {
  ajustarInicioJornadaOp,
  finalizarJornadaOp,
  obterJornadaOpAberta,
  salvarContextoJornadaOp,
  type ContextoFechamentoJornadaOp,
} from '@/services/producao/jornadasOrdemProducao';
import type {
  HorarioMembroApontamento,
  ProducaoMembro,
  ProducaoTarefa,
} from '@/types/producao';

interface Props {
  tarefas: ProducaoTarefa[];
  membros: ProducaoMembro[];
  podeApontar: boolean;
  jornadaContexto: ContextoFechamentoJornadaOp;
  onJornadaFinalizada?: () => Promise<unknown> | unknown;
}

type HorarioPersonalizado = { inicio: string; termino: string };

type OrdemContexto = {
  id: string;
  numero: number | null;
  tarefa_id: string | null;
  tarefa_nome_snapshot: string | null;
  descricao: string | null;
  processo_id: string | null;
  local_tipo: string | null;
  quantidade_planejada: number | null;
  quantidade_realizada: number | null;
  unidade_medida: string | null;
  responsavel_id: string | null;
  responsavel_nome_snapshot: string | null;
};

const dataLocal = (valor = new Date()) => {
  const ano = valor.getFullYear();
  const mes = String(valor.getMonth() + 1).padStart(2, '0');
  const dia = String(valor.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
};

const horaLocal = (valor = new Date()) =>
  `${String(valor.getHours()).padStart(2, '0')}:${String(valor.getMinutes()).padStart(2, '0')}`;

const normalizarHora = (valor: string | null | undefined) => valor ? valor.slice(0, 5) : '';
const hoje = () => dataLocal();
const horaAtual = () => horaLocal();
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];
const TAMANHO_MAXIMO = 10 * 1024 * 1024;
const MOTIVOS_REGULARIZACAO = [
  'Esquecimento de fechamento',
  'Falha de internet/sistema',
  'Apontador indisponível',
  'Horário informado posteriormente pela equipe',
  'Correção de lançamento',
  'Outro',
];

export const FormFechamentoJornadaOp = ({
  tarefas,
  membros,
  podeApontar,
  jornadaContexto,
  onJornadaFinalizada,
}: Props) => {
  const [ordem, setOrdem] = useState<OrdemContexto | null>(null);
  const [carregandoOrdem, setCarregandoOrdem] = useState(true);
  const [data, setData] = useState('');
  const [dataOriginal, setDataOriginal] = useState('');
  const [tarefaId, setTarefaId] = useState('');
  const [inicio, setInicio] = useState('');
  const [inicioOriginal, setInicioOriginal] = useState('');
  const [motivoAjusteInicio, setMotivoAjusteInicio] = useState('');
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
  const [descartando, setDescartando] = useState(false);
  const [contextoPronto, setContextoPronto] = useState(false);
  const [motivoRegularizacao, setMotivoRegularizacao] = useState('');
  const [motivoRegularizacaoOutro, setMotivoRegularizacaoOutro] = useState('');
  const [justificativaConclusao, setJustificativaConclusao] = useState('');
  const [demaoNumero, setDemaoNumero] = useState('');
  const [proximaDemao, setProximaDemao] = useState<number | null>(null);
  const [carregandoDemao, setCarregandoDemao] = useState(false);
  const [tintaCor, setTintaCor] = useState('');
  const [tintaUnitarioMl, setTintaUnitarioMl] = useState('');
  const inputFotosRef = useRef<HTMLInputElement>(null);
  const { anexarImagem } = useProducaoAnexos();

  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      setCarregandoOrdem(true);
      const { data: registros, error } = await (supabase.rpc as any)('listar_ordens_producao_v2', {
        p_processo_id: null,
        p_status: null,
      });
      if (!ativo) return;
      if (error) {
        toast.error('Não foi possível carregar a identificação visual da OP.');
        setOrdem(null);
      } else {
        const registro = (registros ?? []).find(
          (item: any) => String(item.id) === jornadaContexto.ordemProducaoId,
        );
        setOrdem((registro ?? null) as OrdemContexto | null);
      }
      setCarregandoOrdem(false);
    };
    void carregar();
    return () => { ativo = false; };
  }, [jornadaContexto.ordemProducaoId]);

  useEffect(() => {
    let ativo = true;
    const aplicar = async () => {
      let iniciadoEm = jornadaContexto.iniciadoEm;
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
          iniciadoEm = atual.iniciado_em;
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
        // O contexto recebido do card continua como fallback.
      }

      if (!ativo) return;
      const iniciado = new Date(iniciadoEm);
      const dataInicio = dataLocal(iniciado);
      const horaInicio = horaLocal(iniciado);
      const motivoConhecido = motivoRegularizacaoSalvo
        ? MOTIVOS_REGULARIZACAO.includes(motivoRegularizacaoSalvo)
        : false;

      setData(dataInicio);
      setDataOriginal(dataInicio);
      setInicio(horaInicio);
      setInicioOriginal(horaInicio);
      setMotivoAjusteInicio('');
      setTarefaId(tarefa ?? ordem?.tarefa_id ?? '');
      setMembrosIds([...new Set(equipe ?? [])]);
      setHorariosMembros(Object.fromEntries(
        (horarios ?? [])
          .filter((item) => item.membro_id)
          .map((item) => [item.membro_id, {
            inicio: normalizarHora(item.inicio),
            termino: normalizarHora(item.termino),
          }]),
      ));
      setTermino(normalizarHora(terminoSalvo) || (dataInicio < hoje() ? '' : horaAtual()));
      setQuantidade(quantidadeSalva == null ? '' : String(quantidadeSalva).replace('.', ','));
      setMinutosImprodutivos(improdutivosSalvos == null ? '0' : String(improdutivosSalvos));
      setMotivoImprodutivo(motivoImprodutivoSalvo ?? '');
      setObservacoes(observacoesSalvas ?? '');
      setMotivoRegularizacao(
        motivoRegularizacaoSalvo
          ? motivoConhecido ? motivoRegularizacaoSalvo : 'Outro'
          : '',
      );
      setMotivoRegularizacaoOutro(
        motivoRegularizacaoSalvo && !motivoConhecido ? motivoRegularizacaoSalvo : '',
      );
      setJustificativaConclusao(justificativaSalva ?? '');
      setContextoPronto(true);
    };

    setContextoPronto(false);
    void aplicar();
    return () => { ativo = false; };
  }, [jornadaContexto, ordem?.tarefa_id]);

  const fechamentoRetroativo = Boolean(data && data < hoje());
  const inicioAlterado = Boolean(
    dataOriginal && inicioOriginal && (data !== dataOriginal || inicio !== inicioOriginal),
  );
  const atividade = tarefas.find((tarefa) => tarefa.id === tarefaId) ?? null;
  const equipeDefinidaNoInicio = jornadaContexto.membrosIds.length > 0;
  const opDePintura = ordemProducaoEDePintura(ordem);

  useEffect(() => {
    if (!opDePintura || !ordem?.id) {
      setProximaDemao(null);
      setDemaoNumero('');
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
        { p_ordem_producao_id: ordem.id },
      );
      if (!ativo) return;
      if (error) {
        setProximaDemao(null);
        setDemaoNumero('');
        toast.error('Não foi possível identificar a próxima demão desta OP.');
        setCarregandoDemao(false);
        return;
      }

      const proxima = Number(data);
      if (!Number.isInteger(proxima) || proxima <= 0) {
        setProximaDemao(null);
        setDemaoNumero('');
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
  }, [opDePintura, ordem?.id]);

  const duracao = useMemo(() => {
    if (!inicio || !termino) return null;
    try { return calcularDuracaoProducao(inicio, termino); } catch { return null; }
  }, [inicio, termino]);

  const membrosFiltrados = useMemo(() => {
    const termo = buscaMembro.trim().toLocaleLowerCase('pt-BR');
    if (!termo) return [];
    return membros
      .filter((membro) => membro.ativo && !membrosIds.includes(membro.id))
      .filter((membro) => [membro.nome, membro.apelido, membro.funcao]
        .filter(Boolean)
        .some((valor) => String(valor).toLocaleLowerCase('pt-BR').includes(termo)))
      .slice(0, 8);
  }, [buscaMembro, membros, membrosIds]);

  const horariosPersonalizadosAtuais = useMemo<HorarioMembroApontamento[]>(
    () => membrosIds.flatMap((membroId) => {
      const ajuste = horariosMembros[membroId];
      if (!ajuste?.inicio || !ajuste?.termino) return [];
      if (ajuste.inicio === inicio && ajuste.termino === termino) return [];
      return [{ membro_id: membroId, inicio: ajuste.inicio, termino: ajuste.termino }];
    }),
    [horariosMembros, inicio, membrosIds, termino],
  );

  useEffect(() => {
    if (!contextoPronto || salvando || descartando) return;
    const quantidadeNumerica = quantidade.trim() ? Number(quantidade.replace(',', '.')) : null;
    const quantidadeRascunho = quantidadeNumerica !== null && Number.isFinite(quantidadeNumerica)
      ? quantidadeNumerica
      : null;
    const improdutivos = Number(minutosImprodutivos || 0);
    const motivoRetroativo = motivoRegularizacao === 'Outro'
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
        minutosImprodutivos: Number.isInteger(improdutivos) && improdutivos >= 0 ? improdutivos : 0,
        motivoImprodutivo: motivoImprodutivo.trim() || null,
        observacoes: observacoes.trim() || null,
        motivoRegularizacao: motivoRetroativo || null,
        justificativaConclusao: justificativaConclusao.trim() || null,
      }).catch(() => undefined);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [
    contextoPronto,
    descartando,
    horariosPersonalizadosAtuais,
    jornadaContexto.jornadaId,
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

  const removerMembro = (id: string) => {
    setMembrosIds((atuais) => atuais.filter((item) => item !== id));
    setHorariosMembros((atuais) => {
      const proximo = { ...atuais };
      delete proximo[id];
      return proximo;
    });
    setMembroHorarioAberto((atual) => atual === id ? null : atual);
  };

  const atualizarHorarioMembro = (id: string, campo: keyof HorarioPersonalizado, valor: string) => {
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
      const chaves = new Set(atuais.map((arquivo) => `${arquivo.name}-${arquivo.size}-${arquivo.lastModified}`));
      return [
        ...atuais,
        ...validas.filter((arquivo) => !chaves.has(`${arquivo.name}-${arquivo.size}-${arquivo.lastModified}`)),
      ];
    });
  };

  const descartar = async () => {
    const motivo = window.prompt(
      'Informe por que este apontamento aberto deve ser descartado. Nenhum histórico de produção será criado:',
    )?.trim();
    if (!motivo) return;
    setDescartando(true);
    try {
      await descartarJornadaOp(jornadaContexto.jornadaId, motivo);
      toast.success('Apontamento aberto descartado. A OP ficou livre para iniciar um novo apontamento.');
      await onJornadaFinalizada?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível descartar o apontamento aberto.');
    } finally {
      setDescartando(false);
    }
  };

  const salvar = async (event: FormEvent) => {
    event.preventDefault();
    if (!podeApontar) return;
    if (!jornadaContexto.ordemProducaoId) return toast.error('A jornada perdeu o vínculo com a Ordem de Produção.');
    if (!tarefaId) return toast.error('A OP não possui atividade válida para o apontamento.');
    if (!data || data > hoje()) return toast.error('Informe uma data válida para o apontamento.');
    if (!duracao) return toast.error('Informe horários válidos de início e término.');
    if (inicioAlterado && !motivoAjusteInicio.trim()) {
      return toast.error('Informe o motivo da correção da data ou do horário de início.');
    }
    if (membrosIds.length === 0) return toast.error('Selecione pelo menos um membro da equipe.');

    const horariosPersonalizados: HorarioMembroApontamento[] = [];
    for (const membroId of membrosIds) {
      const ajuste = horariosMembros[membroId];
      if (!ajuste) continue;
      if (!ajuste.inicio || !ajuste.termino) {
        const membro = membros.find((item) => item.id === membroId);
        return toast.error(`Informe início e término para ${membro?.nome ?? 'o integrante da equipe'}.`);
      }
      try { calcularDuracaoProducao(ajuste.inicio, ajuste.termino); } catch {
        const membro = membros.find((item) => item.id === membroId);
        return toast.error(`O horário individual de ${membro?.nome ?? 'um integrante'} é inválido.`);
      }
      if (ajuste.inicio < inicio || ajuste.termino > termino) {
        const membro = membros.find((item) => item.id === membroId);
        return toast.error(`O horário de ${membro?.nome ?? 'um integrante'} deve estar dentro do período geral do apontamento.`);
      }
      if (ajuste.inicio !== inicio || ajuste.termino !== termino) {
        horariosPersonalizados.push({ membro_id: membroId, inicio: ajuste.inicio, termino: ajuste.termino });
      }
    }

    const improdutivos = Number(minutosImprodutivos || 0);
    if (!Number.isInteger(improdutivos) || improdutivos < 0 || improdutivos > duracao) {
      return toast.error('O tempo improdutivo deve estar entre zero e a duração total.');
    }
    if (improdutivos > 0 && !motivoImprodutivo.trim()) return toast.error('Informe o motivo do tempo improdutivo.');

    const quantidadeNormalizada = quantidade.trim() ? Number(quantidade.replace(',', '.')) : null;
    if (quantidadeNormalizada !== null && (!Number.isFinite(quantidadeNormalizada) || quantidadeNormalizada < 0)) {
      return toast.error('Informe uma quantidade válida.');
    }

    let demaoValidada: number | null = null;
    if (opDePintura) {
      if (quantidadeNormalizada == null || quantidadeNormalizada <= 0) {
        return toast.error('Informe a quantidade de peças pintadas nesta demão.');
      }

      if (!ordem?.id) {
        return toast.error('Não foi possível identificar a OP para validar a demão.');
      }

      const { data: proximaAtual, error: erroDemao } = await (supabase.rpc as any)(
        'proxima_demao_pintura_v1',
        { p_ordem_producao_id: ordem.id },
      );
      if (erroDemao) {
        return toast.error('Não foi possível validar a demão desta OP. Atualize a tela e tente novamente.');
      }

      const esperada = Number(proximaAtual);
      if (!Number.isInteger(esperada) || esperada <= 0) {
        return toast.error('A sequência de demãos desta OP está inconsistente.');
      }

      setProximaDemao(esperada);
      if (!demaoNumero) setDemaoNumero(String(esperada));

      const informada = demaoNumero ? Number(demaoNumero) : esperada;
      if (informada !== esperada) {
        setDemaoNumero(String(esperada));
        return toast.error(`A demão selecionada já não é válida. A próxima demão desta OP é a ${esperada}ª.`);
      }
      demaoValidada = esperada;

      const tintaUnitario = Number(tintaUnitarioMl.replace(',', '.'));
      if (!Number.isFinite(tintaUnitario) || tintaUnitario <= 0) {
        return toast.error('Informe o valor de tinta unitário por peça em mL.');
      }
    }

    const motivoRetroativo = motivoRegularizacao === 'Outro'
      ? motivoRegularizacaoOutro.trim()
      : motivoRegularizacao.trim();
    if (fechamentoRetroativo && !motivoRetroativo) return toast.error('Informe o motivo do fechamento retroativo.');

    setSalvando(true);
    try {
      if (inicioAlterado) {
        await ajustarInicioJornadaOp({
          jornadaId: jornadaContexto.jornadaId,
          data,
          inicio,
          motivo: motivoAjusteInicio.trim(),
        });
      }

      const apontamento = await finalizarJornadaOp({
        jornadaId: jornadaContexto.jornadaId,
        tarefaId,
        quantidadeProduzida: quantidadeNormalizada,
        termino,
        minutosImprodutivos: improdutivos,
        motivoImprodutivo: improdutivos > 0 ? motivoImprodutivo.trim() : null,
        observacoes: observacoes.trim() || null,
        membrosIds,
        horariosMembros: horariosPersonalizados,
        concluirOp: jornadaContexto.concluirOp,
        motivoRegularizacao: fechamentoRetroativo ? motivoRetroativo : null,
        justificativaConclusao: justificativaConclusao.trim() || null,
        consumosTinta: opDePintura
          ? [{
              cor: tintaCor.trim() || null,
              quantidade_unitaria_ml: Number(tintaUnitarioMl.replace(',', '.')),
            }]
          : [],
        demaoNumero: opDePintura ? demaoValidada : null,
      });

      let falhas = 0;
      for (const foto of fotos) {
        try { await anexarImagem(apontamento.id, foto); } catch { falhas += 1; }
      }

      const identificacao = ordem ? formatarNumeroOrdemProducao(ordem.numero) : 'OP vinculada';
      if (falhas > 0) {
        toast.warning(`Apontamento salvo dentro da ${identificacao}, mas ${falhas} foto(s) não foram enviadas.`);
      } else if (jornadaContexto.concluirOp) {
        toast.success(`Apontamento salvo e ${identificacao} concluída.`);
      } else {
        toast.success(`Apontamento encerrado dentro da ${identificacao}. A OP ficou livre para o próximo apontamento.`);
      }
      await onJornadaFinalizada?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível encerrar o apontamento desta OP.');
    } finally {
      setSalvando(false);
    }
  };

  const numeroOp = ordem ? formatarNumeroOrdemProducao(ordem.numero) : 'OP vinculada';
  const nomeAtividade = atividade?.nome ?? ordem?.tarefa_nome_snapshot ?? 'Atividade vinculada à OP';

  return (
    <form onSubmit={salvar} className="space-y-6 rounded-lg border bg-card p-5">
      <div>
        <h3 className="text-lg font-semibold">
          {jornadaContexto.concluirOp ? 'Concluir OP e registrar apontamento' : 'Encerrar apontamento'}
        </h3>
        <p className="text-sm text-muted-foreground">
          Você está editando o apontamento atualmente aberto desta OP. Os apontamentos já encerrados não são alterados aqui.
        </p>
      </div>

      <Alert className={fechamentoRetroativo ? 'border-amber-500/40 bg-amber-500/5' : ''}>
        {fechamentoRetroativo ? <AlertTriangle className="h-4 w-4 text-amber-500" /> : <Info className="h-4 w-4" />}
        <AlertDescription>
          {fechamentoRetroativo
            ? 'Este apontamento aberto começou em data anterior. Se ele já foi encerrado e existe no histórico, descarte este apontamento aberto em vez de criar outro. Se realmente ficou aberto de um dia para o outro, informe o término real e o motivo.'
            : 'Data, início, término, equipe e demais dados pertencem somente a este apontamento. A OP permanece a mesma.'}
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Ordem de Produção</Label>
          <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm font-medium">
            {carregandoOrdem ? 'Carregando identificação...' : numeroOp}
          </div>
          {!carregandoOrdem && !ordem && (
            <p className="text-xs text-destructive">A OP continua vinculada internamente, mas a identificação visual não pôde ser carregada.</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Atividade da OP</Label>
          {tarefaId ? (
            <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">{nomeAtividade}</div>
          ) : (
            <Select value={tarefaId} onValueChange={setTarefaId} disabled={!podeApontar}>
              <SelectTrigger><SelectValue placeholder="Selecione a atividade" /></SelectTrigger>
              <SelectContent>
                {tarefas.filter((tarefa) => tarefa.ativo).map((tarefa) => (
                  <SelectItem key={tarefa.id} value={tarefa.id}>{tarefa.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Data do apontamento *</Label>
          <Input type="date" value={data} max={hoje()} onChange={(e) => setData(e.target.value)} disabled={!podeApontar} />
        </div>
        <div className="space-y-2">
          <Label>Início *</Label>
          <Input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} disabled={!podeApontar} />
        </div>
        <div className="space-y-2">
          <Label>Término real *</Label>
          <div className="flex gap-2">
            <Input type="time" value={termino} onChange={(e) => setTermino(e.target.value)} disabled={!podeApontar} />
            {!fechamentoRetroativo && (
              <Button type="button" variant="outline" onClick={() => setTermino(horaAtual())}>
                <Clock className="mr-2 h-4 w-4" /> Agora
              </Button>
            )}
          </div>
        </div>
      </div>

      {inicioAlterado && (
        <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <Label>Motivo da correção da data/início *</Label>
          <Input
            value={motivoAjusteInicio}
            onChange={(e) => setMotivoAjusteInicio(e.target.value)}
            placeholder={`Original: ${dataOriginal} ${inicioOriginal}`}
          />
          <p className="text-xs text-muted-foreground">A correção fica registrada com horário original, novo horário, usuário e justificativa.</p>
        </div>
      )}

      {duracao && (
        <p className="rounded-md border bg-muted/20 p-3 text-sm">Duração calculada: <strong>{duracao} minutos</strong></p>
      )}

      {fechamentoRetroativo && (
        <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="space-y-2">
            <Label>Motivo do fechamento retroativo *</Label>
            <Select value={motivoRegularizacao} onValueChange={setMotivoRegularizacao}>
              <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
              <SelectContent>
                {MOTIVOS_REGULARIZACAO.map((motivo) => <SelectItem key={motivo} value={motivo}>{motivo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {motivoRegularizacao === 'Outro' && (
            <div className="space-y-2">
              <Label>Descreva o motivo *</Label>
              <Input value={motivoRegularizacaoOutro} onChange={(e) => setMotivoRegularizacaoOutro(e.target.value)} />
            </div>
          )}
        </div>
      )}

      {opDePintura && (
        <div className="space-y-4 rounded-lg border-2 border-lime-400 bg-lime-300/10 p-4">
          <div>
            <p className="font-semibold">Controle de pintura por demão</p>
            <p className="text-xs text-muted-foreground">
              Cada apontamento representa uma demão. A quantidade de peças pode se repetir nas demãos seguintes.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Demão deste apontamento *</Label>
              <Select
              value={demaoNumero}
              onValueChange={setDemaoNumero}
              disabled={carregandoDemao || proximaDemao == null}
            >
                <SelectTrigger>
                  <SelectValue
                    placeholder={carregandoDemao ? 'Carregando próxima demão...' : 'Selecione a demão'}
                  />
                </SelectTrigger>
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
            <div className="space-y-2">
              <Label>Tinta / cor</Label>
              <Input value={tintaCor} onChange={(e) => setTintaCor(e.target.value)} placeholder="Ex.: Branco" />
            </div>
            <div className="space-y-2">
              <Label>Valor de tinta unitário por peça (mL) *</Label>
              <Input inputMode="decimal" value={tintaUnitarioMl} onChange={(e) => setTintaUnitarioMl(e.target.value)} placeholder="35" />
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>{opDePintura ? 'Quantidade de peças pintadas nesta demão *' : 'Quantidade produzida'}</Label>
          <Input inputMode="decimal" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Minutos improdutivos</Label>
          <Input inputMode="numeric" value={minutosImprodutivos} onChange={(e) => setMinutosImprodutivos(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Motivo improdutivo</Label>
          <Input value={motivoImprodutivo} onChange={(e) => setMotivoImprodutivo(e.target.value)} disabled={Number(minutosImprodutivos || 0) === 0} />
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label>Equipe *</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            {equipeDefinidaNoInicio
              ? 'Equipe reservada no início desta execução. Os integrantes ficam indisponíveis para outras OPs até o encerramento deste apontamento.'
              : 'Este é um apontamento legado sem equipe reservada no início. Selecione a equipe para concluir o registro.'}
          </p>
        </div>
        {!equipeDefinidaNoInicio && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" value={buscaMembro} onChange={(e) => setBuscaMembro(e.target.value)} placeholder="Buscar membro" />
            </div>
            {buscaMembro.trim() && (
              <div className="max-h-40 overflow-y-auto rounded-md border p-1">
                {membrosFiltrados.map((membro) => (
                  <button
                    key={membro.id}
                    type="button"
                    className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => {
                      setMembrosIds((atuais) => [...new Set([...atuais, membro.id])]);
                      setBuscaMembro('');
                    }}
                  >
                    {membro.nome}{membro.funcao ? ` · ${membro.funcao}` : ''}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {membrosIds.length > 0 && (
          <div className="space-y-2">
            {membrosIds.map((id) => {
              const membro = membros.find((item) => item.id === id);
              const ajuste = horariosMembros[id];
              const inicioEfetivo = ajuste?.inicio || inicio || '--:--';
              const terminoEfetivo = ajuste?.termino || termino || '--:--';
              const personalizado = Boolean(ajuste && (ajuste.inicio !== inicio || ajuste.termino !== termino));
              const aberto = membroHorarioAberto === id;
              return (
                <div key={id} className="rounded-lg border bg-muted/10 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{membro?.nome ?? id}</span>
                        {personalizado && <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600">Horário personalizado</span>}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{inicioEfetivo} → {terminoEfetivo}{personalizado ? '' : ' · horário geral'}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => setMembroHorarioAberto((atual) => atual === id ? null : id)}>
                        <Clock className="mr-2 h-4 w-4" /> Ajustar horário
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => removerMembro(id)}>Remover</Button>
                    </div>
                  </div>
                  {aberto && (
                    <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Início individual</Label>
                        <Input type="time" value={ajuste?.inicio ?? inicio} onChange={(e) => atualizarHorarioMembro(id, 'inicio', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Término individual</Label>
                        <Input type="time" value={ajuste?.termino ?? termino} onChange={(e) => atualizarHorarioMembro(id, 'termino', e.target.value)} />
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => usarHorarioGeral(id)} disabled={!ajuste}>Usar horário geral</Button>
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
            <p className="text-xs text-muted-foreground">JPEG, PNG ou WebP, até 10 MB por foto.</p>
          </div>
          <input ref={inputFotosRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => selecionarFotos(e.target.files)} />
          <Button type="button" variant="outline" onClick={() => inputFotosRef.current?.click()} disabled={!podeApontar}>
            <Camera className="mr-2 h-4 w-4" /> Adicionar fotos
          </Button>
        </div>
        {fotos.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md bg-muted/20 p-3 text-sm text-muted-foreground"><Upload className="h-4 w-4" /> Nenhuma foto selecionada.</div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {fotos.map((foto, indice) => (
              <div key={`${foto.name}-${foto.size}-${foto.lastModified}`} className="flex items-center justify-between gap-2 rounded-md border p-3">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{foto.name}</p><p className="text-xs text-muted-foreground">{(foto.size / 1024 / 1024).toFixed(2)} MB</p></div>
                <Button type="button" size="icon" variant="ghost" title="Remover foto" onClick={() => setFotos((atuais) => atuais.filter((_, i) => i !== indice))}><Trash2 className="h-4 w-4 text-red-500" /></Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {jornadaContexto.concluirOp && (
        <div className="space-y-2 rounded-lg border bg-muted/10 p-4">
          <Label>Justificativa caso a quantidade final fique abaixo do planejado</Label>
          <Textarea value={justificativaConclusao} onChange={(e) => setJustificativaConclusao(e.target.value)} rows={2} placeholder="Preencha somente se a OP for concluída com produção parcial." />
        </div>
      )}

      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={4} />
      </div>

      <div className="flex flex-col-reverse justify-between gap-2 sm:flex-row">
        <Button type="button" variant="outline" className="text-destructive" disabled={!podeApontar || salvando || descartando} onClick={() => void descartar()}>
          {descartando ? 'Descartando...' : 'Descartar apontamento aberto'}
        </Button>
        <Button type="submit" disabled={!podeApontar || salvando || descartando}>
          {salvando
            ? 'Salvando apontamento e fotos...'
            : jornadaContexto.concluirOp
              ? 'Salvar apontamento e concluir OP'
              : 'Encerrar apontamento e salvar'}
        </Button>
      </div>
    </form>
  );
};
