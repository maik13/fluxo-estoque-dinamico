import { useState } from 'react';
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
import { Plus, Loader2 } from 'lucide-react';
import { useProjetosProducao } from '@/hooks/useProjetosProducao';

interface FormProps { onSuccess: () => void; }
interface FormData {
  nome: string;
  descricao: string;
  cliente: string;
  cidade: string;
  uf: string;
  local_execucao: string;
  endereco_execucao: string;
}

export const FormProjetoProducao = ({ onSuccess }: FormProps) => {
  const [aberto, setAberto] = useState(false);
  const { criarProjeto } = useProjetosProducao();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    try {
      await criarProjeto({
        nome: data.nome,
        descricao: data.descricao || null,
        cliente: data.cliente || null,
        cidade: data.cidade || null,
        uf: data.uf || null,
        local_execucao: data.local_execucao || null,
        endereco_execucao: data.endereco_execucao || null,
      });
      reset();
      setAberto(false);
      onSuccess();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao salvar projeto');
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />Novo Projeto</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader><DialogTitle>Novo Projeto</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Projeto *</Label>
            <Input id="nome" {...register('nome', { required: 'Nome é obrigatório' })} />
            {errors.nome && <span className="text-sm text-destructive">{errors.nome.message}</span>}
          </div>
          <div className="space-y-2"><Label htmlFor="descricao">Descrição</Label><Input id="descricao" {...register('descricao')} /></div>
          <div className="space-y-2"><Label htmlFor="cliente">Cliente</Label><Input id="cliente" {...register('cliente')} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="cidade">Cidade</Label><Input id="cidade" {...register('cidade')} /></div>
            <div className="space-y-2"><Label htmlFor="uf">UF</Label><Input id="uf" maxLength={2} placeholder="PR" {...register('uf', { maxLength: 2 })} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="local_execucao">Local de execução</Label><Input id="local_execucao" {...register('local_execucao')} /></div>
          <div className="space-y-2"><Label htmlFor="endereco_execucao">Endereço</Label><Input id="endereco_execucao" {...register('endereco_execucao')} /></div>
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar Projeto</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
