import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { useProcessosProducao } from '@/hooks/useProcessosProducao';
import { useProjetosProducao } from '@/hooks/useProjetosProducao';
import type { ProducaoPrioridade } from '@/types/producao';

interface FormProps { onSuccess: () => void; }
interface FormData {
  projeto_id: string;
  codigo: string;
  nome: string;
  descricao: string;
  prioridade: ProducaoPrioridade;
  produto_entregavel: string;
  unidade_medida: string;
  quantidade_planejada: string;
}

export const FormProcessoProducao = ({ onSuccess }: FormProps) => {
  const [aberto, setAberto] = useState(false);
  const { criarProcesso } = useProcessosProducao();
  const { projetos, listarProjetos } = useProjetosProducao();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: { prioridade: 'normal' },
  });

  useEffect(() => {
    if (aberto) void listarProjetos(true);
  }, [aberto, listarProjetos]);

  const projetoId = watch('projeto_id');
  const prioridade = watch('prioridade');

  const onSubmit = async (data: FormData) => {
    try {
      const quantidade = data.quantidade_planejada.trim()
        ? Number(data.quantidade_planejada.replace(',', '.'))
        : null;
      if (quantidade !== null && (!Number.isFinite(quantidade) || quantidade < 0)) {
        throw new Error('Quantidade planejada inválida.');
      }
      await criarProcesso({
        projeto_id: data.projeto_id,
        codigo: data.codigo || null,
        nome: data.nome,
        descricao: data.descricao || null,
        prioridade: data.prioridade,
        produto_entregavel: data.produto_entregavel || null,
        unidade_medida: data.unidade_medida || null,
        quantidade_planejada: quantidade,
      });
      reset({ prioridade: 'normal' });
      setAberto(false);
      onSuccess();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao salvar processo');
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild><Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />Novo Processo</Button></DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader><DialogTitle>Novo Processo de Produção</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Projeto *</Label>
            <Select value={projetoId} onValueChange={(v) => setValue('projeto_id', v, { shouldValidate: true })}>
              <SelectTrigger><SelectValue placeholder="Selecione um projeto" /></SelectTrigger>
              <SelectContent>{projetos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}{p.cidade ? ` · ${p.cidade}/${p.uf ?? ''}` : ''}</SelectItem>)}</SelectContent>
            </Select>
            <input type="hidden" {...register('projeto_id', { required: true })} />
            {errors.projeto_id && <span className="text-sm text-destructive">Projeto obrigatório</span>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="codigo">Código opcional</Label><Input id="codigo" placeholder="Gerado automaticamente" {...register('codigo')} /></div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={(v) => setValue('prioridade', v as ProducaoPrioridade)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2"><Label htmlFor="nome">Nome *</Label><Input id="nome" {...register('nome', { required: 'Nome obrigatório' })} />{errors.nome && <span className="text-sm text-destructive">{errors.nome.message}</span>}</div>
          <div className="space-y-2"><Label htmlFor="descricao">Descrição</Label><Input id="descricao" {...register('descricao')} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="produto_entregavel">Produto/entregável</Label><Input id="produto_entregavel" {...register('produto_entregavel')} /></div>
            <div className="space-y-2"><Label htmlFor="unidade_medida">Unidade</Label><Input id="unidade_medida" placeholder="peças, m²..." {...register('unidade_medida')} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="quantidade_planejada">Quantidade planejada</Label><Input id="quantidade_planejada" inputMode="decimal" {...register('quantidade_planejada')} /></div>
          <div className="flex justify-end pt-4"><Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar Processo</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
