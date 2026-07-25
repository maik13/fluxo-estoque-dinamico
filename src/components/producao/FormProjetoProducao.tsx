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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Plus, Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useProjetosProducao,
  type LocalDisponivelProducao,
} from '@/hooks/useProjetosProducao';

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
  const [locaisDisponiveis, setLocaisDisponiveis] = useState<LocalDisponivelProducao[]>([]);
  const [carregandoLocais, setCarregandoLocais] = useState(false);
  const [popoverAberto, setPopoverAberto] = useState(false);
  const { listarLocaisDisponiveis, criarProjeto } = useProjetosProducao();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>();

  useEffect(() => {
    if (!aberto) return;

    setCarregandoLocais(true);
    void listarLocaisDisponiveis()
      .then(setLocaisDisponiveis)
      .catch((error) => {
        console.error('Erro ao carregar projetos disponíveis:', error);
        setLocaisDisponiveis([]);
      })
      .finally(() => setCarregandoLocais(false));
  }, [aberto, listarLocaisDisponiveis]);

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
      setLocaisDisponiveis([]);
      setAberto(false);
      onSuccess();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao adicionar projeto');
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Projeto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Adicionar Projeto à Produção</DialogTitle>
          <DialogDescription>
            Escolha um projeto/local disponível no aplicativo. Somente os projetos adicionados aparecerão na aba Produção.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Projeto/local disponível *</Label>
            <Popover open={popoverAberto} onOpenChange={setPopoverAberto}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={popoverAberto}
                  className="w-full justify-between font-normal"
                  disabled={carregandoLocais || locaisDisponiveis.length === 0}
                >
                  {(() => {
                    const sel = locaisDisponiveis.find((l) => l.id === localId);
                    if (sel) return `${sel.grupo_nome ? `${sel.grupo_nome} · ` : ''}${sel.nome}`;
                    if (carregandoLocais) return 'Carregando projetos disponíveis...';
                    if (locaisDisponiveis.length === 0) return 'Nenhum projeto disponível para adicionar';
                    return 'Selecione ou digite o nome do projeto';
                  })()}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command
                  filter={(value, search) =>
                    value.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')) ? 1 : 0
                  }
                >
                  <CommandInput placeholder="Digite para buscar..." />
                  <CommandList>
                    <CommandEmpty>Nenhum projeto encontrado.</CommandEmpty>
                    <CommandGroup>
                      {locaisDisponiveis.map((local) => {
                        const label = `${local.grupo_nome ? `${local.grupo_nome} · ` : ''}${local.nome}`;
                        return (
                          <CommandItem
                            key={local.id}
                            value={label}
                            onSelect={() => {
                              setValue('local_utilizacao_id', local.id, { shouldValidate: true });
                              setPopoverAberto(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                localId === local.id ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                            {label}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <input type="hidden" {...register('local_utilizacao_id', { required: true })} />
            {errors.local_utilizacao_id && (
              <span className="text-sm text-destructive">Selecione um projeto/local</span>
            )}
            <p className="text-xs text-muted-foreground">
              Projetos já adicionados à Produção não aparecem novamente nesta lista.
            </p>
          </div>


          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição operacional</Label>
            <Input id="descricao" {...register('descricao')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cliente">Cliente</Label>
            <Input id="cliente" {...register('cliente')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade de destino</Label>
              <Input id="cidade" {...register('cidade')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uf">UF</Label>
              <Input id="uf" maxLength={2} placeholder="PR" {...register('uf', { maxLength: 2 })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="local_execucao">Local de destino/obra</Label>
            <Input id="local_execucao" {...register('local_execucao')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endereco_execucao">Endereço de destino</Label>
            <Input id="endereco_execucao" {...register('endereco_execucao')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="responsavel_nome">Responsável pelo projeto</Label>
            <Input id="responsavel_nome" {...register('responsavel_nome')} />
          </div>
          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              disabled={isSubmitting || carregandoLocais || locaisDisponiveis.length === 0}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Adicionar à Produção
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
