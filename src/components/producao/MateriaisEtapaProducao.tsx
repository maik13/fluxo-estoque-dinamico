import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  PackageSearch,
  Plus,
  Save,
  Trash2,
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
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { useEstoqueContext } from '@/contexts/EstoqueContext';
import {
  type MaterialItemSnapshot,
  useMateriaisProducao,
} from '@/hooks/useMateriaisProducao';
import type { EstoqueItem } from '@/types/estoque';
import type { ProducaoProcesso } from '@/types/producao';

interface Props {
  processo: ProducaoProcesso;
  podeEditar: boolean;
}

interface MaterialEdicao {
  item_id: string;
  quantidade: string;
  observacoes: string;
  item_snapshot: MaterialItemSnapshot;
}

const formatarNumero = (valor: number) =>
  valor.toLocaleString('pt-BR', { maximumFractionDigits: 4 });

const snapshotDoItem = (item: EstoqueItem): MaterialItemSnapshot => ({
  id: item.id,
  nome: item.nome,
  codigoBarras: item.codigoBarras,
  marca: item.marca,
  unidade: item.unidade,
  especificacao: item.especificacao,
  fotoUrl: item.fotoUrl,
  tipoItem: item.tipoItem,
});

export const MateriaisEtapaProducao = ({ processo, podeEditar }: Props) => {
  const [aberto, setAberto] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false);
  const [popoverAberto, setPopoverAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [materiais, setMateriais] = useState<MaterialEdicao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const { obterEstoque } = useEstoqueContext();
  const { listarMateriaisEtapa, salvarMateriaisEtapa } = useMateriaisProducao();

  const itensEstoque = obterEstoque().filter((item) => item.ativo !== false);

  const itensFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    return itensEstoque
      .filter((item) => !materiais.some((material) => material.item_id === item.id))
      .filter((item) => !termo || [item.nome, item.codigoBarras, item.marca, item.especificacao]
        .filter(Boolean)
        .some((valor) => String(valor).toLocaleLowerCase('pt-BR').includes(termo)))
      .slice(0, 50);
  }, [busca, itensEstoque, materiais]);

  const carregar = async () => {
    if (carregado || carregando) return;
    setCarregando(true);
    setErro(null);
    try {
      const registros = await listarMateriaisEtapa(processo.id);
      setMateriais(registros.map((material) => ({
        item_id: material.item_id,
        quantidade: String(material.quantidade_planejada).replace('.', ','),
        observacoes: material.observacoes ?? '',
        item_snapshot: material.item_snapshot,
      })));
      setCarregado(true);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Não foi possível carregar os materiais.';
      setErro(mensagem);
      toast.error(mensagem);
    } finally {
      setCarregando(false);
    }
  };

  const alternarAberto = () => {
    const proximo = !aberto;
    setAberto(proximo);
    if (proximo) void carregar();
  };

  const adicionarItem = (item: EstoqueItem) => {
    setMateriais((atuais) => [...atuais, {
      item_id: item.id,
      quantidade: '1',
      observacoes: '',
      item_snapshot: snapshotDoItem(item),
    }]);
    setBusca('');
    setPopoverAberto(false);
  };

  const atualizarMaterial = (
    itemId: string,
    campo: 'quantidade' | 'observacoes',
    valor: string,
  ) => {
    setMateriais((atuais) => atuais.map((material) =>
      material.item_id === itemId ? { ...material, [campo]: valor } : material));
  };

  const removerMaterial = (itemId: string) => {
    setMateriais((atuais) => atuais.filter((material) => material.item_id !== itemId));
  };

  const validarMateriais = () => {
    for (const material of materiais) {
      const quantidade = Number(material.quantidade.replace(',', '.'));
      if (!Number.isFinite(quantidade) || quantidade <= 0) {
        toast.error(`Informe uma quantidade válida para ${material.item_snapshot.nome ?? 'o material'}.`);
        return false;
      }
      if (material.item_snapshot.tipoItem === 'Ferramenta' && quantidade !== 1) {
        toast.error(`A ferramenta ${material.item_snapshot.nome ?? ''} deve ser planejada como 1 unidade por código.`);
        return false;
      }
    }
    return true;
  };

  const prepararSalvamento = () => {
    if (!podeEditar) return;
    if (!validarMateriais()) return;
    setConfirmacaoAberta(true);
  };

  const confirmarSalvamento = async () => {
    setSalvando(true);
    try {
      const salvos = await salvarMateriaisEtapa(
        processo.id,
        materiais.map((material) => ({
          item_id: material.item_id,
          quantidade: Number(material.quantidade.replace(',', '.')),
          observacoes: material.observacoes.trim() || null,
        })),
      );
      setMateriais(salvos.map((material) => ({
        item_id: material.item_id,
        quantidade: String(material.quantidade_planejada).replace('.', ','),
        observacoes: material.observacoes ?? '',
        item_snapshot: material.item_snapshot,
      })));
      setConfirmacaoAberta(false);
      toast.success('PCP de materiais salvo. Nenhuma solicitação, reserva ou baixa de estoque foi gerada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o PCP de materiais.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/[0.03]">
      <button
        type="button"
        onClick={alternarAberto}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-amber-500/10 p-2">
            <PackageSearch className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="font-semibold">PCP — Materiais previstos da Etapa</p>
            <p className="text-xs text-muted-foreground">
              Planejamento prévio dos itens necessários. Não movimenta o estoque.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {carregado && (
            <span className="rounded-full border px-2 py-0.5 text-xs font-semibold">
              {materiais.length} item(ns)
            </span>
          )}
          {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {aberto && (
        <div className="space-y-4 border-t p-4">
          <div className="animate-pulse rounded-lg border-2 border-amber-500 bg-amber-500/15 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
              <div>
                <p className="text-base font-black uppercase tracking-wide text-amber-700 dark:text-amber-400 sm:text-lg">
                  Atenção: este planejamento não gera solicitação e não baixa o estoque
                </p>
                <p className="mt-1 text-sm font-semibold">
                  Os materiais somente entrarão no fluxo do Almoxarifado quando a Solicitação de Material for confirmada dentro da OP.
                  Após a solicitação oficial, o prazo máximo de separação será de 1 dia, podendo ocorrer antes.
                </p>
              </div>
            </div>
          </div>

          {carregando ? (
            <div className="flex items-center justify-center rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando PCP de materiais...
            </div>
          ) : erro ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {erro}
            </div>
          ) : (
            <>
              {podeEditar && (
                <div className="space-y-2">
                  <Label>Adicionar item do Almoxarifado</Label>
                  <Popover open={popoverAberto} onOpenChange={setPopoverAberto}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="w-full justify-start">
                        <Plus className="mr-2 h-4 w-4" />Buscar por nome, código, marca ou especificação...
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[min(640px,calc(100vw-2rem))] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput value={busca} onValueChange={setBusca} placeholder="Ex.: micropino ou código 12345" />
                        <CommandList>
                          <CommandEmpty>Nenhum item ativo encontrado.</CommandEmpty>
                          <CommandGroup>
                            {itensFiltrados.map((item) => (
                              <CommandItem key={item.id} value={item.id} onSelect={() => adicionarItem(item)}>
                                <div className="flex w-full flex-col">
                                  <span className="font-medium">{item.nome}</span>
                                  <span className="text-xs text-muted-foreground">
                                    Código {item.codigoBarras} · {item.marca || 'Sem marca'} · Estoque atual: {formatarNumero(item.estoqueAtual)} {item.unidade}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {materiais.length === 0 ? (
                <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
                  Nenhum material foi planejado para esta Etapa.
                </div>
              ) : (
                <div className="space-y-3">
                  {materiais.map((material) => {
                    const estoque = itensEstoque.find((item) => item.id === material.item_id);
                    return (
                      <div key={material.item_id} className="rounded-lg border bg-card p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold">{material.item_snapshot.nome ?? 'Item não identificado'}</p>
                            <p className="text-xs text-muted-foreground">
                              Código {material.item_snapshot.codigoBarras ?? '—'} · {material.item_snapshot.marca || 'Sem marca'}
                              {estoque ? ` · Estoque atual: ${formatarNumero(estoque.estoqueAtual)} ${estoque.unidade}` : ''}
                            </p>
                            {material.item_snapshot.especificacao && (
                              <p className="mt-1 text-xs text-muted-foreground">{material.item_snapshot.especificacao}</p>
                            )}
                          </div>
                          <div className="grid gap-3 sm:grid-cols-[150px_1fr_auto] lg:w-[520px]">
                            <div className="space-y-1">
                              <Label className="text-xs">Qtd. prevista na Etapa</Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  value={material.quantidade}
                                  onChange={(event) => atualizarMaterial(material.item_id, 'quantidade', event.target.value)}
                                  inputMode="decimal"
                                  disabled={!podeEditar}
                                />
                                <span className="text-xs text-muted-foreground">{material.item_snapshot.unidade ?? ''}</span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Observação do PCP</Label>
                              <Textarea
                                value={material.observacoes}
                                onChange={(event) => atualizarMaterial(material.item_id, 'observacoes', event.target.value)}
                                rows={2}
                                placeholder="Aplicação, medida ou orientação"
                                disabled={!podeEditar}
                              />
                            </div>
                            {podeEditar && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="mt-5 text-destructive"
                                onClick={() => removerMaterial(material.item_id)}
                                title="Remover material do PCP"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
                As quantidades representam a necessidade total da Etapa. Ao emitir uma OP parcial, o sistema cria um snapshot proporcional para aquela OP.
                Alterações posteriores não reescrevem OPs em execução ou materiais já solicitados.
              </div>

              {podeEditar && (
                <div className="flex justify-end">
                  <Button type="button" onClick={prepararSalvamento} disabled={salvando}>
                    {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Salvar planejamento PCP
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <AlertDialog open={confirmacaoAberta} onOpenChange={(open) => !salvando && setConfirmacaoAberta(open)}>
        <AlertDialogContent className="border-2 border-amber-500">
          <AlertDialogHeader>
            <div className="mx-auto mb-2 rounded-full bg-amber-500/15 p-3">
              <AlertTriangle className="h-8 w-8 text-amber-600" />
            </div>
            <AlertDialogTitle className="text-center text-xl font-black uppercase text-amber-700 dark:text-amber-400">
              Isto é somente planejamento de materiais
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-center text-sm text-foreground">
              <span className="block font-bold uppercase">
                Salvar o PCP não cria Solicitação de Material, não reserva e não baixa o estoque.
              </span>
              <span className="block">
                A solicitação oficial será uma ação separada dentro da Ordem de Produção. Depois de solicitada, o Almoxarifado terá prazo máximo de 1 dia para separar o material, podendo concluir antes.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={salvando}>Voltar e revisar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmarSalvamento();
              }}
              disabled={salvando}
              className="bg-amber-600 font-bold uppercase text-white hover:bg-amber-700"
            >
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Estou ciente — salvar PCP
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
