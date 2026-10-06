import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

export type EstrategiaAtendimento = 'acervo' | 'transformacao' | 'composicao' | 'producao_nova';

export type ItemConfiguracaoPlanejamento = {
  id: string;
  nome: string;
  estrategiaAtendimento: EstrategiaAtendimento;
};

type Componente = {
  id: string;
  codigo_barras: number;
  nome: string;
  catalogo_ano: number | null;
  especificacoes_dimensoes: string | null;
  quantidade_por_unidade: number;
};

type ItemBusca = {
  id: string;
  codigo_barras: number;
  nome: string;
  catalogo_ano: number | null;
  especificacoes_dimensoes: string | null;
};

type Props = {
  item: ItemConfiguracaoPlanejamento | null;
  onClose: () => void;
  onSaved: () => void;
};

const numero = (valor: unknown) => Number(valor || 0);

export const PlanejamentoComposicaoDialog = ({ item, onClose, onSaved }: Props) => {
  const [estrategia, setEstrategia] = useState<EstrategiaAtendimento>('producao_nova');
  const [componentes, setComponentes] = useState<Componente[]>([]);
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<ItemBusca[]>([]);
  const [origemId, setOrigemId] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    if (!item) return;
    const { data, error } = await (supabase.rpc as any)('listar_composicao_planejamento_v1', {
      p_planejamento_item_id: item.id,
    });
    if (error) throw error;
    setComponentes((data ?? []) as Componente[]);
  };

  useEffect(() => {
    if (!item) return;
    setEstrategia(item.estrategiaAtendimento);
    setBusca('');
    setResultados([]);
    setOrigemId('');
    setQuantidade('1');
    void carregar().catch((error) => toast.error(error.message));
  }, [item?.id]);

  useEffect(() => {
    if (!item || busca.trim().length < 2) {
      setResultados([]);
      return;
    }
    let cancelado = false;
    const timer = window.setTimeout(async () => {
      const { data, error } = await (supabase.rpc as any)('buscar_itens_composicao_planejamento_v1', {
        p_busca: busca.trim(),
        p_limite: 30,
      });
      if (!cancelado) {
        if (error) toast.error(error.message);
        else setResultados((data ?? []) as ItemBusca[]);
      }
    }, 250);
    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [busca, item?.id]);

  const alterarEstrategia = async (valor: EstrategiaAtendimento) => {
    if (!item) return;
    setSalvando(true);
    try {
      const { error } = await (supabase.rpc as any)('salvar_estrategia_planejamento_item_v1', {
        p_planejamento_item_id: item.id,
        p_estrategia: valor,
      });
      if (error) throw error;
      setEstrategia(valor);
      onSaved();
      toast.success('Estratégia atualizada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar estratégia.');
    } finally {
      setSalvando(false);
    }
  };

  const adicionar = async () => {
    if (!item || !origemId) return;
    const qtd = Number(quantidade.replace(',', '.'));
    if (!Number.isFinite(qtd) || qtd <= 0) {
      toast.error('Informe uma quantidade maior que zero.');
      return;
    }
    setSalvando(true);
    try {
      const { error } = await (supabase.rpc as any)('salvar_componente_planejamento_v1', {
        p_planejamento_item_id: item.id,
        p_item_origem_id: origemId,
        p_quantidade_por_unidade: qtd,
        p_observacoes: null,
      });
      if (error) throw error;
      setOrigemId('');
      setBusca('');
      setResultados([]);
      setQuantidade('1');
      await carregar();
      onSaved();
      toast.success('Item de origem vinculado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao vincular item.');
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (id: string) => {
    setSalvando(true);
    try {
      const { error } = await (supabase.rpc as any)('remover_componente_planejamento_v1', {
        p_composicao_id: id,
      });
      if (error) throw error;
      await carregar();
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover componente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Composição da peça</DialogTitle>
          <DialogDescription>{item?.nome}</DialogDescription>
        </DialogHeader>

        {item && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Como esta peça será atendida?</Label>
              <Select value={estrategia} onValueChange={(v) => void alterarEstrategia(v as EstrategiaAtendimento)} disabled={salvando}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="acervo">Usar diretamente do acervo</SelectItem>
                  <SelectItem value="transformacao">Transformar item existente</SelectItem>
                  <SelectItem value="composicao">Compor com itens existentes</SelectItem>
                  <SelectItem value="producao_nova">Produção nova</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(estrategia === 'transformacao' || estrategia === 'composicao') && (
              <div className="space-y-4 rounded-lg border p-4">
                <div>
                  <p className="font-medium">{estrategia === 'transformacao' ? 'Item que será transformado' : 'Itens que compõem esta peça'}</p>
                  <p className="text-xs text-muted-foreground">Busque no cadastro oficial do almoxarifado. Esta parametrização define a composição da peça; ela não define a quantidade destinada a cada cidade.</p>
                </div>

                <div className="space-y-2">
                  <Label>Buscar item de origem</Label>
                  <Input value={busca} onChange={(e) => { setBusca(e.target.value); setOrigemId(''); }} placeholder="Nome ou código do item..." />
                  {resultados.length > 0 && (
                    <SearchableSelect
                      value={origemId}
                      onValueChange={setOrigemId}
                      placeholder="Selecione a referência"
                      searchPlaceholder="Filtrar..."
                      options={resultados.map((r) => ({
                        value: r.id,
                        label: `${r.codigo_barras} · ${r.nome}${r.catalogo_ano ? ` · ${r.catalogo_ano}` : ''}${r.especificacoes_dimensoes ? ` · ${r.especificacoes_dimensoes}` : ''}`,
                      }))}
                    />
                  )}
                </div>

                <div className="flex items-end gap-2">
                  <div className="w-40 space-y-2">
                    <Label>Qtd. do item de origem por 1 peça final</Label>
                    <Input value={quantidade} onChange={(e) => setQuantidade(e.target.value)} inputMode="decimal" />
                  </div>
                  <Button onClick={() => void adicionar()} disabled={!origemId || salvando}><Plus className="mr-2 h-4 w-4" />Adicionar</Button>
                </div>

                <div className="space-y-2">
                  {componentes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum item de origem configurado.</p>
                  ) : componentes.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                      <div>
                        <p className="font-medium">{c.codigo_barras} · {c.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.catalogo_ano ? `Catálogo ${c.catalogo_ano} · ` : ''}{numero(c.quantidade_por_unidade)} por unidade
                          {c.especificacoes_dimensoes ? ` · ${c.especificacoes_dimensoes}` : ''}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => void remover(c.id)} disabled={salvando}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {estrategia === 'acervo' && <p className="rounded-lg border p-4 text-sm text-muted-foreground">Esta peça será atendida diretamente pelo acervo vinculado.</p>}
            {estrategia === 'producao_nova' && <p className="rounded-lg border p-4 text-sm text-muted-foreground">Esta peça será produzida como nova, sem consumir uma peça cenográfica existente.</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
