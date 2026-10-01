import { useEffect, useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import type { ProducaoProjeto } from '@/types/producao';

interface Resumo { nome: string; etapas: number; ops: number; apontamentos: number; jornadas: number; }
export const ExcluirProjetoProducao = ({ projeto, onSuccess }: { projeto: ProducaoProjeto; onSuccess: () => Promise<void> }) => {
  const [aberto, setAberto] = useState(false);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;
    setResumo(null); setErro(null); setConfirmacao('');
    void (async () => {
      const { data, error } = await (supabase.rpc as any)('resumo_exclusao_projeto_producao_v1', { p_projeto_id: projeto.id });
      if (cancelado) return;
      if (error) setErro(error.message || 'Não foi possível verificar os registros vinculados.');
      else setResumo(data);
    })();
    return () => { cancelado = true; };
  }, [aberto, projeto.id]);
  const excluir = async () => {
    if (excluindo || !resumo || confirmacao.trim() !== resumo.nome.trim()) return;
    setExcluindo(true);
    try {
      const { error } = await (supabase.rpc as any)('excluir_projeto_producao_v1', {
        p_projeto_id: projeto.id, p_nome_confirmacao: confirmacao,
      });
      if (error) throw error;
      toast.success('Projeto e registros de produção excluídos. Planejamento preservado.');
      setAberto(false);
      await onSuccess();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível excluir o projeto.');
    } finally { setExcluindo(false); }
  };
  return <>
    <Button size="sm" variant="outline" className="text-destructive" onClick={() => setAberto(true)} aria-label={`Excluir projeto ${projeto.nome}`}>
      <Trash2 className="mr-1.5 h-4 w-4" /> Excluir projeto
    </Button>
    <Dialog open={aberto} onOpenChange={(valor) => { if (!excluindo) setAberto(valor); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Excluir projeto da Produção</DialogTitle>
          <DialogDescription>O projeto sairá da aba Projetos e do Gerencial. Seus registros operacionais de produção serão removidos definitivamente.</DialogDescription>
        </DialogHeader>
        <p className="font-semibold">{projeto.nome}</p>
        {erro ? <p className="text-sm text-destructive" role="alert">{erro}</p> : !resumo ? (
          <p className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Verificando registros...</p>
        ) : <>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <p className="rounded border p-3">Etapas: <strong>{resumo.etapas}</strong></p>
            <p className="rounded border p-3">OPs: <strong>{resumo.ops}</strong></p>
            <p className="rounded border p-3">Apontamentos: <strong>{resumo.apontamentos}</strong></p>
            <p className="rounded border p-3">Jornadas de trabalho: <strong>{resumo.jornadas}</strong></p>
          </div>
          <p className="rounded border border-destructive/40 p-3 text-sm">Também serão removidos os materiais de PCP das etapas e OPs, consumos, anexos e eventos de produção vinculados. Esta ação não pode ser desfeita pela tela.</p>
          <p className="text-sm text-muted-foreground">O Planejamento, o acervo, as movimentações de estoque e os registros financeiros permanecem preservados. O sistema mantém um registro administrativo da exclusão.</p>
          <label className="space-y-2 text-sm">
            <span>Para confirmar, digite o nome do projeto: <strong>{resumo.nome.trim()}</strong></span>
            <Input value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} disabled={excluindo} autoComplete="off" />
          </label>
        </>}
        <DialogFooter>
          <Button variant="outline" disabled={excluindo} onClick={() => setAberto(false)}>Manter projeto</Button>
          <Button variant="destructive" disabled={!resumo || !!erro || excluindo || confirmacao.trim() !== resumo.nome.trim()} onClick={() => void excluir()}>
            {excluindo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Excluir projeto e registros
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
};
