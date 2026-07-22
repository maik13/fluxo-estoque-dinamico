import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings2, Loader2 } from 'lucide-react';
import { useProjetosProducao } from '@/hooks/useProjetosProducao';

interface FormProps { onSuccess: () => void; }
interface FormData {
  local_utilizacao_id: string;
  descricao: string;
  cliente: string;
  cidade: string;
  uf: string;
  local_execucao: string;
  endereco_execucao: string;
  responsavel_nome: string;
}

export const FormProjetoProducao = ({ onSuccess }: FormProps) => {
  const [aberto, setAberto] = useState(false);
  const { projetos, listarProjetos, criarProjeto } = useProjetosProducao();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>();

  useEffect(() => {
    if (aberto) void listarProjetos(true);
  }, [aberto, listarProjetos]);

  const localId = watch('local_utilizacao_id');

  const onSubmit = async (data: FormData) => {
    try {
      await criarProjeto({
        local_utilizacao_id: data.local_utilizacao_id,
        descricao: data.descricao || null,
        cliente: data.cliente || null,
        cidade: data.cidade || null,
        uf: data.uf || null,
        local_execucao: data.local_execucao || null,
        endereco_execucao: data.endereco_execucao || null,
        responsavel_nome: data.responsavel_nome || null,
      });
      reset();
      setAberto(false);
      onSuccess();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao configurar projeto');
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto"><Settings2 className="mr-2 h-4 w-4" />Configurar Projeto</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Configurar Projeto para Produção</DialogTitle>
          <DialogDescription>
            Selecione um projeto/local já cadastrado no aplicativo e acrescente os dados operacionais da produção.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Projeto/local existente *</Label>
            <Select value={localId} onValueChange={(value) => setValue('local_utilizacao_id', value, { shouldValidate: true })}>
              <SelectTrigger><SelectValue placeholder="Selecione um projeto/local existente" /></SelectTrigger>
              <SelectContent>
                {projetos.map((projeto) => (
                  <SelectItem key={projeto.id} value={projeto.local_utilizacao_id}>
                    {projeto.grupo_nome ? `${projeto.grupo_nome} · ` : ''}{projeto.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" {...register('local_utilizacao_id', { required: true })} />
            {errors.local_utilizacao_id && <span className="text-sm text-destructive">Selecione um projeto/local</span>}
          </div>
          <div className="space-y-2"><Label htmlFor="descricao">Descrição operacional</Label><Input id="descricao" {...register('descricao')} /></div>
          <div className="space-y-2"><Label htmlFor="cliente">Cliente</Label><Input id="cliente" {...register('cliente')} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="cidade">Cidade</Label><Input id="cidade" {...register('cidade')} /></div>
            <div className="space-y-2"><Label htmlFor="uf">UF</Label><Input id="uf" maxLength={2} placeholder="PR" {...register('uf', { maxLength: 2 })} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="local_execucao">Local de execução</Label><Input id="local_execucao" {...register('local_execucao')} /></div>
          <div className="space-y-2"><Label htmlFor="endereco_execucao">Endereço</Label><Input id="endereco_execucao" {...register('endereco_execucao')} /></div>
          <div className="space-y-2"><Label htmlFor="responsavel_nome">Responsável pelo projeto</Label><Input id="responsavel_nome" {...register('responsavel_nome')} /></div>
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar Configuração</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
