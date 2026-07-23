import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Loader2, Search, AlertCircle, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useProcessosProducao, type DependenciaEtapaInput } from '@/hooks/useProcessosProducao';
import { useProjetosProducao } from '@/hooks/useProjetosProducao';
import type { ProducaoPrioridade } from '@/types/producao';

interface FormProps { onSuccess: () => void; }
interface FormData {
  projeto_id: string;
  projeto_local_operacional_id: string;
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
  const [dependencias, setDependencias] = useState<DependenciaEtapaInput[]>([]);
  const [novaDependenciaId, setNovaDependenciaId] = useState('');
  const [novoTipoDependencia, setNovoTipoDependencia] = useState<'fim_inicio' | 'inicio_inicio'>('fim_inicio');
  const { criarProcesso, processos, listarProcessos } = useProcessosProducao();
  const { projetos, listarProjetos, loading: carregandoProjetos, erro } = useProjetosProducao();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: { prioridade: 'normal', sequencia: '0', aceita_producao_proporcional: false },
  });

  useEffect(() => {
    if (!aberto) return;
    setBuscaProjeto('');
    setDependencias([]);
    void Promise.all([listarProjetos(true), listarProcessos()]).catch(() => undefined);
  }, [aberto, listarProcessos, listarProjetos]);

  const projetoId = watch('projeto_id');
  const localOperacionalId = watch('projeto_local_operacional_id');
  const prioridade = watch('prioridade');
  const proporcional = watch('aceita_producao_proporcional');
  const projetoSelecionado = projetos.find((projeto) => projeto.id === projetoId) ?? null;
  const locaisProjeto = projetoSelecionado?.locais.filter((local) => local.ativo) ?? [];

  const projetosFiltrados = useMemo(() => {
    const termo = buscaProjeto.trim().toLocaleLowerCase('pt-BR');
    if (!termo) return projetos;
    return projetos.filter((projeto) =>
      [projeto.nome, projeto.cliente, projeto.cidade, projeto.uf, ...projeto.locais.map((local) => local.nome)]
        .filter(Boolean)
        .some((valor) => String(valor).toLocaleLowerCase('pt-BR').includes(termo)),
    );
  }, [buscaProjeto, projetos]);

  const etapasMesmoProjeto = useMemo(() => processos.filter((processo) =>
    processo.projeto_id === projetoId && processo.status !== 'cancelado'
  ), [processos, projetoId]);

  const adicionarDependencia = () => {
    if (!novaDependenciaId || dependencias.some((item) => item.etapa_id === novaDependenciaId)) return;
    setDependencias((atuais) => [...atuais, { etapa_id: novaDependenciaId, tipo: novoTipoDependencia }]);
    setNovaDependenciaId('');
    setNovoTipoDependencia('fim_inicio');
  };

  const onSubmit = async (data: FormData) => {
    try {
      if (data.data_inicio_prevista && data.data_fim_prevista && data.data_fim_prevista < data.data_inicio_prevista) {
        throw new Error('A data limite não pode ser anterior à data inicial desejada.');
      }
      const quantidade = numeroOpcional(data.quantidade_planejada);
      const capacidade = numeroOpcional(data.capacidade_diaria);
      const pessoas = numeroOpcional(data.pessoas_necessarias);
      const sequencia = numeroOpcional(data.sequencia) ?? 0;
      if (quantidade !== null && quantidade < 0) throw new Error('Quantidade planejada inválida.');
      if (capacidade !== null && capacidade <= 0) throw new Error('Capacidade diária deve ser maior que zero.');
      if (pessoas !== null && pessoas < 0) throw new Error('Quantidade de pessoas inválida.');

      await criarProcesso({
        projeto_id: data.projeto_id,
        projeto_local_operacional_id: data.projeto_local_operacional_id,
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
        dependencias,
      });
      reset({ prioridade: 'normal', sequencia: '0', aceita_producao_proporcional: false });
      setBuscaProjeto('');
      setDependencias([]);
      setAberto(false);
      onSuccess();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao salvar etapa');
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild><Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />Nova Etapa</Button></DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[780px]">
        <DialogHeader>
          <DialogTitle>Nova Etapa de Produção</DialogTitle>
          <DialogDescription>A etapa pertence a um projeto único e a um local operacional específico. Gantt e Plano Diário serão gerados automaticamente.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Buscar projeto</Label>
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={buscaProjeto} onChange={(event) => setBuscaProjeto(event.target.value)} placeholder="Nome, cliente, cidade ou local" disabled={carregandoProjetos} /></div>
          </div>
          {erro && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Não foi possível consultar os projetos: {erro}</AlertDescription></Alert>}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Projeto *</Label><Select value={projetoId} onValueChange={(value) => { setValue('projeto_id', value, { shouldValidate: true }); setValue('projeto_local_operacional_id', ''); setDependencias([]); }}><SelectTrigger><SelectValue placeholder="Selecione o projeto" /></SelectTrigger><SelectContent>{projetosFiltrados.map((projeto) => <SelectItem key={projeto.id} value={projeto.id}>{projeto.nome}{projeto.cidade ? ` · ${projeto.cidade}/${projeto.uf ?? ''}` : ''}</SelectItem>)}</SelectContent></Select><input type="hidden" {...register('projeto_id', { required: true })} />{errors.projeto_id && <span className="text-sm text-destructive">Projeto obrigatório</span>}</div>
            <div className="space-y-2"><Label>Local operacional *</Label><Select value={localOperacionalId} onValueChange={(value) => setValue('projeto_local_operacional_id', value, { shouldValidate: true })} disabled={!projetoId}><SelectTrigger><SelectValue placeholder={projetoId ? 'Selecione onde a etapa acontece' : 'Escolha primeiro o projeto'} /></SelectTrigger><SelectContent>{locaisProjeto.map((local) => <SelectItem key={local.id} value={local.id}>{local.nome} · {local.tipo}</SelectItem>)}</SelectContent></Select><input type="hidden" {...register('projeto_local_operacional_id', { required: true })} />{errors.projeto_local_operacional_id && <span className="text-sm text-destructive">Local operacional obrigatório</span>}</div>
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
            <div className="space-y-2"><Label>Data inicial desejada</Label><Input type="date" {...register('data_inicio_prevista')} /></div>
            <div className="space-y-2"><Label>Data limite</Label><Input type="date" {...register('data_fim_prevista')} /></div>
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
          <label className="flex items-start gap-3 rounded-lg border p-3"><Checkbox checked={proporcional} onCheckedChange={(checked) => setValue('aceita_producao_proporcional', checked === true)} /><span><span className="block text-sm font-medium">Aceita produção proporcional</span><span className="text-xs text-muted-foreground">Permite reduzir a meta diária quando houver menos pessoas disponíveis.</span></span></label>

          <div className="space-y-3 rounded-lg border p-4">
            <div><Label>Dependências da etapa</Label><p className="text-xs text-muted-foreground">Selecione etapas anteriores do mesmo projeto, inclusive de outros locais operacionais.</p></div>
            <div className="grid gap-2 sm:grid-cols-[1fr_170px_auto]">
              <Select value={novaDependenciaId} onValueChange={setNovaDependenciaId} disabled={!projetoId || etapasMesmoProjeto.length === 0}><SelectTrigger><SelectValue placeholder="Etapa predecessora" /></SelectTrigger><SelectContent>{etapasMesmoProjeto.filter((etapa) => !dependencias.some((item) => item.etapa_id === etapa.id)).map((etapa) => <SelectItem key={etapa.id} value={etapa.id}>{etapa.codigo} · {etapa.nome} · {etapa.local_operacional?.nome ?? 'Sem local'}</SelectItem>)}</SelectContent></Select>
              <Select value={novoTipoDependencia} onValueChange={(value) => setNovoTipoDependencia(value as 'fim_inicio' | 'inicio_inicio')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fim_inicio">Fim → Início</SelectItem><SelectItem value="inicio_inicio">Início → Início</SelectItem></SelectContent></Select>
              <Button type="button" variant="outline" onClick={adicionarDependencia} disabled={!novaDependenciaId}>Adicionar</Button>
            </div>
            {dependencias.map((dependencia) => { const etapa = processos.find((item) => item.id === dependencia.etapa_id); return <div key={dependencia.etapa_id} className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2 text-sm"><span>{etapa?.nome ?? dependencia.etapa_id} · {dependencia.tipo === 'fim_inicio' ? 'Fim → Início' : 'Início → Início'}</span><Button type="button" size="icon" variant="ghost" onClick={() => setDependencias((atuais) => atuais.filter((item) => item.etapa_id !== dependencia.etapa_id))}><Trash2 className="h-4 w-4" /></Button></div>; })}
          </div>

          <div className="flex justify-end"><Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar etapa</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
