import { useMemo, useState } from 'react';
import { ReceiptText, Plus, Trash2, Truck, Package, Globe2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useEstoqueContext } from '@/contexts/EstoqueContext';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Tipo = 'insumo' | 'frete' | 'global';

type ItemSolicitado = {
  item_id?: string | null;
  codigo_item?: string | null;
  descricao: string;
  quantidade: string;
  unidade: string;
  observacoes: string;
};

const vazio = {
  titulo: '',
  tipo: 'insumo' as Tipo,
  projeto_centro_custo: '',
  data_necessaria: '',
  prioridade: 'normal',
  observacoes: '',
  origem_frete: '',
  destino_frete: '',
  peso_kg: '',
  cubagem_m3: '',
  volumes: '',
};

export function SolicitarOrcamento() {
  const { user } = useAuth();
  const { userProfile } = usePermissions();
  const { obterEstoque } = useEstoqueContext();
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ ...vazio });
  const [buscaItem, setBuscaItem] = useState('');
  const [itens, setItens] = useState<ItemSolicitado[]>([]);

  const limpar = () => {
    setForm({ ...vazio });
    setBuscaItem('');
    setItens([]);
  };

  const salvar = async () => {
    if (!user?.id) return;
    if (!form.titulo.trim()) {
      toast.error('Informe o que precisa ser orçado.');
      return;
    }

    if (form.tipo === 'insumo' && !itens.some((item) => item.descricao.trim())) {
      toast.error('Adicione ao menos um material à solicitação.');
      return;
    }

    if (form.tipo === 'frete' && (!form.origem_frete.trim() || !form.destino_frete.trim())) {
      toast.error('Informe origem e destino do frete.');
      return;
    }

    setSalvando(true);
    try {
      const { data, error } = await (supabase.from as any)('cotacao_solicitacoes')
        .insert({
          titulo: form.titulo.trim(),
          tipo: form.tipo,
          status: 'solicitada',
          projeto_centro_custo: form.projeto_centro_custo.trim() || null,
          data_necessaria: form.data_necessaria || null,
          prioridade: form.prioridade,
          observacoes: form.observacoes.trim() || null,
          origem_frete: form.tipo === 'frete' ? form.origem_frete.trim() || null : null,
          destino_frete: form.tipo === 'frete' ? form.destino_frete.trim() || null : null,
          peso_kg: form.tipo === 'frete' && form.peso_kg ? Number(form.peso_kg.replace(',', '.')) : null,
          cubagem_m3: form.tipo === 'frete' && form.cubagem_m3 ? Number(form.cubagem_m3.replace(',', '.')) : null,
          volumes: form.tipo === 'frete' && form.volumes ? Number(form.volumes) : null,
          criado_por: user.id,
          criado_por_nome: userProfile?.nome || user.email || 'Usuário',
        })
        .select('id,numero')
        .single();

      if (error) throw error;

      if (form.tipo === 'insumo') {
        const rows = itens
          .filter((item) => item.descricao.trim())
          .map((item, index) => ({
            solicitacao_id: data.id,
            item_id: item.item_id || null,
            codigo_item: item.codigo_item || null,
            descricao: item.descricao.trim(),
            quantidade: item.quantidade ? Number(item.quantidade.replace(',', '.')) : null,
            unidade: item.unidade.trim() || null,
            observacoes: item.observacoes.trim() || null,
            ordem: index,
          }));

        const { error: itemError } = await (supabase.from as any)('cotacao_solicitacao_itens').insert(rows);
        if (itemError) throw itemError;
      }

      toast.success(`Solicitação SOL-${String(data.numero).padStart(4, '0')} enviada ao Almoxarifado.`);
      setOpen(false);
      limpar();
      window.dispatchEvent(new CustomEvent('cotacao-solicitacao-criada'));
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Não foi possível enviar a solicitação.');
    } finally {
      setSalvando(false);
    }
  };


  const itensEstoque = useMemo(
    () => (obterEstoque() ?? []).filter((item) => item.ativo !== false),
    [obterEstoque],
  );

  const resultadosBuscaItem = useMemo(() => {
    const termo = buscaItem.trim().toLocaleLowerCase('pt-BR');
    if (termo.length < 2) return [];

    return itensEstoque
      .filter((item) => {
        if (itens.some((selecionado) => selecionado.item_id === item.id)) return false;
        return [item.nome, item.codigoBarras, item.marca, item.especificacao]
          .filter(Boolean)
          .some((valor) => String(valor).toLocaleLowerCase('pt-BR').includes(termo));
      })
      .slice(0, 10);
  }, [buscaItem, itensEstoque, itens]);

  const adicionarItemEstoque = (item: any) => {
    setItens((current) => [
      ...current,
      {
        item_id: item.id,
        codigo_item: String(item.codigoBarras ?? ''),
        descricao: item.nome,
        quantidade: '',
        unidade: item.unidade || 'un',
        observacoes: '',
      },
    ]);
    setBuscaItem('');
  };

  const adicionarItemManual = () => {
    setItens((current) => [
      ...current,
      {
        item_id: null,
        codigo_item: null,
        descricao: '',
        quantidade: '',
        unidade: 'un',
        observacoes: '',
      },
    ]);
  };

  const atualizarItem = (index: number, patch: Partial<ItemSolicitado>) => {
    setItens((current) => current.map((item, idx) => idx === index ? { ...item, ...patch } : item));
  };

  const TipoIcon = form.tipo === 'frete' ? Truck : form.tipo === 'global' ? Globe2 : Package;

  return (
    <Dialog open={open} onOpenChange={(value) => {
      setOpen(value);
      if (!value) limpar();
    }}>
      <DialogTrigger asChild>
        <Card className="cursor-pointer border-violet-500/20 transition-all duration-300 hover:scale-105 hover:border-violet-500/40">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/10">
              <ReceiptText className="h-8 w-8 text-violet-500" />
            </div>
            <CardTitle className="text-violet-500">Solicitar Orçamento</CardTitle>
            <CardDescription>
              Formalize uma necessidade para cotação pelo Almoxarifado
            </CardDescription>
          </CardHeader>
        </Card>
      </DialogTrigger>

      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Solicitação de Orçamento</DialogTitle>
          <DialogDescription>
            Informe o que precisa ser cotado. O Almoxarifado fará contato com fornecedores e registrará as propostas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>O que precisa ser orçado *</Label>
              <Input
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                placeholder="Ex.: Abraçadeiras para produção / Frete Maringá → Brusque"
              />
            </div>

            <div>
              <Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={(value) => setForm((f) => ({ ...f, tipo: value as Tipo }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="insumo">Insumo / material</SelectItem>
                  <SelectItem value="frete">Frete</SelectItem>
                  <SelectItem value="global">Orçamento global / serviço</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Prioridade</Label>
              <Select value={form.prioridade} onValueChange={(value) => setForm((f) => ({ ...f, prioridade: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Projeto / centro de custo</Label>
              <Input
                value={form.projeto_centro_custo}
                onChange={(e) => setForm((f) => ({ ...f, projeto_centro_custo: e.target.value }))}
                placeholder="Opcional"
              />
            </div>

            <div>
              <Label>Data necessária</Label>
              <Input
                type="date"
                value={form.data_necessaria}
                onChange={(e) => setForm((f) => ({ ...f, data_necessaria: e.target.value }))}
              />
            </div>
          </div>

          {form.tipo === 'insumo' && (
            <div className="space-y-4 rounded-lg border p-4">
              <div>
                <div className="flex items-center gap-2 font-medium">
                  <TipoIcon className="h-4 w-4" /> Materiais a cotar
                </div>
                <p className="text-xs text-muted-foreground">
                  Pesquise o cadastro do estoque pelo nome ou código. O solicitante informa apenas o material e a quantidade necessária.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Buscar item do estoque</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={buscaItem}
                    onChange={(e) => setBuscaItem(e.target.value)}
                    placeholder="Ex.: cinta plástica, 1281, parafuso..."
                    className="pl-9"
                  />
                </div>

                {resultadosBuscaItem.length > 0 && (
                  <div className="max-h-64 overflow-y-auto rounded-lg border bg-background">
                    {resultadosBuscaItem.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => adicionarItemEstoque(item)}
                        className="flex w-full items-start justify-between gap-3 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/50"
                      >
                        <div className="min-w-0">
                          <div className="font-medium">{item.nome}</div>
                          <div className="text-xs text-muted-foreground">
                            Código {item.codigoBarras}
                            {item.marca ? ` · ${item.marca}` : ''}
                            {item.especificacao ? ` · ${item.especificacao}` : ''}
                          </div>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">{item.unidade || 'un'}</span>
                      </button>
                    ))}
                  </div>
                )}

                {buscaItem.trim().length >= 2 && resultadosBuscaItem.length === 0 && (
                  <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                    Nenhum item do estoque encontrado para “{buscaItem}”.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Itens selecionados</p>
                  <p className="text-xs text-muted-foreground">Preço e fornecedor serão preenchidos pelo Almoxarifado durante a cotação.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={adicionarItemManual}>
                  <Plus className="mr-2 h-4 w-4" /> Item não cadastrado
                </Button>
              </div>

              <div className="space-y-2">
                {itens.map((item, index) => (
                  <div key={index} className="rounded-lg border p-3">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {item.item_id ? (
                          <>
                            <div className="font-medium">{item.descricao}</div>
                            <div className="text-xs text-muted-foreground">
                              Item do estoque · Código {item.codigo_item || '—'}
                            </div>
                          </>
                        ) : (
                          <Input
                            placeholder="Descrição do material não cadastrado"
                            value={item.descricao}
                            onChange={(e) => atualizarItem(index, { descricao: e.target.value })}
                          />
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setItens((current) => current.filter((_, idx) => idx !== index))}
                        title="Remover item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid gap-2 md:grid-cols-[140px_110px_1fr]">
                      <div>
                        <Label>Quantidade *</Label>
                        <Input
                          placeholder="Qtd."
                          value={item.quantidade}
                          onChange={(e) => atualizarItem(index, { quantidade: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Unidade</Label>
                        <Input
                          value={item.unidade}
                          onChange={(e) => atualizarItem(index, { unidade: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Observação</Label>
                        <Input
                          placeholder="Marca, medida, especificação, urgência..."
                          value={item.observacoes}
                          onChange={(e) => atualizarItem(index, { observacoes: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {itens.length === 0 && (
                  <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
                    Pesquise um item do estoque acima para adicioná-lo à solicitação.
                  </div>
                )}
              </div>
            </div>
          )}

          {form.tipo === 'frete' && (
            <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-3">
              <div className="md:col-span-3 flex items-center gap-2 font-medium"><Truck className="h-4 w-4" /> Dados do frete</div>
              <div><Label>Origem *</Label><Input value={form.origem_frete} onChange={(e) => setForm((f) => ({ ...f, origem_frete: e.target.value }))} /></div>
              <div><Label>Destino *</Label><Input value={form.destino_frete} onChange={(e) => setForm((f) => ({ ...f, destino_frete: e.target.value }))} /></div>
              <div><Label>Volumes</Label><Input type="number" min="0" value={form.volumes} onChange={(e) => setForm((f) => ({ ...f, volumes: e.target.value }))} /></div>
              <div><Label>Peso aproximado (kg)</Label><Input value={form.peso_kg} onChange={(e) => setForm((f) => ({ ...f, peso_kg: e.target.value }))} /></div>
              <div><Label>Cubagem aproximada (m³)</Label><Input value={form.cubagem_m3} onChange={(e) => setForm((f) => ({ ...f, cubagem_m3: e.target.value }))} /></div>
            </div>
          )}

          {form.tipo === 'global' && (
            <div className="rounded-lg border p-4">
              <div className="mb-3 flex items-center gap-2 font-medium"><Globe2 className="h-4 w-4" /> Escopo do orçamento</div>
              <p className="mb-3 text-xs text-muted-foreground">Use as observações abaixo para detalhar serviço, locação, fabricação ou outro escopo global.</p>
            </div>
          )}

          <div>
            <Label>Observações / especificações</Label>
            <Textarea
              rows={4}
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              placeholder="Detalhes técnicos, marca desejada, prazo, dimensões, restrições ou qualquer informação necessária para o Almoxarifado cotar corretamente."
            />
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => void salvar()} disabled={salvando}>
              {salvando ? 'Enviando...' : 'Enviar ao Almoxarifado'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
