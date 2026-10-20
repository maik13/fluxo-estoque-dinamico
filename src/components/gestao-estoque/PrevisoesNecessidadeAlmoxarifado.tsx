import { useMemo, useState, type FormEvent } from "react";
import {
  ClipboardList,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";

type PrevisaoNecessidade = {
  id: string;
  numero: number;
  status: string;
  origem_tipo?: string | null;
  origem_modulo?: string | null;
  area_solicitante?: string | null;
  solicitante_nome?: string | null;
  descricao?: string | null;
  projeto_centro_custo?: string | null;
  data_necessidade?: string | null;
  urgencia?: string | null;
  justificativa?: string | null;
  valor_estimado?: number | string | null;
  estimativa_incompleta?: boolean | null;
  requisicao_compra_id?: string | null;
};

type LinhaPnSalva = {
  id: string;
  necessidade_id: string;
  descricao: string;
  quantidade: number | string;
  unidade: string;
  origem: "estoque" | "avulso";
  ordem: number;
  item_id?: string | null;
  especificacao?: string | null;
  valor_unitario_estimado?: number | string | null;
};

type ItemEstoque = {
  id: string;
  nome: string;
  codigo_barras: number;
  unidade: string;
  especificacao?: string | null;
  valor?: number | null;
};

type LinhaFormulario = {
  chave: string;
  itemId?: string;
  origem: "estoque" | "avulso";
  descricao: string;
  especificacao: string;
  quantidade: string;
  unidade: string;
  valorUnitario: string;
};

type RequisicaoCompra = {
  id: string;
  numero: number;
  status_financeiro_rc?: string | null;
};

const statusPn: Record<string, string> = {
  previsto: "Prevista",
  em_cotacao: "Em cotação",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovado: "Aprovada",
  comprometido: "Comprometida",
  cancelado: "Cancelada",
};
const statusRc: Record<string, string> = {
  em_cotacao: "Em cotação",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
  convertida_em_pc: "Convertida em PC",
};
const formularioInicial = {
  dataNecessidade: "",
  projetoCentroCusto: "",
  urgencia: "normal",
  justificativa: "",
};
const criarLinhaAvulsa = (): LinhaFormulario => ({
  chave: crypto.randomUUID(),
  origem: "avulso",
  descricao: "",
  especificacao: "",
  quantidade: "1",
  unidade: "UN",
  valorUnitario: "",
});

const numeroOpcional = (valor: string) => {
  const limpo = valor.trim();
  if (!limpo) return null;
  const numero = Number(limpo.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numero) ? numero : Number.NaN;
};
const moeda = (valor?: number | string | null) =>
  valor == null || valor === "" || Number.isNaN(Number(valor))
    ? "A definir"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(Number(valor));
const dataPt = (valor?: string | null) =>
  !valor
    ? "—"
    : (() => {
        const [ano, mes, dia] = valor.slice(0, 10).split("-");
        return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor;
      })();

export const PrevisoesNecessidadeAlmoxarifado = () => {
  const { canCriarPrevisaoNecessidadeAlmoxarifado } = usePermissions();
  const [aberto, setAberto] = useState(false);
  const [dialogCriacao, setDialogCriacao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [carregandoCatalogo, setCarregandoCatalogo] = useState(false);
  const [pns, setPns] = useState<PrevisaoNecessidade[]>([]);
  const [linhasPorPn, setLinhasPorPn] = useState<
    Record<string, LinhaPnSalva[]>
  >({});
  const [rcPorId, setRcPorId] = useState<Record<string, RequisicaoCompra>>({});
  const [catalogo, setCatalogo] = useState<ItemEstoque[]>([]);
  const [buscaItem, setBuscaItem] = useState("");
  const [formulario, setFormulario] = useState(formularioInicial);
  const [linhas, setLinhas] = useState<LinhaFormulario[]>([]);
  const [pnEmFormalizacao, setPnEmFormalizacao] = useState<string | null>(null);
  const [pnEmEdicao, setPnEmEdicao] = useState<PrevisaoNecessidade | null>(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      const { data, error } = await (supabase as any)
        .from("financeiro_necessidades")
        .select(
          "id, numero, status, origem_tipo, origem_modulo, area_solicitante, solicitante_nome, descricao, projeto_centro_custo, data_necessidade, urgencia, justificativa, valor_estimado, estimativa_incompleta, requisicao_compra_id",
        )
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const previsoes = (data ?? []) as PrevisaoNecessidade[];
      const idsPns = previsoes.map((pn) => pn.id);
      let linhasSalvas: LinhaPnSalva[] = [];
      if (idsPns.length) {
        const { data: dadosLinhas, error: erroLinhas } = await (supabase as any)
          .from("financeiro_necessidade_itens")
          .select(
            "id, necessidade_id, item_id, descricao, especificacao, quantidade, unidade, origem, valor_unitario_estimado, ordem",
          )
          .in("necessidade_id", idsPns)
          .order("ordem");
        if (
          erroLinhas &&
          !erroLinhas.message.includes("financeiro_necessidade_itens")
        )
          throw erroLinhas;
        linhasSalvas = (dadosLinhas ?? []) as LinhaPnSalva[];
      }
      const idsRcs = previsoes
        .map((pn) => pn.requisicao_compra_id)
        .filter((id): id is string => Boolean(id));
      let rcs: RequisicaoCompra[] = [];
      if (idsRcs.length) {
        const { data: dadosRcs, error: erroRcs } = await (supabase as any)
          .from("pedidos_compra")
          .select("id, numero, status_financeiro_rc")
          .in("id", idsRcs);
        if (erroRcs) throw erroRcs;
        rcs = (dadosRcs ?? []) as RequisicaoCompra[];
      }
      setPns(previsoes);
      setLinhasPorPn(
        linhasSalvas.reduce<Record<string, LinhaPnSalva[]>>(
          (acumulado, linha) => ({
            ...acumulado,
            [linha.necessidade_id]: [
              ...(acumulado[linha.necessidade_id] ?? []),
              linha,
            ],
          }),
          {},
        ),
      );
      setRcPorId(Object.fromEntries(rcs.map((rc) => [rc.id, rc])));
    } catch (error) {
      console.error("Erro ao carregar PNs do Almoxarifado:", error);
      toast.error("Não foi possível carregar as PNs do Almoxarifado.");
    } finally {
      setCarregando(false);
    }
  };

  const carregarCatalogo = async () => {
    setCarregandoCatalogo(true);
    try {
      const { data, error } = await supabase
        .from("items")
        .select("id, nome, codigo_barras, unidade, especificacao, valor")
        .eq("ativo", true)
        .order("nome")
        .limit(1000);
      if (error) throw error;
      setCatalogo((data ?? []) as ItemEstoque[]);
    } catch (error) {
      console.error("Erro ao carregar catálogo do estoque:", error);
      toast.error(
        "Não foi possível carregar os itens cadastrados no Almoxarifado.",
      );
    } finally {
      setCarregandoCatalogo(false);
    }
  };

  const abrir = () => {
    setAberto(true);
    void carregar();
  };
  const abrirCriacao = () => {
    setPnEmEdicao(null);
    setFormulario(formularioInicial);
    setLinhas([]);
    setBuscaItem("");
    setDialogCriacao(true);
    void carregarCatalogo();
  };
  const abrirEdicao = (pn: PrevisaoNecessidade) => {
    if (pn.requisicao_compra_id) {
      return toast.info("Esta PN já virou RC. Faça os ajustes operacionais na própria RC para preservar o vínculo.");
    }
    setPnEmEdicao(pn);
    setFormulario({
      dataNecessidade: pn.data_necessidade?.slice(0, 10) ?? "",
      projetoCentroCusto: pn.projeto_centro_custo ?? "",
      urgencia: pn.urgencia ?? "normal",
      justificativa: pn.justificativa ?? "",
    });
    setLinhas((linhasPorPn[pn.id] ?? []).map((linha) => ({
      chave: linha.id,
      itemId: linha.item_id ?? undefined,
      origem: linha.origem,
      descricao: linha.descricao,
      especificacao: linha.especificacao ?? "",
      quantidade: String(linha.quantidade).replace(".", ","),
      unidade: linha.unidade,
      valorUnitario: linha.valor_unitario_estimado == null
        ? ""
        : String(linha.valor_unitario_estimado).replace(".", ","),
    })));
    setBuscaItem("");
    setDialogCriacao(true);
    void carregarCatalogo();
  };
  const adicionarItemEstoque = (item: ItemEstoque) => {
    if (linhas.some((linha) => linha.itemId === item.id))
      return toast.error(
        "Este item já está na PN. Ajuste a quantidade na lista.",
      );
    setLinhas((atuais) => [
      ...atuais,
      {
        chave: crypto.randomUUID(),
        itemId: item.id,
        origem: "estoque",
        descricao: item.nome,
        especificacao: item.especificacao ?? "",
        quantidade: "1",
        unidade: item.unidade || "UN",
        valorUnitario:
          item.valor == null ? "" : String(item.valor).replace(".", ","),
      },
    ]);
    setBuscaItem("");
  };
  const atualizarLinha = (
    chave: string,
    campo: keyof LinhaFormulario,
    valor: string,
  ) =>
    setLinhas((atuais) =>
      atuais.map((linha) =>
        linha.chave === chave ? { ...linha, [campo]: valor } : linha,
      ),
    );

  const criarPrevisao = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!linhas.length) return toast.error("Adicione pelo menos um item à PN.");
    let itens: Array<Record<string, unknown>>;
    try {
      itens = linhas.map((linha, indice) => {
        const quantidade = numeroOpcional(linha.quantidade);
        const valorUnitario = numeroOpcional(linha.valorUnitario);
        if (
          !linha.descricao.trim() ||
          !linha.unidade.trim() ||
          quantidade == null ||
          Number.isNaN(quantidade) ||
          quantidade <= 0 ||
          Number.isNaN(valorUnitario)
        )
          throw new Error(`Revise os dados do item ${indice + 1}.`);
        return {
          item_id: linha.itemId ?? null,
          descricao: linha.descricao.trim(),
          especificacao: linha.especificacao.trim() || null,
          quantidade,
          unidade: linha.unidade.trim(),
          valor_unitario: valorUnitario,
        };
      });
    } catch (error) {
      return toast.error((error as Error).message);
    }
    setSalvando(true);
    try {
      const { error } = await (supabase as any).rpc(
        pnEmEdicao
          ? "editar_previsao_necessidade_almoxarifado_v1"
          : "criar_previsao_necessidade_almoxarifado_lote",
        pnEmEdicao
          ? {
              p_necessidade_id: pnEmEdicao.id,
              p_itens: itens,
              p_data_necessidade: formulario.dataNecessidade || null,
              p_projeto_centro_custo: formulario.projetoCentroCusto || null,
              p_urgencia: formulario.urgencia,
              p_justificativa: formulario.justificativa || null,
            }
          : {
              p_itens: itens,
              p_data_necessidade: formulario.dataNecessidade || null,
              p_projeto_centro_custo: formulario.projetoCentroCusto || null,
              p_urgencia: formulario.urgencia,
              p_justificativa: formulario.justificativa || null,
            },
      );
      if (error) throw error;
      toast.success(
        pnEmEdicao
          ? `PN-${String(pnEmEdicao.numero).padStart(4, "0")} atualizada.`
          : `PN criada com ${itens.length} ${itens.length === 1 ? "item" : "itens"}.`,
      );
      setDialogCriacao(false);
      setPnEmEdicao(null);
      await carregar();
    } catch (error) {
      console.error("Erro ao criar PN em lote no Almoxarifado:", error);
      toast.error((error as any)?.message || "Não foi possível criar a PN.");
    } finally {
      setSalvando(false);
    }
  };

  const formalizarRc = async (pn: PrevisaoNecessidade) => {
    setPnEmFormalizacao(pn.id);
    try {
      const { data, error } = await (supabase as any).rpc(
        "financeiro_criar_rc_da_pn",
        { p_necessidade_id: pn.id },
      );
      if (error) throw error;
      const rc = Array.isArray(data) ? data[0] : data;
      toast.success(
        rc?.ja_existia
          ? `RC #${rc.numero} já está vinculada a esta PN.`
          : `RC #${rc?.numero ?? ""} criada. Agora ela pode ser executada em Pedidos de Compra.`,
      );
      await carregar();
    } catch (error) {
      console.error("Erro ao formalizar RC no Almoxarifado:", error);
      toast.error("Não foi possível formalizar esta RC no Almoxarifado.");
    } finally {
      setPnEmFormalizacao(null);
    }
  };

  const itensFiltrados = useMemo(() => {
    const termo = buscaItem.trim().toLocaleLowerCase("pt-BR");
    return catalogo
      .filter(
        (item) =>
          !termo ||
          [item.nome, item.especificacao, String(item.codigo_barras)]
            .filter(Boolean)
            .some((valor) =>
              String(valor).toLocaleLowerCase("pt-BR").includes(termo),
            ),
      )
      .slice(0, 12);
  }, [buscaItem, catalogo]);

  return (
    <>
      <Card
        className="cursor-pointer border-amber-500/30 bg-gradient-to-br from-amber-950/20 to-orange-950/20 shadow-sm transition-all duration-300 hover:scale-105 hover:border-amber-400"
        onClick={abrir}
      >
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg">
            <ClipboardList className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-amber-400">
            Previsões de Necessidade (PN) — visão unificada
          </CardTitle>
          <CardDescription className="text-amber-500/70">
            Consulte todas as PNs do sistema, formalize a RC e acompanhe o fluxo
          </CardDescription>
        </CardHeader>
      </Card>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-7xl overflow-y-auto">
          <DialogHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <DialogTitle>
                Previsões de Necessidade (PN) — visão unificada
              </DialogTitle>
              <DialogDescription>
                Esta é a mesma fila de PNs exibida no Financeiro. PNs criadas em
                qualquer área aparecem aqui com o mesmo número, status e vínculo.
              </DialogDescription>
            </div>
            {canCriarPrevisaoNecessidadeAlmoxarifado() && (
              <Button size="sm" onClick={abrirCriacao}>
                <Plus className="mr-2 h-4 w-4" />
                Nova PN
              </Button>
            )}
          </DialogHeader>
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void carregar()}
              disabled={carregando}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </div>
          {carregando ? (
            <p className="py-8 text-center text-muted-foreground">
              Carregando PNs...
            </p>
          ) : pns.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Nenhuma PN do Almoxarifado encontrada.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PN</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Itens</TableHead>
                    <TableHead>Projeto / centro</TableHead>
                    <TableHead>Data necessária</TableHead>
                    <TableHead className="text-right">Valor estimado</TableHead>
                    <TableHead>RC / ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pns.map((pn) => {
                    const rc = pn.requisicao_compra_id
                      ? rcPorId[pn.requisicao_compra_id]
                      : undefined;
                    const itens = linhasPorPn[pn.id] ?? [];
                    return (
                      <TableRow key={pn.id}>
                        <TableCell className="font-medium">
                          PN-{String(pn.numero).padStart(4, "0")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {statusPn[pn.status] ?? pn.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="min-w-[300px]">
                          {itens.length ? (
                            <div className="space-y-1">
                              {itens.map((item) => (
                                <div key={item.id} className="text-sm">
                                  <span className="font-medium">
                                    {item.descricao}
                                  </span>{" "}
                                  <span className="text-muted-foreground">
                                    · {item.quantidade} {item.unidade} ·{" "}
                                    {item.origem === "estoque"
                                      ? "catálogo"
                                      : "avulso"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {pn.descricao || "Item sem detalhamento legado"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{pn.projeto_centro_custo || "—"}</TableCell>
                        <TableCell>{dataPt(pn.data_necessidade)}</TableCell>
                        <TableCell className="text-right">
                          {pn.estimativa_incompleta ? (
                            <div className="text-right">
                              <div>{moeda(pn.valor_estimado)}</div>
                              <div className="text-xs text-amber-600">
                                Valor parcial — há itens sem preço/cotação
                              </div>
                            </div>
                          ) : pn.valor_estimado == null ? (
                            <span className="text-xs text-muted-foreground">
                              Valor a cotar no Almoxarifado
                            </span>
                          ) : (
                            moeda(pn.valor_estimado)
                          )}
                        </TableCell>
                        <TableCell>
                          {rc ? (
                            <div>
                              <Badge variant="secondary">
                                RC-{String(rc.numero).padStart(4, "0")}
                              </Badge>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {statusRc[rc.status_financeiro_rc || ""] ??
                                  rc.status_financeiro_rc}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {canCriarPrevisaoNecessidadeAlmoxarifado() ? (
                                <div className="flex flex-wrap gap-2">
                                  <Button size="sm" variant="outline" onClick={() => abrirEdicao(pn)} disabled={pn.status === "cancelado"}>
                                    <Pencil className="mr-1 h-3.5 w-3.5" /> Editar PN
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => void formalizarRc(pn)}
                                    disabled={pnEmFormalizacao === pn.id || pn.status === "cancelado"}
                                  >
                                    {pnEmFormalizacao === pn.id
                                      ? "Criando RC..."
                                      : "Formalizar RC"}
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  Aguardando formalização
                                </span>
                              )}
                              <div className="text-xs text-muted-foreground">
                                A compra será executada em Pedidos de Compra.
                              </div>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={dialogCriacao} onOpenChange={(open) => { setDialogCriacao(open); if (!open) setPnEmEdicao(null); }}>
        <DialogContent className="max-h-[92vh] w-[96vw] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{pnEmEdicao ? `Editar PN-${String(pnEmEdicao.numero).padStart(4, "0")}` : "Nova PN do Almoxarifado"}</DialogTitle>
            <DialogDescription>
              {pnEmEdicao ? "Corrija os dados antes de formalizar a RC." : "Adicione todos os itens da necessidade e envie uma única PN."}
              Selecionar um item do catálogo não movimenta o estoque.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-5" onSubmit={criarPrevisao}>
            <div className="grid gap-4 rounded-lg border bg-muted/20 p-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="pn-data">Data necessária</Label>
                <Input
                  id="pn-data"
                  type="date"
                  value={formulario.dataNecessidade}
                  onChange={(event) =>
                    setFormulario((atual) => ({
                      ...atual,
                      dataNecessidade: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pn-projeto">Projeto / centro de custo</Label>
                <Input
                  id="pn-projeto"
                  value={formulario.projetoCentroCusto}
                  onChange={(event) =>
                    setFormulario((atual) => ({
                      ...atual,
                      projetoCentroCusto: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pn-urgencia">Urgência</Label>
                <select
                  id="pn-urgencia"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formulario.urgencia}
                  onChange={(event) =>
                    setFormulario((atual) => ({
                      ...atual,
                      urgencia: event.target.value,
                    }))
                  }
                >
                  <option value="baixa">Baixa</option>
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
              <div className="space-y-2 sm:col-span-3">
                <Label htmlFor="pn-justificativa">
                  Justificativa / observação
                </Label>
                <Textarea
                  id="pn-justificativa"
                  value={formulario.justificativa}
                  onChange={(event) =>
                    setFormulario((atual) => ({
                      ...atual,
                      justificativa: event.target.value,
                    }))
                  }
                  rows={2}
                />
              </div>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-3 rounded-lg border p-4">
                <div>
                  <h3 className="font-semibold">
                    Adicionar do estoque cadastrado
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Busque por nome, especificação ou código de barras.
                  </p>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    value={buscaItem}
                    onChange={(event) => setBuscaItem(event.target.value)}
                    placeholder="Ex.: cabo, 1234, tinta..."
                  />
                </div>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {carregandoCatalogo ? (
                    <p className="py-5 text-center text-sm text-muted-foreground">
                      Carregando catálogo...
                    </p>
                  ) : itensFiltrados.length === 0 ? (
                    <p className="py-5 text-center text-sm text-muted-foreground">
                      Nenhum item encontrado.
                    </p>
                  ) : (
                    itensFiltrados.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => adicionarItemEstoque(item)}
                        className="flex w-full items-center justify-between rounded-md border p-3 text-left transition-colors hover:bg-muted"
                      >
                        <span>
                          <span className="block font-medium">{item.nome}</span>
                          <span className="block text-xs text-muted-foreground">
                            Cód. {item.codigo_barras} · {item.unidade}
                            {item.especificacao
                              ? ` · ${item.especificacao}`
                              : ""}
                          </span>
                        </span>
                        <Plus className="h-4 w-4 text-primary" />
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div className="flex flex-col justify-between rounded-lg border border-dashed p-4">
                <div>
                  <h3 className="font-semibold">Item ainda não cadastrado</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Inclua um item avulso na PN. Ele seguirá para cotação/compra
                    sem criar automaticamente um cadastro no estoque.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 w-fit"
                  onClick={() =>
                    setLinhas((atuais) => [...atuais, criarLinhaAvulsa()])
                  }
                >
                  <PackagePlus className="mr-2 h-4 w-4" />
                  Adicionar item avulso
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <h3 className="font-semibold">Itens desta PN</h3>
                  <p className="text-sm text-muted-foreground">
                    Revise quantidades e valores unitários antes de enviar.
                  </p>
                </div>
                <Badge variant="secondary">
                  {linhas.length} {linhas.length === 1 ? "item" : "itens"}
                </Badge>
              </div>
              {linhas.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Adicione itens do catálogo ou itens avulsos para montar a PN.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Origem</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Quantidade</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead>Valor unitário</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linhas.map((linha) => (
                        <TableRow key={linha.chave}>
                          <TableCell>
                            <Badge
                              variant={
                                linha.origem === "estoque"
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {linha.origem === "estoque"
                                ? "Catálogo"
                                : "Avulso"}
                            </Badge>
                          </TableCell>
                          <TableCell className="min-w-[280px]">
                            <Input
                              value={linha.descricao}
                              disabled={linha.origem === "estoque"}
                              onChange={(event) =>
                                atualizarLinha(
                                  linha.chave,
                                  "descricao",
                                  event.target.value,
                                )
                              }
                              placeholder="Nome do item"
                            />
                            {linha.origem === "avulso" && (
                              <Input
                                className="mt-2"
                                value={linha.especificacao}
                                onChange={(event) =>
                                  atualizarLinha(
                                    linha.chave,
                                    "especificacao",
                                    event.target.value,
                                  )
                                }
                                placeholder="Especificação opcional"
                              />
                            )}
                          </TableCell>
                          <TableCell className="min-w-[120px]">
                            <Input
                              inputMode="decimal"
                              value={linha.quantidade}
                              onChange={(event) =>
                                atualizarLinha(
                                  linha.chave,
                                  "quantidade",
                                  event.target.value,
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="min-w-[100px]">
                            <Input
                              value={linha.unidade}
                              onChange={(event) =>
                                atualizarLinha(
                                  linha.chave,
                                  "unidade",
                                  event.target.value,
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="min-w-[150px]">
                            <Input
                              inputMode="decimal"
                              value={linha.valorUnitario}
                              onChange={(event) =>
                                atualizarLinha(
                                  linha.chave,
                                  "valorUnitario",
                                  event.target.value,
                                )
                              }
                              placeholder="A definir"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() =>
                                setLinhas((atuais) =>
                                  atuais.filter(
                                    (item) => item.chave !== linha.chave,
                                  ),
                                )
                              }
                              aria-label={`Remover ${linha.descricao || "item"}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogCriacao(false)}
                disabled={salvando}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando || !linhas.length}>
                {salvando
                  ? "Enviando..."
                  : pnEmEdicao
                    ? "Salvar correções da PN"
                    : `Criar PN com ${linhas.length || ""} ${linhas.length === 1 ? "item" : "itens"}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
