import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useProjetosProducao } from '@/hooks/useProjetosProducao';
import type { ProducaoProjeto } from '@/types/producao';

interface Props {
  projeto: ProducaoProjeto;
  onSuccess: () => void;
}

interface FormData {
  descricao: string;
  cliente: string;
  cidade: string;
  uf: string;
  local_execucao: string;
  endereco_execucao: string;
  responsavel_nome: string;
}

const valoresDoProjeto = (projeto: ProducaoProjeto): FormData => ({
  descricao: projeto.descricao ?? '',
  cliente: projeto.cliente ?? '',
  cidade: projeto.cidade ?? '',
  uf: projeto.uf ?? '',
  local_execucao: projeto.local_execucao ?? '',
  endereco_execucao: projeto.endereco_execucao ?? '',
  responsavel_nome: projeto.responsavel_nome_snapshot ?? '',
});

export const FormEditarProjetoProducao = ({ projeto, onSuccess }: Props) => {
  const [aberto, setAberto] = useState(false);
  const { atualizarProjeto } = useProjetosProducao();
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormData>({
    defaultValues: valoresDoProjeto(projeto),
  });

  useEffect(() => {
    if (aberto) reset(valoresDoProjeto(projeto));
  }, [aberto, projeto, reset]);

  const salvar = async (dados: FormData) => {
    try {
      await atualizarProjeto(projeto.config_id ?? projeto.id, {
        local_utilizacao_id: projeto.local_utilizacao_id,
        descricao: dados.descricao.trim() || null,
        cliente: dados.cliente.trim() || null,
        cidade: dados.cidade.trim() || null,
        uf: dados.uf.trim().toUpperCase() || null,
        local_execucao: dados.local_execucao.trim() || null,
        endereco_execucao: dados.endereco_execucao.trim() || null,
        responsavel_id: projeto.responsavel_id,
        responsavel_nome: dados.responsavel_nome.trim() || null,
        ativo: projeto.ativo,
      });

      setAberto(false);
      onSuccess();
      toast.success('Informações do projeto atualizadas.');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar o projeto.',
      );
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <Pencil className="mr-2 h-4 w-4" />
          Editar projeto
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>Editar informações do projeto</DialogTitle>
          <DialogDescription>
            Atualize os dados operacionais usados no módulo de Produção. O nome
            e o vínculo com o projeto original permanecem inalterados.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(salvar)} className="space-y-4">
          <div className="rounded-lg border bg-muted/20 p-4 text-sm">
            {projeto.grupo_nome && (
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {projeto.grupo_nome}
              </p>
            )}
            <p className="font-semibold">{projeto.nome}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`descricao-projeto-${projeto.id}`}>
              Descrição operacional
            </Label>
            <Textarea
              id={`descricao-projeto-${projeto.id}`}
              rows={3}
              {...register('descricao')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`cliente-projeto-${projeto.id}`}>Cliente</Label>
            <Input
              id={`cliente-projeto-${projeto.id}`}
              {...register('cliente')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_100px]">
            <div className="space-y-2">
              <Label htmlFor={`cidade-projeto-${projeto.id}`}>
                Cidade de destino
              </Label>
              <Input
                id={`cidade-projeto-${projeto.id}`}
                {...register('cidade')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`uf-projeto-${projeto.id}`}>UF</Label>
              <Input
                id={`uf-projeto-${projeto.id}`}
                maxLength={2}
                placeholder="PR"
                {...register('uf', { maxLength: 2 })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`local-projeto-${projeto.id}`}>
              Local de destino/obra
            </Label>
            <Input
              id={`local-projeto-${projeto.id}`}
              {...register('local_execucao')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`endereco-projeto-${projeto.id}`}>
              Endereço de destino
            </Label>
            <Input
              id={`endereco-projeto-${projeto.id}`}
              {...register('endereco_execucao')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`responsavel-projeto-${projeto.id}`}>
              Responsável pelo projeto
            </Label>
            <Input
              id={`responsavel-projeto-${projeto.id}`}
              {...register('responsavel_nome')}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setAberto(false)}
            >
              Voltar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Salvar alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
