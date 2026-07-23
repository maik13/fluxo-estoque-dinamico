import { useEffect, useMemo, useState } from 'react';
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
import { Plus, Trash2, Loader2, FolderPlus } from 'lucide-react';
import { useProjetosProducao, type ProjetoLocalOperacionalInput } from '@/hooks/useProjetosProducao';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import type { ProducaoLocalOperacionalTipo } from '@/types/producao';

interface FormProps { onSuccess: () => void; }
interface FormData {
  nome: string;
  descricao: string;
  cliente: string;
  cidade: string;
  uf: string;
  local_execucao: string;
  endereco_execucao: string;
  responsavel_nome: string;
}

const TIPOS: Array<{ value: ProducaoLocalOperacionalTipo; label: string }> = [
  { value: 'processamento', label: 'Processamento' },
  { value: 'fabrica', label: 'Fábrica' },
  { value: 'estoque', label: 'Estoque / expedição' },
  { value: 'logistica', label: 'Logística / trânsito' },
  { value: 'execucao', label: 'Execução / instalação' },
  { value: 'manutencao', label: 'Manutenção / desmontagem' },
  { value: 'outro', label: 'Outro' },
];

const novoLocal = (): ProjetoLocalOperacionalInput => ({
  nome: '', tipo: 'fabrica', local_utilizacao_id: null, cidade: '', uf: '', endereco: '', principal: false, ativo: true,
});

export const FormProjetoProducao = ({ onSuccess }: FormProps) => {
  const [aberto, setAberto] = useState(false);
  const [locais, setLocais] = useState<ProjetoLocalOperacionalInput[]>([novoLocal()]);
  const { criarProjeto } = useProjetosProducao();
  const { locaisUtilizacao } = useConfiguracoes();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>();

  useEffect(() => {
    if (!aberto) return;
    setLocais([novoLocal()]);
  }, [aberto]);

  const locaisDisponiveis = useMemo(() => locaisUtilizacao.filter((local) => local.ativo), [locaisUtilizacao]);

  const atualizarLocal = (indice: number, alteracoes: Partial<ProjetoLocalOperacionalInput>) => {
    setLocais((atuais) => atuais.map((local, i) => i === indice ? { ...local, ...alteracoes } : local));
  };

  const onSubmit = async (data: FormData) => {
    try {
      const locaisValidos = locais.map((local, indice) => ({
        ...local,
        nome: local.nome.trim(),
        principal: indice === 0,
        cidade: local.cidade?.trim() || null,
        uf: local.uf?.trim().toUpperCase() || null,
        endereco: local.endereco?.trim() || null,
      }));
      if (locaisValidos.some((local) => !local.nome)) throw new Error('Informe o nome de todos os locais operacionais.');
      await criarProjeto({
        nome: data.nome,
        descricao: data.descricao || null,
        cliente: data.cliente || null,
        cidade: data.cidade || null,
        uf: data.uf || null,
        local_execucao: data.local_execucao || null,
        endereco_execucao: data.endereco_execucao || null,
        responsavel_nome: data.responsavel_nome || null,
        locais: locaisValidos,
      });
      reset();
      setLocais([novoLocal()]);
      setAberto(false);
      onSuccess();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao salvar projeto');
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto"><FolderPlus className="mr-2 h-4 w-4" />Novo Projeto</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[820px]">
        <DialogHeader>
          <DialogTitle>Novo Projeto de Produção</DialogTitle>
          <DialogDescription>
            Cadastre o projeto uma única vez e informe os locais onde suas etapas poderão acontecer: fábrica, processamento, logística e cidade de execução.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>Nome do projeto *</Label><Input placeholder="Ex.: Natal de Itajaí 2026" {...register('nome', { required: 'Nome obrigatório' })} />{errors.nome && <span className="text-sm text-destructive">{errors.nome.message}</span>}</div>
            <div className="space-y-2"><Label>Cliente</Label><Input {...register('cliente')} /></div>
            <div className="space-y-2"><Label>Responsável</Label><Input {...register('responsavel_nome')} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Descrição do escopo</Label><Input {...register('descricao')} /></div>
          </div>

          <div className="rounded-lg border p-4">
            <h4 className="font-medium">Destino principal do projeto</h4>
            <p className="mb-4 text-xs text-muted-foreground">Identifica a cidade/obra de aplicação. Não substitui os locais operacionais.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Cidade</Label><Input {...register('cidade')} /></div>
              <div className="space-y-2"><Label>UF</Label><Input maxLength={2} placeholder="SC" {...register('uf', { maxLength: 2 })} /></div>
              <div className="space-y-2"><Label>Local de aplicação</Label><Input placeholder="Ex.: Praça Central" {...register('local_execucao')} /></div>
              <div className="space-y-2"><Label>Endereço</Label><Input {...register('endereco_execucao')} /></div>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <h4 className="font-medium">Locais operacionais do projeto</h4>
                <p className="text-xs text-muted-foreground">O primeiro local será o padrão. Cada etapa escolherá onde será executada.</p>
              </div>
              <Button type="button" variant="outline" onClick={() => setLocais((atuais) => [...atuais, novoLocal()])}><Plus className="mr-2 h-4 w-4" />Adicionar local</Button>
            </div>

            {locais.map((local, indice) => (
              <div key={indice} className="space-y-3 rounded-md bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{indice === 0 ? 'Local padrão' : `Local ${indice + 1}`}</span>
                  {locais.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => setLocais((atuais) => atuais.filter((_, i) => i !== indice))}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label>Tipo *</Label><Select value={local.tipo} onValueChange={(value) => atualizarLocal(indice, { tipo: value as ProducaoLocalOperacionalTipo })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TIPOS.map((tipo) => <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1.5"><Label>Usar local já cadastrado</Label><Select value={local.local_utilizacao_id ?? '__manual__'} onValueChange={(value) => { const existente = locaisDisponiveis.find((item) => item.id === value); atualizarLocal(indice, { local_utilizacao_id: value === '__manual__' ? null : value, nome: existente?.nome ?? local.nome }); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__manual__">Informar manualmente</SelectItem>{locaisDisponiveis.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1.5 sm:col-span-2"><Label>Nome do local *</Label><Input value={local.nome} onChange={(event) => atualizarLocal(indice, { nome: event.target.value })} placeholder="Ex.: Fábrica Bambusa ou Praça Central" /></div>
                  <div className="space-y-1.5"><Label>Cidade</Label><Input value={local.cidade ?? ''} onChange={(event) => atualizarLocal(indice, { cidade: event.target.value })} /></div>
                  <div className="space-y-1.5"><Label>UF</Label><Input maxLength={2} value={local.uf ?? ''} onChange={(event) => atualizarLocal(indice, { uf: event.target.value })} /></div>
                  <div className="space-y-1.5 sm:col-span-2"><Label>Endereço / referência</Label><Input value={local.endereco ?? ''} onChange={(event) => atualizarLocal(indice, { endereco: event.target.value })} /></div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2"><Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar projeto e locais</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
