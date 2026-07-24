import { useEffect, useState } from 'react';
import { Search, MapPin, Calendar, FolderOpen, CircleCheck } from 'lucide-react';
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

  const termo = busca.toLocaleLowerCase('pt-BR');
  const projetosFiltrados = projetos.filter((projeto) =>
    [projeto.nome, projeto.grupo_nome, projeto.cidade, projeto.uf, projeto.cliente]
      .filter(Boolean)
      .some((valor) => String(valor).toLocaleLowerCase('pt-BR').includes(termo)),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-medium">Projetos da Produção</h3>
          <p className="text-sm text-muted-foreground">
            Esta lista mostra somente os projetos que foram adicionados ao módulo de Produção.
          </p>
        </div>
        <FormProjetoProducao onSuccess={() => void listarProjetos()} />
      </div>

      {projetos.length > 0 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por projeto, grupo, cliente ou cidade..."
            className="pl-8"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
          />
        </div>
      )}

      {loading ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          Carregando projetos da Produção...
        </div>
      ) : projetos.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-muted-foreground">
          <FolderOpen className="mx-auto mb-3 h-9 w-9 opacity-50" />
          <p className="font-medium text-foreground">Nenhum projeto foi adicionado à Produção.</p>
          <p className="mt-1 text-sm">
            Use o botão “Adicionar Projeto” para escolher quais projetos deverão ser planejados e acompanhados neste módulo.
          </p>
        </div>
      ) : projetosFiltrados.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          Nenhum projeto adicionado corresponde à pesquisa.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projetosFiltrados.map((projeto) => (
            <div
              key={projeto.config_id ?? projeto.id}
              className="space-y-4 rounded-lg border bg-card p-5 text-card-foreground shadow-sm"
            >
              <div>
                {projeto.grupo_nome && (
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {projeto.grupo_nome}
                  </p>
                )}
                <h4 className="text-lg font-semibold">{projeto.nome}</h4>
                {projeto.descricao && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {projeto.descricao}
                  </p>
                )}
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span>
                    {projeto.cidade
                      ? `${projeto.cidade}${projeto.uf ? `/${projeto.uf}` : ''}`
                      : 'Cidade/UF ainda não informadas'}
                  </span>
                </div>
                {projeto.local_execucao && <p>Destino/obra: {projeto.local_execucao}</p>}
                {projeto.responsavel_nome_snapshot && (
                  <p>Responsável: {projeto.responsavel_nome_snapshot}</p>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>
                    Adicionado à Produção em{' '}
                    {format(new Date(projeto.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold">
                  <CircleCheck className="h-3.5 w-3.5 text-emerald-500" />
                  Adicionado à Produção
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
