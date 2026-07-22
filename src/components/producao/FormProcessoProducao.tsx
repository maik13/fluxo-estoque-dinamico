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
import { Plus, Loader2, Search, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useProcessosProducao } from '@/hooks/useProcessosProducao';
import { useProjetosProducao } from '@/hooks/useProjetosProducao';
import type { ProducaoPrioridade } from '@/types/producao';

interface FormProps { onSuccess: () => void; }
interface FormData {
  projeto_local_id: string;
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
  const [buscaProjeto, setBuscaProjeto] = useState('');
  const { criarProcesso } = useProcessosProducao();
  const { projetos, listarProjetos, loading: carregandoProjetos, erro } = useProjetosProducao();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: { prioridade: 'normal' },
  });

  useEffect(() => {
    if (!aberto) return;
    setBuscaProjeto('');
    void listarProjetos(true).catch(() => undefined);
  }, [aberto, listarProjetos]);

  const projetoLocalId = watch('projeto_local_id');
  const prioridade = watch('prioridade');
  const projetosFiltrados = useMemo(() => {
    const termo = buscaProjeto.trim().toLocaleLowerCase('pt-BR');
    if (!termo) return projetos;
    return projetos.filter((projeto) =>
      [projeto.nome, projeto.grupo_nome, projeto.cliente, projeto.cidade, projeto.uf]
        .filter(Boolean)
        .some((valor) => String(valor).toLocaleLowerCase('pt-BR').includes(termo)),
    );
  }, [buscaProjeto, projetos]);

  const onSubmit = async (data: FormData) => {
    try {
      const quantidade = data.quantidade_planejada.trim()
        ? Number(data.quantidade_planejada.replace(',', '.'))
        : null;
      if (quantidade !== null && (!Number.isFinite(quantidade) || quantidade < 0)) {
        throw new Error('Quantidade planejada inválida.');
      }
      await criarProcesso({
        projeto_local_id: data.projeto_local_id,
        codigo: data.codigo || null,
        nome: data.nome,
        descricao: data.descricao || null,
        prioridade: data.prioridade,
        produto_entregavel: data.produto_entregavel || null,
        unidade_medida: data.unidade_medida || null,
        quantidade_planejada: quantidade,
      });
      reset({ prioridade: 'normal' });
      setBuscaProjeto('');
      setAberto(false);
      onSuccess();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao salvar processo');
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild><Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />Novo Processo</Button></DialogTrigger>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>Novo Processo de Produção</DialogTitle>
          <DialogDescription>
            O processo é uma frente macro de trabalho vinculada a um projeto/local já existente no aplicativo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="busca-projeto-processo">Buscar projeto/local existente</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="busca-projeto-processo"
                className="pl-9"
                value={buscaProjeto}
                onChange={(event) => setBuscaProjeto(event.target.value)}
                placeholder="Digite o nome do projeto, local, grupo ou cidade"
                disabled={carregandoProjetos}
              />
            </div>
          </div>

          {erro && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Não foi possível consultar os projetos existentes: {erro}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Projeto/local existente *</Label>
            <Select value={projetoLocalId} onValueChange={(value) => setValue('projeto_local_id', value, { shouldValidate: true })}>
              <SelectTrigger>
                <SelectValue placeholder={carregandoProjetos ? 'Carregando projetos...' : 'Selecione um projeto/local'} />
              </SelectTrigger>
              <SelectContent>
                {projetosFiltrados.map((projeto) => (
                  <SelectItem key={projeto.local_utilizacao_id} value={projeto.local_utilizacao_id}>
                    {projeto.grupo_nome ? `${projeto.grupo_nome} · ` : ''}{projeto.nome}{projeto.cidade ? ` · ${projeto.cidade}/${projeto.uf ?? ''}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!carregandoProjetos && projetosFiltrados.length === 0 && !erro && (
              <p className="text-sm text-amber-500">
                Nenhum projeto/local ativo corresponde à busca. Confira o cadastro em Configurações → Locais de utilização.
              </p>
            )}
            <input type="hidden" {...register('projeto_local_id', { required: true })} />
            {errors.projeto_local_id && <span className="text-sm text-destructive">Projeto/local obrigatório</span>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="codigo">Código opcional</Label><Input id="codigo" placeholder="Gerado automaticamente" {...register('codigo')} /></div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={(value) => setValue('prioridade', value as ProducaoPrioridade)}>
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
          <div className="space-y-2"><Label htmlFor="nome">Nome do processo *</Label><Input id="nome" placeholder="Ex.: Montagem dos painéis" {...register('nome', { required: 'Nome obrigatório' })} />{errors.nome && <span className="text-sm text-destructive">{errors.nome.message}</span>}</div>
          <div className="space-y-2"><Label htmlFor="descricao">Descrição</Label><Input id="descricao" {...register('descricao')} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="produto_entregavel">Produto/entregável</Label><Input id="produto_entregavel" {...register('produto_entregavel')} /></div>
            <div className="space-y-2"><Label htmlFor="unidade_medida">Unidade</Label><Input id="unidade_medida" placeholder="peças, m²..." {...register('unidade_medida')} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="quantidade_planejada">Quantidade planejada</Label><Input id="quantidade_planejada" inputMode="decimal" {...register('quantidade_planejada')} /></div>
          <div className="flex justify-end pt-4"><Button type="submit" disabled={isSubmitting || carregandoProjetos || projetos.length === 0}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar Processo</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
