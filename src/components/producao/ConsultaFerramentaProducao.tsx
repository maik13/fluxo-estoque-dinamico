import { useRef, useState, type FormEvent } from 'react';
import { Loader2, Search, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { formatarErroSupabase } from '@/utils/supabaseError';

interface Movimento {
  id: string; tipo: string; quantidade: number; data_hora: string;
  numero: number | null; tipo_operacao: string | null; solicitante: string | null;
  registrado_por: string | null; projeto_destino: string | null; destino: string | null;
  peca: string | null; etapa: string | null; op_numero: number | null;
  estoque: string | null; observacoes: string | null;
}
interface Retirada {
  movement_id: string; devolvida: number; pendente: number;
  situacao: 'devolvida' | 'parcial' | 'pendente' | 'nao_confirmada';
}
interface Resultado {
  item: { codigo: string; nome: string; foto: string | null; unidade: string; ativo: boolean } | null;
  movimentacoes: Movimento[]; retiradas: Retirada[];
}
const situacoes = {
  devolvida: 'Devolução concluída',
  parcial: 'Devolução parcial',
  pendente: 'Devolução pendente',
  nao_confirmada: 'Devolução não confirmada',
};
const data = (valor: string) => new Date(valor).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const quantidade = (valor: number) => Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 4 });
const operacao = (m: Movimento) => m.tipo_operacao === 'devolucao' || m.observacoes?.startsWith('Devolução')
  ? 'Devolução' : m.tipo_operacao === 'retirada' || m.observacoes?.startsWith('Retirada')
    ? 'Retirada' : m.tipo === 'ENTRADA' ? 'Entrada' : m.tipo === 'SAIDA' ? 'Saída' : m.tipo;

export const ConsultaFerramentaProducao = () => {
  const [codigo, setCodigo] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [pagina, setPagina] = useState(0);
  const ocupado = useRef(false);

  const buscar = async (event: FormEvent) => {
    event.preventDefault();
    if (ocupado.current) return;
    setErro(null);
    if (!/^[0-9]{1,18}$/.test(codigo.trim())) {
      setErro('Digite um código de barras numérico válido.');
      return;
    }
    ocupado.current = true;
    setBuscando(true);
    setResultado(null);
    setPagina(0);
    try {
      const { data: retorno, error } = await (supabase.rpc as any)('consultar_ferramenta_producao_v1', { p_codigo: codigo.trim() });
      if (error) throw error;
      if (!retorno || !Array.isArray(retorno.movimentacoes) || !Array.isArray(retorno.retiradas)) {
        throw new Error('O servidor não confirmou o resultado da consulta.');
      }
      setResultado(retorno as Resultado);
      setAberto(true);
    } catch (error) {
      setErro(formatarErroSupabase(error, 'Não foi possível consultar a ferramenta. Tente novamente.'));
    } finally {
      ocupado.current = false;
      setBuscando(false);
    }
  };
  const item = resultado?.item;
  const eventos = resultado?.movimentacoes ?? [];
  const ultima = eventos[0];
  const retiradas = resultado?.retiradas ?? [];
  const pendentes = retiradas.filter((r) => r.situacao === 'pendente' || r.situacao === 'parcial');
  const incertas = retiradas.filter((r) => r.situacao === 'nao_confirmada');
  const paginas = Math.ceil(eventos.length / 20);

  return (
    <section className="rounded-xl border bg-card p-4">
      <form onSubmit={buscar} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <label htmlFor="codigo-ferramenta-producao" className="flex items-center gap-2 text-sm font-semibold">
            <Wrench className="h-4 w-4" />Consultar ferramenta
          </label>
          <p className="text-xs text-muted-foreground">Consulte quem retirou, o projeto e o histórico de devoluções pelo código de barras.</p>
          <Input id="codigo-ferramenta-producao" inputMode="numeric" autoComplete="off"
            placeholder="Digite ou leia o código da ferramenta" value={codigo}
            onChange={(event) => setCodigo(event.target.value)} disabled={buscando} maxLength={18} />
        </div>
        <Button type="submit" disabled={buscando || !codigo.trim()}>
          {buscando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          {buscando ? 'Buscando...' : 'Buscar'}
        </Button>
      </form>
      {erro && <p role="alert" className="mt-3 text-sm text-destructive">{erro}</p>}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{item ? `Ferramenta ${item.codigo} — ${item.nome}` : 'Ferramenta não encontrada'}</DialogTitle>
            <DialogDescription>
              {item ? 'Retiradas e devoluções registradas no almoxarifado.' : 'Nenhum item corresponde ao código informado.'}
            </DialogDescription>
          </DialogHeader>
          {item && (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                {item.foto && <img src={item.foto} alt={item.nome} className="h-20 w-20 rounded-lg border object-contain"
                  onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
                <div className="space-y-1 text-sm">
                  {!item.ativo && <Badge variant="secondary">Cadastro inativo</Badge>}
                  <p>{pendentes.length} retirada(s) com devolução pendente ou parcial confirmada pelo vínculo.</p>
                  {ultima && <p className="text-muted-foreground">Última movimentação: {operacao(ultima)} · {data(ultima.data_hora)}</p>}
                </div>
              </div>
              {incertas.length > 0 && (
                <p role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  Há devoluções sem vínculo com a retirada original ou retiradas sem solicitação.
                  O histórico aparece abaixo, mas esses registros não permitem confirmar quem está com a ferramenta.
                </p>
              )}
              <div className="space-y-3">
                <h3 className="font-semibold">Retiradas ({retiradas.length})</h3>
                {retiradas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma retirada registrada.</p>}
                {retiradas.map((r) => {
                  const m = eventos.find((evento) => evento.id === r.movement_id);
                  if (!m) return null;
                  return (
                    <article key={r.movement_id} className="rounded-lg border p-3 text-sm">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">{m.solicitante ?? 'Quem retirou não registrado'}</p>
                        <Badge variant={r.situacao === 'pendente' || r.situacao === 'parcial' ? 'destructive' : 'secondary'}>{situacoes[r.situacao]}</Badge>
                      </div>
                      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                        <div><dt className="inline text-muted-foreground">Retirada: </dt><dd className="inline">{data(m.data_hora)}</dd></div>
                        <div><dt className="inline text-muted-foreground">Solicitação: </dt><dd className="inline">{m.numero ? `#${m.numero}` : 'Não registrada'}</dd></div>
                        <div><dt className="inline text-muted-foreground">Projeto / destino: </dt><dd className="inline">{m.projeto_destino ?? 'Não registrado'}</dd></div>
                        <div><dt className="inline text-muted-foreground">Peça / OP: </dt><dd className="inline">{m.peca ?? 'Peça não registrada'}{m.op_numero ? ` · OP ${m.op_numero}` : ' · OP não registrada'}</dd></div>
                        <div><dt className="inline text-muted-foreground">Etapa: </dt><dd className="inline">{m.etapa ?? 'Não registrada'}</dd></div>
                        <div><dt className="inline text-muted-foreground">Estoque: </dt><dd className="inline">{m.estoque ?? 'Não registrado'}</dd></div>
                      </dl>
                      <p className="mt-2">Retirado: {quantidade(m.quantidade)} {item.unidade} · Devolvido com vínculo: {quantidade(r.devolvida)} {item.unidade}
                        {r.situacao !== 'nao_confirmada' && ` · Pendente: ${quantidade(r.pendente)} ${item.unidade}`}</p>
                    </article>
                  );
                })}
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">Histórico completo ({eventos.length} movimentações)</h3>
                {eventos.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada para esta ferramenta.</p>}
                {eventos.slice(pagina * 20, (pagina + 1) * 20).map((m) => (
                  <div key={m.id} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">{operacao(m)} · {quantidade(m.quantidade)} {item.unidade} · {data(m.data_hora)}</p>
                    <p>{m.solicitante ?? 'Solicitante não registrado'} · {m.projeto_destino ?? 'Projeto / destino não registrado'}{m.numero ? ` · #${m.numero}` : ''}</p>
                    <p className="text-xs text-muted-foreground">Registrado por: {m.registrado_por ?? 'Não registrado'}</p>
                    {m.observacoes && <p className="mt-1 break-words text-xs text-muted-foreground">{m.observacoes}</p>}
                  </div>
                ))}
                {paginas > 1 && <div className="flex items-center justify-between gap-2">
                  <Button variant="outline" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
                  <span className="text-xs">Página {pagina + 1} de {paginas}</span>
                  <Button variant="outline" disabled={pagina + 1 >= paginas} onClick={() => setPagina((p) => p + 1)}>Próxima</Button>
                </div>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};
