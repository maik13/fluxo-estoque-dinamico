import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Lightbulb, PaintBucket } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import type { ProducaoOrdemProducao } from '@/types/producao';

type TintaResumo = {
  projeto_id: string;
  projeto_nome: string;
  material_categoria: string;
  volume_previsto_ml: number;
  volume_real_ml: number;
  desvio_ml: number;
};

type LedResumo = {
  projeto_id: string;
  projeto_nome: string;
  total_previsto: number;
  total_aplicado: number;
  saldo: number;
  testes_ok: number;
  registros: number;
};

type LedRegistro = {
  id: string;
  quantidade_cordoes: number;
  origem: string | null;
  voltagem: string | null;
  especificacao: string | null;
  teste_funcional: boolean | null;
  status: string | null;
  observacoes: string | null;
  criado_por_nome_snapshot: string | null;
  created_at: string;
};

interface Props {
  ordem: ProducaoOrdemProducao;
}

const normalizar = (valor: string | null | undefined) =>
  (valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const formatarLitros = (ml: number) =>
  `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number(ml || 0) / 1000)} L`;

const ordemEhLed = (ordem: ProducaoOrdemProducao) =>
  /\b(led|pisca|ilumin)/.test(
    normalizar(`${ordem.tarefa_nome_snapshot ?? ''} ${ordem.descricao ?? ''} ${ordem.processo_nome ?? ''}`),
  );

const ordemEhPintura = (ordem: ProducaoOrdemProducao) =>
  /(pint|verniz|stain|acabamento)/.test(
    normalizar(`${ordem.tarefa_nome_snapshot ?? ''} ${ordem.descricao ?? ''} ${ordem.processo_nome ?? ''}`),
  );

export const ControlePrevistoRealOrdemProducao = ({ ordem }: Props) => {
  const { canApontarProducao } = usePermissions();
  const podeRegistrar = canApontarProducao();
  const exibirTinta = ordemEhPintura(ordem);
  const exibirLed = ordemEhLed(ordem);

  const [tinta, setTinta] = useState<TintaResumo[]>([]);
  const [led, setLed] = useState<LedResumo | null>(null);
  const [registrosLed, setRegistrosLed] = useState<LedRegistro[]>([]);
  const [quantidade, setQuantidade] = useState('');
  const [origem, setOrigem] = useState('');
  const [voltagem, setVoltagem] = useState('');
  const [especificacao, setEspecificacao] = useState('');
  const [testeFuncional, setTesteFuncional] = useState(false);
  const [status, setStatus] = useState('Em Andamento');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!exibirTinta && !exibirLed) return;

    const consultas: PromiseLike<unknown>[] = [];
    if (exibirTinta) consultas.push((supabase.rpc as any)('listar_tinta_previsto_real_v1'));
    if (exibirLed) {
      consultas.push((supabase.rpc as any)('listar_led_previsto_real_v1'));
      consultas.push(
        (supabase as any)
          .from('producao_led_registros')
          .select('id,quantidade_cordoes,origem,voltagem,especificacao,teste_funcional,status,observacoes,criado_por_nome_snapshot,created_at')
          .eq('ordem_producao_id', ordem.id)
          .order('created_at', { ascending: false }),
      );
    }

    try {
      const resultados = await Promise.all(consultas as any);
      let indice = 0;
      if (exibirTinta) {
        const resultado = resultados[indice++] as any;
        if (resultado.error) throw resultado.error;
        setTinta(
          ((resultado.data ?? []) as TintaResumo[]).filter((item) => item.projeto_id === ordem.projeto_id),
        );
      }
      if (exibirLed) {
        const resumo = resultados[indice++] as any;
        const registros = resultados[indice++] as any;
        if (resumo.error) throw resumo.error;
        if (registros.error) throw registros.error;
        setLed(
          ((resumo.data ?? []) as LedResumo[]).find((item) => item.projeto_id === ordem.projeto_id) ?? null,
        );
        setRegistrosLed((registros.data ?? []) as LedRegistro[]);
      }
    } catch (error) {
      console.error('Erro ao carregar previsto x realizado da OP:', error);
    }
  }, [exibirLed, exibirTinta, ordem.id, ordem.projeto_id]);

  useEffect(() => { void carregar(); }, [carregar]);

  const totalTinta = useMemo(
    () => tinta.reduce(
      (acc, item) => ({
        previsto: acc.previsto + Number(item.volume_previsto_ml || 0),
        real: acc.real + Number(item.volume_real_ml || 0),
      }),
      { previsto: 0, real: 0 },
    ),
    [tinta],
  );

  const registrarLed = async () => {
    const qtd = Number(quantidade.replace(',', '.'));
    if (!Number.isFinite(qtd) || qtd <= 0) {
      toast.error('Informe a quantidade de cordões aplicada.');
      return;
    }
    setSalvando(true);
    try {
      const { error } = await (supabase.rpc as any)('registrar_led_op_v1', {
        p_ordem_producao_id: ordem.id,
        p_quantidade_cordoes: qtd,
        p_origem: origem || null,
        p_voltagem: voltagem || null,
        p_especificacao: especificacao || null,
        p_teste_funcional: testeFuncional,
        p_status: status || null,
        p_observacoes: observacoes || null,
        p_apontamento_id: null,
      });
      if (error) throw error;
      toast.success('Aplicação de LED registrada na OP.');
      setQuantidade('');
      setOrigem('');
      setVoltagem('');
      setEspecificacao('');
      setTesteFuncional(false);
      setObservacoes('');
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível registrar o LED.');
    } finally {
      setSalvando(false);
    }
  };

  if (!exibirTinta && !exibirLed) return null;

  return (
    <div className="space-y-3">
      {exibirTinta && tinta.length > 0 && (
        <Card className="p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-medium">
                <PaintBucket className="h-4 w-4" />Tinta · Previsto × Realizado
              </div>
              <p className="text-xs text-muted-foreground">
                Previsão da planilha; realizado consolidado exclusivamente dos consumos registrados nas OPs.
              </p>
            </div>
            <Badge variant={totalTinta.real > totalTinta.previsto ? 'destructive' : 'secondary'}>
              {formatarLitros(totalTinta.real)} / {formatarLitros(totalTinta.previsto)}
            </Badge>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {tinta.map((item) => (
              <div key={item.material_categoria} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{item.material_categoria}</p>
                <p className="mt-1 text-xs text-muted-foreground">Previsto: {formatarLitros(item.volume_previsto_ml)}</p>
                <p className="text-xs text-muted-foreground">Real: {formatarLitros(item.volume_real_ml)}</p>
                <p className={`text-xs font-medium ${Number(item.desvio_ml) > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                  Desvio: {Number(item.desvio_ml) >= 0 ? '+' : ''}{formatarLitros(item.desvio_ml)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {exibirLed && (
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-medium">
                <Lightbulb className="h-4 w-4" />LED · Materiais + Qualidade
              </div>
              <p className="text-xs text-muted-foreground">
                O previsto é referência de planejamento. O aplicado abaixo nasce somente de registros feitos nesta Produção.
              </p>
            </div>
            {led && (
              <div className="flex gap-2">
                <Badge variant="outline">Previsto {Number(led.total_previsto || 0)}</Badge>
                <Badge variant="secondary">Aplicado {Number(led.total_aplicado || 0)}</Badge>
                <Badge variant={Number(led.saldo || 0) > 0 ? 'outline' : 'secondary'}>Saldo {Number(led.saldo || 0)}</Badge>
              </div>
            )}
          </div>

          {podeRegistrar && ordem.status !== 'cancelada' && (
            <div className="mb-4 grid gap-3 rounded-lg border bg-muted/20 p-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Qtd. cordões *</Label>
                <Input value={quantidade} onChange={(e) => setQuantidade(e.target.value)} inputMode="decimal" />
              </div>
              <div className="space-y-1.5">
                <Label>Origem</Label>
                <Select value={origem} onValueChange={setOrigem}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EST">Estoque Bambusa</SelectItem>
                    <SelectItem value="REA">Reaproveitamento / revisado</SelectItem>
                    <SelectItem value="NOV">Novo / aquisição</SelectItem>
                    <SelectItem value="RTZ">Retrabalho / manutenção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Voltagem</Label><Input value={voltagem} onChange={(e) => setVoltagem(e.target.value)} placeholder="Ex.: 220V" /></div>
              <div className="space-y-1.5"><Label>Especificação</Label><Input value={especificacao} onChange={(e) => setEspecificacao(e.target.value)} placeholder="Ex.: BQS / GOLD" /></div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Em Andamento">Em andamento</SelectItem>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Concluído">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <Checkbox checked={testeFuncional} onCheckedChange={(valor) => setTesteFuncional(valor === true)} />
                Teste funcional OK
              </label>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Observações / detalhes</Label>
                <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
              </div>
              <div className="md:col-span-2 xl:col-span-4">
                <Button size="sm" onClick={() => void registrarLed()} disabled={salvando}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />Registrar aplicação / teste
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {registrosLed.map((registro) => (
              <div key={registro.id} className="flex flex-col gap-1 rounded-md border px-3 py-2 text-xs md:flex-row md:items-center md:justify-between">
                <div>
                  <span className="font-semibold">{Number(registro.quantidade_cordoes)} cordões</span>
                  <span className="text-muted-foreground"> · {registro.origem ?? 'origem não informada'} · {registro.voltagem ?? 'voltagem não informada'} · {registro.especificacao ?? 'sem especificação'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={registro.teste_funcional ? 'secondary' : 'outline'}>
                    {registro.teste_funcional ? 'Teste OK' : 'Teste pendente'}
                  </Badge>
                  <span className="text-muted-foreground">{new Date(registro.created_at).toLocaleString('pt-BR')}</span>
                </div>
              </div>
            ))}
            {registrosLed.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma aplicação de LED registrada nesta OP.</p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
