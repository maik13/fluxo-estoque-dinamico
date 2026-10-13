import { useState } from 'react';
import { ReceiptText, Plus, Trash2, Truck, Package, Globe2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
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
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ ...vazio });
  const [itens, setItens] = useState<ItemSolicitado[]>([
    { descricao: '', quantidade: '', unidade: 'un', observacoes: '' },
  ]);

  const limpar = () => {
    setForm({ ...vazio });
    setItens([{ descricao: '', quantidade: '', unidade: 'un', observacoes: '' }]);
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
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 font-medium"><TipoIcon className="h-4 w-4" /> Materiais necessários</div>
                  <p className="text-xs text-muted-foreground">Informe descrição, quantidade e unidade. Não precisa informar preço.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setItens((current) => [...current, { descricao: '', quantidade: '', unidade: 'un', observacoes: '' }])}
                >
                  <Plus className="mr-2 h-4 w-4" /> Item
                </Button>
              </div>

              {itens.map((item, index) => (
                <div key={index} className="grid gap-2 md:grid-cols-[2fr_100px_90px_1.2fr_40px]">
                  <Input
                    placeholder="Material / especificação"
                    value={item.descricao}
                    onChange={(e) => atualizarItem(index, { descricao: e.target.value })}
                  />
                  <Input
                    placeholder="Qtd."
                    value={item.quantidade}
                    onChange={(e) => atualizarItem(index, { quantidade: e.target.value })}
                  />
                  <Input
                    placeholder="Un."
                    value={item.unidade}
                    onChange={(e) => atualizarItem(index, { unidade: e.target.value })}
                  />
                  <Input
                    placeholder="Observação"
                    value={item.observacoes}
                    onChange={(e) => atualizarItem(index, { observacoes: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={itens.length === 1}
                    onClick={() => setItens((current) => current.filter((_, idx) => idx !== index))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
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
