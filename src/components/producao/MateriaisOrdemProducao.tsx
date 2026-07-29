import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  PackageCheck,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useEstoqueContext } from '@/contexts/EstoqueContext';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import {
  type MaterialOrdemProducao,
  type SolicitacaoMaterialOPResumo,
  useMateriaisProducao,
} from '@/hooks/useMateriaisProducao';
import { usePermissions } from '@/hooks/usePermissions';
import type { ProducaoOrdemProducao } from '@/types/producao';

interface Props {
  ordem: ProducaoOrdemProducao;
}

const statusLabel: Record<string, string> = {
  pendente: 'Pendente de análise',
  aprovada: 'Aprovada',
  rejeitada: 'Rejeitada',
  convertida: 'Convertida em retirada',
};

const statusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (status === 'aprovada' || status === 'convertida') return 'default';
  if (status === 'rejeitada') return 'destructive';
  return 'secondary';
};

const formatarQuantidade = (valor: number) =>
  valor.toLocaleString('pt-BR', { maximumFractionDigits: 4 });

const formatarDataHora = (valor: string | null | undefined) => {
  if (!valor) return '—';
  return new Date(valor).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const MateriaisOrdemProducao = ({ ordem }: Props) => {
  const [materiais, setMateriais] = useState<MaterialOrdemProducao[]>([]);
  const [solicitacao, setSolicitacao] = useState<SolicitacaoMaterialOPResumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const { obterEstoque } = useEstoqueContext();
  const { obterEstoqueAtivoInfo } = useConfiguracoes();
  const { canConfigurarProducao } = usePermissions();
  const { listarMateriaisOrdem, gerarSolicitacaoMaterial } = useMateriaisProducao();

  const itensEstoque = obterEstoque();
  const estoqueAtivo = obterEstoqueAtivoInfo();
  const opAberta = ordem.status === 'liberada' || ordem.status === 'em_execucao';
  const podeGerar = canConfigurarProducao() && opAberta && !solicitacao && materiais.length > 0;

  const totalItens = materiais.length;
  const itensSemSaldo = useMemo(() => materiais.filter((material) => {
    const item = itensEstoque.find((estoque) => estoque.id === material.item_id);
    return !item || item.estoqueAtual < material.quantidade_planejada;
  }).length, [itensEstoque, materiais]);

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resultado = await listarMateriaisOrdem(ordem.id);
      setMateriais(resultado.materiais);
      setSolicitacao(resultado.solicitacao);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Não foi possível carregar os materiais da OP.';
      setErro(mensagem);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  // A OP é a unidade do carregamento; o hook possui funções estáveis.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordem.id]);

  const confirmarGeracao = async () => {
    if (!estoqueAtivo?.id) {
      toast.error('Selecione o estoque que atenderá a solicitação no cabeçalho do sistema.');
      return;
    }

    setGerando(true);
    try {
      const criada = await gerarSolicitacaoMaterial(ordem.id, estoqueAtivo.id);
      setSolicitacao(criada);
      setMateriais((atuais) => atuais.map((material) => ({
        ...material,
        quantidade_solicitada: material.quantidade_planejada,
        solicitacao_material_id: criada.id,
      })));
      setConfirmacaoAberta(false);
      toast.success(
        criada.ja_existia
          ? `A Solicitação de Material #${criada.numero} já estava vinculada à OP.`
          : `Solicitação de Material #${criada.numero} enviada ao Almoxarifado. Prazo máximo de separação: 1 dia.`,
        { duration: 7000 },
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível gerar a Solicitação de Material.');
    } finally {
      setGerando(false);
    }
  };

  if (carregando) {
    return (
      <div className="mt-3 flex items-center rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Carregando materiais da OP...
      </div>
    );
  }

  if (erro) {
    return (
      <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
        {erro}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3 border-t pt-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold">Materiais da OP</p>
          <p className="text-xs text-muted-foreground">
            Snapshot proporcional do PCP salvo na Etapa.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{totalItens} item(ns)</Badge>
          {itensSemSaldo > 0 && <Badge variant="destructive">{itensSemSaldo} com saldo insuficiente</Badge>}
        </div>
      </div>

      {materiais.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Nenhum material foi incorporado a esta OP. Salve o PCP na Etapa antes de emitir a OP ou enquanto ela ainda estiver liberada e sem solicitação.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          {materiais.map((material, index) => {
            const estoque = itensEstoque.find((item) => item.id === material.item_id);
            const disponivel = estoque?.estoqueAtual ?? 0;
            const insuficiente = !estoque || disponivel < material.quantidade_planejada;
            return (
              <div
                key={material.id}
                className={`grid gap-2 p-3 text-sm sm:grid-cols-[1fr_auto] ${index > 0 ? 'border-t' : ''}`}
              >
                <div className="min-w-0">
                  <p className="font-medium">{material.item_snapshot.nome ?? 'Item não identificado'}</p>
                  <p className="text-xs text-muted-foreground">
                    Código {material.item_snapshot.codigoBarras ?? '—'} · {material.item_snapshot.marca || 'Sem marca'}
                    {material.observacoes ? ` · ${material.observacoes}` : ''}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-semibold">
                    {formatarQuantidade(material.quantidade_planejada)} {material.unidade_snapshot}
                  </p>
                  <p className={`text-xs ${insuficiente ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                    Estoque atual: {formatarQuantidade(disponivel)} {material.unidade_snapshot}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {solicitacao ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div className="flex items-start gap-3">
              <PackageCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">Solicitação de Material #{solicitacao.numero}</p>
                  <Badge variant={statusVariant(solicitacao.status)}>
                    {statusLabel[solicitacao.status] ?? solicitacao.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Enviada em {formatarDataHora(solicitacao.created_at)} · Prazo máximo informado para separação: {formatarDataHora(solicitacao.data_limite_separacao)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />Fluxo do Almoxarifado iniciado
            </div>
          </div>
          <p className="mt-3 rounded-md bg-background/70 p-2 text-xs text-muted-foreground">
            A geração da solicitação não baixou nem reservou o estoque. A saída ocorrerá somente quando o Almoxarifado converter a solicitação em retirada.
          </p>
        </div>
      ) : materiais.length > 0 ? (
        <>
          <div className="animate-pulse rounded-lg border-2 border-red-500 bg-red-500/10 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-red-600" />
              <div>
                <p className="text-base font-black uppercase tracking-wide text-red-700 dark:text-red-400">
                  A solicitação de material ainda não foi gerada
                </p>
                <p className="mt-1 text-sm font-semibold">
                  Ao confirmar, estes itens entrarão no fluxo oficial do Almoxarifado. O prazo máximo de separação será de 1 dia, podendo ocorrer antes. Esta ação não baixa nem reserva o estoque.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock3 className="h-4 w-4" />
              Estoque responsável: {estoqueAtivo?.nome ?? 'nenhum estoque selecionado'}
            </div>
            {canConfigurarProducao() && opAberta ? (
              <Button
                type="button"
                onClick={() => setConfirmacaoAberta(true)}
                disabled={!podeGerar || gerando || !estoqueAtivo?.id}
                className="font-bold uppercase"
              >
                <Send className="mr-2 h-4 w-4" />Gerar Solicitação de Material
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                A OP precisa estar aberta e o usuário precisa ter permissão para gerenciar a Produção.
              </p>
            )}
          </div>
        </>
      ) : null}

      <AlertDialog open={confirmacaoAberta} onOpenChange={(open) => !gerando && setConfirmacaoAberta(open)}>
        <AlertDialogContent className="border-2 border-red-500">
          <AlertDialogHeader>
            <div className="mx-auto mb-2 rounded-full bg-red-500/10 p-3">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <AlertDialogTitle className="text-center text-xl font-black uppercase text-red-700 dark:text-red-400">
              Esta ação gera uma solicitação oficial
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-center text-sm text-foreground">
              <span className="block font-bold uppercase">
                O Almoxarifado receberá a solicitação e terá prazo máximo de 1 dia para separar os materiais.
              </span>
              <span className="block">
                A separação poderá ocorrer antes. A criação da solicitação não realiza baixa nem reserva automática; a saída de estoque acontecerá somente na retirada.
              </span>
              {itensSemSaldo > 0 && (
                <span className="block rounded-md border border-destructive/30 bg-destructive/5 p-2 font-semibold text-destructive">
                  Existem {itensSemSaldo} item(ns) com saldo insuficiente. Eles poderão seguir para Pedido de Compra durante a aprovação do Almoxarifado.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={gerando}>Voltar e revisar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmarGeracao();
              }}
              disabled={gerando || !estoqueAtivo?.id}
              className="bg-red-600 font-bold uppercase text-white hover:bg-red-700"
            >
              {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Estou ciente — gerar solicitação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
