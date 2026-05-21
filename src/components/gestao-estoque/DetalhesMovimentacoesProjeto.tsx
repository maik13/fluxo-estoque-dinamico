import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowDownCircle, ArrowUpCircle, Pencil, Trash2, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { isAcertoDeEstoque } from '@/utils/movimentacoes';

interface DetalhesMovimentacoesProjetoProps {
  movimentacoes: any[];
}

export const DetalhesMovimentacoesProjeto = ({ movimentacoes }: DetalhesMovimentacoesProjetoProps) => {
  const [movimentoEditando, setMovimentoEditando] = useState<any | null>(null);
  const [novoLocalId, setNovoLocalId] = useState<string>('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  
  const { locaisUtilizacao } = useConfiguracoes();
  const { user } = useAuth();
  const { toast } = useToast();

  const locaisAtivos = locaisUtilizacao.filter(l => l.ativo || (l as any).status === 'Ativo' || (l as any).status === 'ativo');

  const isDevolucao = (mov: any) => mov.tipo === 'ENTRADA' && mov.observacoes?.toLowerCase().includes('devolu');

  const getTipoInfo = (mov: any) => {
    if (isDevolucao(mov)) {
      return { icon: <RotateCcw className="h-4 w-4" />, color: 'text-info', bgColor: 'bg-info/10', label: 'Devolução' };
    }
    if (mov.tipo === 'SAIDA') {
      if (isAcertoDeEstoque(mov)) {
        return { icon: <ArrowDownCircle className="h-4 w-4" />, color: 'text-orange-500', bgColor: 'bg-orange-500/10', label: 'Saída para acerto' };
      }
      return { icon: <ArrowDownCircle className="h-4 w-4" />, color: 'text-warning', bgColor: 'bg-warning/10', label: 'Saída' };
    }
    return { icon: <ArrowUpCircle className="h-4 w-4" />, color: 'text-success', bgColor: 'bg-success/10', label: 'Entrada' };
  };

  const formatarDataHora = (dataStr: string) => {
    const date = new Date(dataStr);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const handleSalvarEdicaoDestino = async () => {
    if (!movimentoEditando || !novoLocalId) return;
    
    setSalvandoEdicao(true);
    try {
      const localSelecionado = locaisAtivos.find(l => l.id === novoLocalId);
      
      const { error } = await supabase
        .from('movements')
        .update({ local_utilizacao_id: novoLocalId })
        .eq('id', movimentoEditando.id);
        
      if (error) throw error;
      
      // Log de auditoria
      await (supabase as any).from('action_logs').insert({
        user_id: user?.id,
        action: 'EDICAO_DESTINO_MOVIMENTACAO',
        entity_type: 'movements',
        entity_id: movimentoEditando.id,
        details: {
          antigo_local_id: movimentoEditando.localUtilizacaoId,
          novo_local_id: novoLocalId,
          novo_local_nome: localSelecionado?.nome,
        }
      });
      
      toast({ title: "Destino atualizado", description: "O local de destino da movimentação foi alterado." });
      setMovimentoEditando(null);
    } catch (error: any) {
      console.error('Erro ao atualizar destino:', error);
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const excluirMovimentacao = async (movId: string) => {
    try {
      const { error } = await supabase.from('movements').delete().eq('id', movId);
      if (error) throw error;
      toast({ title: "Movimentação excluída", description: "O registro foi removido com sucesso." });
    } catch (error: any) {
      console.error('Erro ao excluir movimentação:', error);
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    }
  };

  // Ordenar as movimentações para mostrar as mais recentes primeiro
  const movimentacoesOrdenadas = [...movimentacoes].sort((a, b) => 
    new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime()
  );

  return (
    <div className="p-4 bg-muted/30 border border-muted rounded-md my-2 mx-8 shadow-inner">
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
        Histórico Detalhado deste Item neste Projeto
      </h4>
      <Table className="bg-background rounded-md overflow-hidden">
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="h-8 text-xs w-[180px]">Tipo</TableHead>
            <TableHead className="h-8 text-xs">Data/Hora</TableHead>
            <TableHead className="h-8 text-xs">Qtd</TableHead>
            <TableHead className="h-8 text-xs">Responsável / Solicitante</TableHead>
            <TableHead className="h-8 text-xs">Observações</TableHead>
            <TableHead className="h-8 text-xs w-[100px] text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movimentacoesOrdenadas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-4 text-muted-foreground text-xs">
                Nenhuma movimentação registrada.
              </TableCell>
            </TableRow>
          ) : (
            movimentacoesOrdenadas.map((mov) => {
              const tipoInfo = getTipoInfo(mov);
              return (
                <TableRow key={mov.id}>
                  <TableCell>
                    <div className={`flex items-center gap-1 text-xs font-medium ${tipoInfo.color}`}>
                      {tipoInfo.icon} {tipoInfo.label}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{formatarDataHora(mov.dataHora)}</TableCell>
                  <TableCell className="text-xs font-bold font-mono">
                    {mov.tipo === 'SAIDA' ? '-' : '+'}{mov.quantidade} {mov.itemSnapshot?.unidade}
                  </TableCell>
                  <TableCell className="text-xs">
                    {mov.destinatario || mov.solicitanteNome || '-'}
                  </TableCell>
                  <TableCell className="text-[10px] text-muted-foreground max-w-[200px] truncate">
                    {mov.observacoes || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMovimentoEditando(mov);
                          setNovoLocalId(mov.local_utilizacao_id || '');
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => e.stopPropagation()}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir movimentação?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Deseja realmente excluir esta movimentação? Essa ação irá alterar os saldos.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => excluirMovimentacao(mov.id)} className="bg-destructive hover:bg-destructive/90 text-white">
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <Dialog open={!!movimentoEditando} onOpenChange={(open) => !open && setMovimentoEditando(null)}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Editar Destino</DialogTitle>
            <DialogDescription>
              Mova esta movimentação para outro Projeto/Local.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Select value={novoLocalId} onValueChange={setNovoLocalId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um local" />
              </SelectTrigger>
              <SelectContent>
                {locaisAtivos.map(local => (
                  <SelectItem key={local.id} value={local.id}>
                    {local.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovimentoEditando(null)}>Cancelar</Button>
            <Button onClick={handleSalvarEdicaoDestino} disabled={salvandoEdicao || !novoLocalId}>
              {salvandoEdicao ? "Salvando..." : "Salvar Alteração"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
