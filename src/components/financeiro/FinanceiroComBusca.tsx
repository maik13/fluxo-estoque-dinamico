import { useEffect, useMemo, useState } from 'react';
import { RefreshCcw, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Financeiro } from './Financeiro';

type Registro = Record<string, any>;

const moeda = (valor: any) => {
  const numero = Number(valor);
  if (valor == null || valor === '' || Number.isNaN(numero)) return 'A definir';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numero);
};

const dataHoraPt = (valor?: string | null) => {
  if (!valor) return '—';
  try {
    return new Date(valor).toLocaleString('pt-BR');
  } catch {
    return valor;
  }
};

const normalizarCor = (valor?: string | null) => {
  if (!valor) return null;
  const cor = String(valor).trim();
  if (/^#[0-9a-f]{6}$/i.test(cor)) return cor.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(cor)) {
    const r = cor[1];
    const g = cor[2];
    const b = cor[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return null;
};

const corComAlpha = (valor?: string | null, alpha = 0.16) => {
  const cor = normalizarCor(valor);
  if (!cor) return undefined;
  const r = parseInt(cor.slice(1, 3), 16);
  const g = parseInt(cor.slice(3, 5), 16);
  const b = parseInt(cor.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const textoBusca = (registro: Registro) => [
  registro.numero,
  registro.descricao,
  registro.observacoes,
  registro.categoria,
  registro.subcategoria,
  registro.status,
  registro.planilha_linha,
  registro.pagina54_integracao_id,
  registro.pagina54_ultima_origem,
  registro.pagina54_sync_status,
  registro.pagina54_sync_erro,
].filter(Boolean).join(' ').toLowerCase();

export const FinanceiroComBusca = () => {
  const [busca, setBusca] = useState('');
  const [lancamentosPagina54, setLancamentosPagina54] = useState<Registro[]>([]);
  const [carregando, setCarregando] = useState(false);

  const carregarLancamentosPagina54 = async () => {
    setCarregando(true);
    try {
      const { data, error } = await (supabase as any)
        .from('financeiro_lancamentos')
        .select('id,numero,tipo,status,descricao,observacoes,categoria,subcategoria,data_prevista,data_realizada,valor_previsto,valor_realizado,planilha_linha,pagina54_integracao_id,pagina54_ultima_origem,pagina54_sync_status,pagina54_sync_erro,pagina54_sync_em,sinalizacao_cor')
        .eq('origem_tipo', 'pagina54')
        .order('pagina54_sync_em', { ascending: false, nullsFirst: false })
        .limit(500);
      if (error) throw error;
      setLancamentosPagina54(data ?? []);
    } catch (error) {
      console.error('Erro ao carregar lançamentos da Página54:', error);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregarLancamentosPagina54();
  }, []);

  const resultados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return lancamentosPagina54.slice(0, 12);
    return lancamentosPagina54.filter((registro) => textoBusca(registro).includes(termo)).slice(0, 50);
  }, [busca, lancamentosPagina54]);

  useEffect(() => {
    const aplicarSinalizacao = () => {
      const linhas = document.querySelectorAll<HTMLTableRowElement>('#financeiro-original table tbody tr');
      const coloridos = lancamentosPagina54
        .map((lancamento) => ({
          ...lancamento,
          cor: normalizarCor(lancamento.sinalizacao_cor),
          descricaoBusca: String(lancamento.descricao || lancamento.observacoes || '').trim(),
        }))
        .filter((lancamento) => lancamento.cor && lancamento.descricaoBusca);

      linhas.forEach((linha) => {
        linha.style.backgroundColor = '';
        linha.style.boxShadow = '';
        linha.style.outline = '';
        linha.style.outlineOffset = '';

        const textoLinha = (linha.textContent || '').toLowerCase();
        const colorido = coloridos.find((lancamento) => textoLinha.includes(lancamento.descricaoBusca.toLowerCase()));
        if (colorido?.cor) {
          linha.style.backgroundColor = corComAlpha(colorido.cor, 0.18) || '';
          linha.style.boxShadow = `inset 4px 0 0 ${colorido.cor}`;
        }

        const termo = busca.trim().toLowerCase();
        if (termo && textoLinha.includes(termo)) {
          linha.style.outline = '2px solid hsl(var(--primary))';
          linha.style.outlineOffset = '-2px';
        }
      });
    };

    aplicarSinalizacao();
    const alvo = document.getElementById('financeiro-original');
    if (!alvo) return undefined;

    const observer = new MutationObserver(aplicarSinalizacao);
    observer.observe(alvo, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [busca, lancamentosPagina54]);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="gap-3 sm:flex sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Busca do Financeiro / Página54</CardTitle>
            <CardDescription>
              Localiza lançamentos importados da planilha histórica e exibe a origem, linha, status de sincronização e cor sinalizada.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void carregarLancamentosPagina54()} disabled={carregando}>
            <RefreshCcw className="mr-2 h-4 w-4" />Atualizar
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar por descrição, anotação, nº do lançamento, linha da Página54, categoria, status ou ID de integração"
              className="pl-9"
            />
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lançamento</TableHead>
                  <TableHead>Linha Página54</TableHead>
                  <TableHead>Descrição / anotação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Sync</TableHead>
                  <TableHead>Cor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      Nenhum lançamento encontrado na Página54.
                    </TableCell>
                  </TableRow>
                ) : resultados.map((registro) => {
                  const cor = normalizarCor(registro.sinalizacao_cor);
                  return (
                    <TableRow key={registro.id} style={{ backgroundColor: corComAlpha(cor, 0.12) }}>
                      <TableCell className="font-medium">#{registro.numero || '—'}</TableCell>
                      <TableCell>{registro.planilha_linha || '—'}</TableCell>
                      <TableCell className="min-w-[280px]">
                        <div className="font-medium">{registro.descricao || '—'}</div>
                        {registro.observacoes && registro.observacoes !== registro.descricao && (
                          <div className="text-xs text-muted-foreground">{registro.observacoes}</div>
                        )}
                      </TableCell>
                      <TableCell><Badge variant="outline">{registro.status || '—'}</Badge></TableCell>
                      <TableCell className="text-right">{moeda(registro.valor_realizado ?? registro.valor_previsto)}</TableCell>
                      <TableCell>{registro.pagina54_ultima_origem || '—'}</TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <div>{registro.pagina54_sync_status || '—'}</div>
                          <div className="text-muted-foreground">{dataHoraPt(registro.pagina54_sync_em)}</div>
                          {registro.pagina54_sync_erro && <div className="text-destructive">{registro.pagina54_sync_erro}</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {cor ? (
                          <span className="inline-flex items-center gap-2 text-xs">
                            <span className="h-4 w-4 rounded border" style={{ backgroundColor: cor }} />
                            {cor}
                          </span>
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div id="financeiro-original">
        <Financeiro />
      </div>
    </div>
  );
};
