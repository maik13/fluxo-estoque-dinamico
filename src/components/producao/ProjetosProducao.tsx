import { useEffect, useState } from 'react';
import { Search, MapPin, Calendar, FolderOpen, Factory, Truck, Wrench, Warehouse, PackageOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useProjetosProducao } from '@/hooks/useProjetosProducao';
import { FormProjetoProducao } from './FormProjetoProducao';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ProducaoLocalOperacionalTipo } from '@/types/producao';

const ICONES: Record<ProducaoLocalOperacionalTipo, typeof Factory> = {
  processamento: Wrench,
  fabrica: Factory,
  estoque: Warehouse,
  logistica: Truck,
  execucao: MapPin,
  manutencao: PackageOpen,
  outro: MapPin,
};

const LABELS: Record<ProducaoLocalOperacionalTipo, string> = {
  processamento: 'Processamento',
  fabrica: 'Fábrica',
  estoque: 'Estoque / expedição',
  logistica: 'Logística',
  execucao: 'Execução',
  manutencao: 'Manutenção',
  outro: 'Outro',
};

export const ProjetosProducao = () => {
  const [busca, setBusca] = useState('');
  const { projetos, loading, listarProjetos, erro } = useProjetosProducao();

  useEffect(() => { void listarProjetos(); }, [listarProjetos]);

  const termo = busca.toLocaleLowerCase('pt-BR');
  const projetosFiltrados = projetos.filter((projeto) =>
    [projeto.nome, projeto.cliente, projeto.cidade, projeto.uf, projeto.responsavel_nome_snapshot,
      ...projeto.locais.flatMap((local) => [local.nome, local.cidade, local.uf, LABELS[local.tipo]])]
      .filter(Boolean)
      .some((valor) => String(valor).toLocaleLowerCase('pt-BR').includes(termo)),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-medium">Projetos de Produção</h3>
          <p className="text-sm text-muted-foreground">
            Cada projeto aparece uma única vez. Dentro dele ficam os locais operacionais onde as etapas serão executadas.
          </p>
        </div>
        <FormProjetoProducao onSuccess={() => void listarProjetos()} />
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input type="search" placeholder="Buscar projeto, cliente, cidade ou local operacional..." className="pl-8" value={busca} onChange={(event) => setBusca(event.target.value)} />
      </div>

      {erro && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{erro}</div>}

      {loading ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">Carregando projetos...</div>
      ) : projetosFiltrados.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground"><FolderOpen className="mx-auto mb-3 h-8 w-8 opacity-50" />Nenhum projeto de Produção encontrado.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {projetosFiltrados.map((projeto) => (
            <div key={projeto.id} className="space-y-4 rounded-lg border bg-card p-5 text-card-foreground shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h4 className="text-lg font-semibold">{projeto.nome}</h4>
                  {projeto.cliente && <p className="text-sm text-muted-foreground">Cliente: {projeto.cliente}</p>}
                  {projeto.descricao && <p className="mt-1 text-sm text-muted-foreground">{projeto.descricao}</p>}
                </div>
                <Badge variant={projeto.ativo ? 'secondary' : 'outline'}>{projeto.ativo ? 'Ativo' : 'Inativo'}</Badge>
              </div>

              <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                <div className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0" /><span>Destino: {projeto.cidade ? `${projeto.cidade}${projeto.uf ? `/${projeto.uf}` : ''}` : 'não informado'}</span></div>
                <div className="flex items-center gap-2"><Calendar className="h-4 w-4 shrink-0" /><span>Criado em {format(new Date(projeto.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}</span></div>
                {projeto.local_execucao && <p>Aplicação: {projeto.local_execucao}</p>}
                {projeto.responsavel_nome_snapshot && <p>Responsável: {projeto.responsavel_nome_snapshot}</p>}
              </div>

              <div className="border-t pt-4">
                <div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold">Locais operacionais</p><Badge variant="outline">{projeto.locais.filter((local) => local.ativo).length}</Badge></div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {projeto.locais.filter((local) => local.ativo).map((local) => {
                    const Icone = ICONES[local.tipo];
                    return (
                      <div key={local.id} className="rounded-md border bg-muted/20 p-3">
                        <div className="flex items-center gap-2"><Icone className="h-4 w-4 text-primary" /><span className="text-sm font-medium">{local.nome}</span>{local.principal && <Badge className="ml-auto" variant="secondary">Padrão</Badge>}</div>
                        <p className="mt-1 text-xs text-muted-foreground">{LABELS[local.tipo]}{local.cidade ? ` · ${local.cidade}/${local.uf ?? ''}` : ''}</p>
                      </div>
                    );
                  })}
                  {projeto.locais.filter((local) => local.ativo).length === 0 && <p className="text-sm text-muted-foreground">Nenhum local operacional cadastrado.</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
