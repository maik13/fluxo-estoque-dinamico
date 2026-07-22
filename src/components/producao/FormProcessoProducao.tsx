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
import { Checkbox } from '@/components/ui/checkbox';
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
  data_inicio_prevista: string;
  data_fim_prevista: string;
  grupo_cronograma: string;
  sequencia: string;
  capacidade_diaria: string;
  pessoas_necessarias: string;
  aceita_producao_proporcional: boolean;
}

const numeroOpcional = (valor: string) => {
  if (!valor.trim()) return null;
  const numero = Number(valor.replace(',', '.'));
  if (!Number.isFinite(numero)) throw new Error('Valor numérico inválido.');
  return numero;
};

export const FormProcessoProducao = ({ onSuccess }: FormProps) => {
  const [aberto, setAberto] = useState(false);
  const [buscaProjeto, setBuscaProjeto] = useState('');
  const { criarProcesso } = useProcessosProducao();
  const { projetos, listarProjetos, loading: carregandoProjetos, erro } = useProjetosProducao();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: { prioridade: 'normal', sequencia: '0', aceita_producao_proporcional: false },
  });

  useEffect(() => {
    if (!aberto) return;
    setBuscaProjeto('');
    void listarProjetos(true).catch(() => undefined);
  }, [aberto, listarProjetos]);

  const projetoLocalId = watch('projeto_local_id');
  const prioridade = watch('prioridade');
  const proporcional = watch('aceita_producao_proporcional');
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
      if (data.data_inicio_prevista && data.data_fim_prevista && data.data_fim_prevista < data.data_inicio_prevista) {
        throw new Error('A data final não pode ser anterior à data inicial.');
      }
      const quantidade = numeroOpcional(data.quantidade_planejada);
      const capacidade = numeroOpcional(data.capacidade_diaria);
      const pessoas = numeroOpcional(data.pessoas_necessarias);
      const sequencia = numeroOpcional(data.sequencia) ?? 0;
      if (quantidade !== null && quantidade < 0) throw new Error('Quantidade planejada inválida.');
      if (capacidade !== null && capacidade <= 0) throw new Error('Capacidade diária deve ser maior que zero.');
      if (pessoas !== null && pessoas < 0) throw new Error('Quantidade de pessoas inválida.');

      await criarProcesso({
        projeto_local_id: data.projeto_local_id,
        codigo: data.codigo || null,
        nome: data.nome,
        descricao: data.descricao || null,
        prioridade: data.prioridade,
        produto_entregavel: data.produto_entregavel || null,
        unidade_medida: data.unidade_medida || null,
        quantidade_planejada: quantidade,
        data_inicio_prevista: data.data_inicio_prevista || null,
        data_fim_prevista: data.data_fim_prevista || null,
        grupo_cronograma: data.grupo_cronograma || null,
        sequencia,
        capacidade_diaria: capacidade,
        pessoas_necessarias: pessoas,
        aceita_producao_proporcional: data.aceita_producao_proporcional,
      });
      reset({ prioridade: 'normal', sequencia: '0', aceita_producao_proporcional: false });
      setBuscaProjeto('');
      setAberto(false);
      onSuccess();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao salvar etapa');
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild><Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />Nova Etapa</Button></DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Nova Etapa de Produção</DialogTitle>
          <DialogDescription>
            A etapa é cadastrada uma única vez no projeto e passa a alimentar automaticamente o Gantt.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="busca-projeto-processo">Buscar projeto/local existente</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input id="busca-projeto-processo" className="pl-9" value={buscaProjeto} onChange={(event) => setBuscaProjeto(event.target.value)} placeholder="Nome, local, grupo ou cidade" disabled={carregandoProjetos} />
            </div>
          </div>

          {erro && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Não foi possível consultar os projetos: {erro}</AlertDescription></Alert>}

          <div className="space-y-2">
            <Label>Projeto/local existente *</Label>
            <Select value={projetoLocalId} onValueChange={(value) => setValue('projeto_local_id', value, { shouldValidate: true })}>
              <SelectTrigger><SelectValue placeholder={carregandoProjetos ? 'Carregando...' : 'Selecione um projeto/local'} /></SelectTrigger>
              <SelectContent>{projetosFiltrados.map((projeto) => <SelectItem key={projeto.local_utilizacao_id} value={projeto.local_utilizacao_id}>{projeto.grupo_nome ? `${projeto.grupo_nome} · ` : ''}{projeto.nome}{projeto.cidade ? ` · ${projeto.cidade}/${projeto.uf ?? ''}` : ''}</SelectItem>)}</SelectContent>
            </Select>
            <input type="hidden" {...register('projeto_local_id', { required: true })} />
            {errors.projeto_local_id && <span className="text-sm text-destructive">Projeto/local obrigatório</span>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Código opcional</Label><Input placeholder="Gerado automaticamente" {...register('codigo')} /></div>
            <div className="space-y-2"><Label>Prioridade</Label><Select value={prioridade} onValueChange={(value) => setValue('prioridade', value as ProducaoPrioridade)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="baixa">Baixa</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="alta">Alta</SelectItem><SelectItem value="urgente">Urgente</SelectItem></SelectContent></Select></div>
          </div>

          <div className="space-y-2"><Label>Nome da etapa *</Label><Input placeholder="Ex.: Montagem dos painéis" {...register('nome', { required: 'Nome obrigatório' })} />{errors.nome && <span className="text-sm text-destructive">{errors.nome.message}</span>}</div>
          <div className="space-y-2"><Label>Descrição</Label><Input {...register('descricao')} /></div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Grupo do cronograma</Label><Input placeholder="Ex.: Painéis, Alumínio, Campo" {...register('grupo_cronograma')} /></div>
            <div className="space-y-2"><Label>Sequência</Label><Input type="number" min="0" {...register('sequencia')} /></div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Data inicial planejada</Label><Input type="date" {...register('data_inicio_prevista')} /></div>
            <div className="space-y-2"><Label>Data final planejada</Label><Input type="date" {...register('data_fim_prevista')} /></div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2"><Label>Produto/entregável</Label><Input {...register('produto_entregavel')} /></div>
            <div className="space-y-2"><Label>Unidade</Label><Input placeholder="peças, m²..." {...register('unidade_medida')} /></div>
            <div className="space-y-2"><Label>Quantidade planejada</Label><Input inputMode="decimal" {...register('quantidade_planejada')} /></div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Capacidade diária</Label><Input inputMode="decimal" placeholder="Quanto pode produzir por dia" {...register('capacidade_diaria')} /></div>
            <div className="space-y-2"><Label>Pessoas necessárias</Label><Input inputMode="decimal" placeholder="Equipe prevista" {...register('pessoas_necessarias')} /></div>
          </div>

          <label className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox checked={proporcional} onCheckedChange={(checked) => setValue('aceita_producao_proporcional', checked === true)} />
            <span><span className="block text-sm font-medium">Aceita produção proporcional</span><span className="text-xs text-muted-foreground">Permite reduzir a meta diária quando houver menos pessoas disponíveis.</span></span>
          </label>

          <div className="flex justify-end pt-4"><Button type="submit" disabled={isSubmitting || carregandoProjetos || projetos.length === 0}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar Etapa</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
