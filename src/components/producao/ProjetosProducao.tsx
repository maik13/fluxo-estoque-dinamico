import { useEffect, useState } from 'react';
import { Search, MapPin, Calendar, Clock, FolderOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useProjetosProducao } from '@/hooks/useProjetosProducao';
import { FormProjetoProducao } from './FormProjetoProducao';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const ProjetosProducao = () => {
  const [busca, setBusca] = useState('');
  const { projetos, loading, listarProjetos } = useProjetosProducao();

  useEffect(() => {
    void listarProjetos();
  }, [listarProjetos]);

  const projetosFiltrados = projetos.filter((p) =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    p.cidade?.toLowerCase().includes(busca.toLowerCase()) ||
    p.estado?.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-lg font-medium">Projetos de Produção</h3>
        <FormProjetoProducao onSuccess={() => listarProjetos()} />
      </div>

      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar projetos..."
            className="pl-8"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          <p>Carregando projetos...</p>
        </div>
      ) : projetosFiltrados.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          <FolderOpen className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
          <p>Nenhum projeto encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projetosFiltrados.map((projeto) => (
            <div key={projeto.id} className="rounded-lg border bg-card text-card-foreground shadow-sm p-5 space-y-4">
              <div>
                <h4 className="font-semibold text-lg">{projeto.nome}</h4>
                {projeto.descricao && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{projeto.descricao}</p>
                )}
              </div>
              
              <div className="space-y-2 text-sm text-muted-foreground">
                {(projeto.cidade || projeto.estado) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span>
                      {projeto.cidade}{projeto.cidade && projeto.estado ? ' - ' : ''}{projeto.estado}
                    </span>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>Criado em {format(new Date(projeto.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}</span>
                </div>
              </div>

              <div className="pt-4 border-t flex items-center justify-between">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  projeto.status === 'ativo' ? 'bg-primary/10 text-primary' : 
                  projeto.status === 'concluido' ? 'bg-green-100 text-green-700' : 
                  'bg-destructive/10 text-destructive'
                }`}>
                  {projeto.status === 'ativo' ? 'Em andamento' : 
                   projeto.status === 'concluido' ? 'Concluído' : 'Cancelado'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
