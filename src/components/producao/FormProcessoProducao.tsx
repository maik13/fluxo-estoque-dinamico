import { useState, useEffect } from 'react';
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

interface FormProps {
  onSuccess: () => void;
}

interface FormData {
  projeto_id: string;
  nome: string;
  descricao: string;
  prioridade: number;
}

export const FormProcessoProducao = ({ onSuccess }: FormProps) => {
  const [aberto, setAberto] = useState(false);
  const { criarProcesso } = useProcessosProducao();
  const { projetos, listarProjetos } = useProjetosProducao();
  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: { prioridade: 1 }
  });

  useEffect(() => {
    if (aberto) {
      void listarProjetos('ativo');
    }
  }, [aberto, listarProjetos]);

  const onSubmit = async (data: FormData) => {
    try {
      await criarProcesso({
        projeto_id: data.projeto_id,
        nome: data.nome,
        descricao: data.descricao || null,
        prioridade: Number(data.prioridade),
      });
      reset();
      setAberto(false);
      onSuccess();
    } catch (error: any) {
      alert(error.message);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Novo Processo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Novo Processo de Produção</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="projeto_id">Projeto *</Label>
            <Select onValueChange={(v) => setValue('projeto_id', v)} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um projeto" />
              </SelectTrigger>
              <SelectContent>
                {projetos.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.projeto_id && <span className="text-sm text-destructive">Obrigatório</span>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Processo *</Label>
            <Input
              id="nome"
              {...register('nome', { required: 'Nome é obrigatório' })}
            />
            {errors.nome && (
              <span className="text-sm text-destructive">{errors.nome.message}</span>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Input
              id="descricao"
              {...register('descricao')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prioridade">Prioridade (1- Alta, 3- Baixa) *</Label>
            <Input
              id="prioridade"
              type="number"
              min="1"
              max="5"
              {...register('prioridade', { required: 'Prioridade é obrigatória', min: 1, max: 5 })}
            />
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Processo
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
