import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Search, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { type EstadoPermissaoUsuario } from './permissoesExistentes';

interface PermissaoUsuarioLinha {
  permissao_id: string;
  chave: string;
  modulo: string;
  grupo: string;
  nome: string;
  descricao: string | null;
  ordem: number;
  perfil_permitido: boolean;
  estado_individual: EstadoPermissaoUsuario;
  permitido_efetivo: boolean;
  origem: 'administrador' | 'individual' | 'perfil';
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  userType: string;
}

const estadoLabel: Record<EstadoPermissaoUsuario, string> = {
  herdar: 'Herdar',
  permitir: 'Permitir',
  negar: 'Negar',
};

export const PermissoesUsuarioDialog = ({
  open,
  onOpenChange,
  userId,
  userName,
  userType,
}: Props) => {
  const [permissoes, setPermissoes] = useState<PermissaoUsuarioLinha[]>([]);
  const [estados, setEstados] = useState<Record<string, EstadoPermissaoUsuario>>({});
  const [busca, setBusca] = useState('');
  const [modulosAbertos, setModulosAbertos] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [armazenamentoIndividualDisponivel, setArmazenamentoIndividualDisponivel] = useState(true);

  const carregar = async () => {
    setLoading(true);
    setPermissoes([]);
    setEstados({});
    setArmazenamentoIndividualDisponivel(false);

    try {
      const { data, error } = await (supabase as any).rpc('listar_permissoes_usuario', {
        p_user_id: userId,
      });
      if (error) throw error;

      const linhas = (data ?? []) as PermissaoUsuarioLinha[];
      if (linhas.length === 0) throw new Error('A consulta retornou uma lista vazia.');

      const obrigatorias = ['rh_acessar', 'ponto_registrar', 'ponto_visualizar', 'ponto_gerenciar', 'ponto_aprovar'];
      if (obrigatorias.some((chave) => !linhas.some((linha) => linha.chave === chave))) {
        throw new Error('Catálogo de permissões incompleto.');
      }
      setArmazenamentoIndividualDisponivel(true);
      setPermissoes(linhas);
      setEstados(
        Object.fromEntries(linhas.map((item) => [item.chave, item.estado_individual])),
      );
      setModulosAbertos(new Set(linhas.map((item) => item.modulo)));
    } catch (error) {
      console.error('Erro ao carregar permissões:', error);
      setArmazenamentoIndividualDisponivel(false);
      setPermissoes([]);
      setEstados({});
      toast.error('Não foi possível carregar as permissões. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && userId) void carregar();
    if (!open) {
      setBusca('');
      setPermissoes([]);
      setEstados({});
      setArmazenamentoIndividualDisponivel(true);
    }
  }, [open, userId]);

  const permissoesFiltradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    if (!termo) return permissoes;

    return permissoes.filter((item) =>
      [item.nome, item.descricao, item.chave, item.modulo, item.grupo]
        .filter(Boolean)
        .some((valor) => String(valor).toLocaleLowerCase('pt-BR').includes(termo)),
    );
  }, [busca, permissoes]);

  const porModulo = useMemo(() => {
    const mapa = new Map<string, Map<string, PermissaoUsuarioLinha[]>>();

    permissoesFiltradas.forEach((item) => {
      const grupos = mapa.get(item.modulo) ?? new Map<string, PermissaoUsuarioLinha[]>();
      const itens = grupos.get(item.grupo) ?? [];
      itens.push(item);
      grupos.set(item.grupo, itens);
      mapa.set(item.modulo, grupos);
    });

    return [...mapa.entries()];
  }, [permissoesFiltradas]);

  const resumo = useMemo(() => {
    const valores = Object.values(estados);
    return {
      herdadas: valores.filter((estado) => estado === 'herdar').length,
      permitidas: valores.filter((estado) => estado === 'permitir').length,
      negadas: valores.filter((estado) => estado === 'negar').length,
    };
  }, [estados]);

  const definirModulo = (modulo: string, estado: EstadoPermissaoUsuario) => {
    setEstados((atual) => {
      const proximo = { ...atual };
      permissoes
        .filter((item) => item.modulo === modulo)
        .forEach((item) => {
          proximo[item.chave] = estado;
        });
      return proximo;
    });
  };

  const salvar = async () => {
    if (!armazenamentoIndividualDisponivel || loading || permissoes.length === 0) return;
    setSaving(true);
    try {
      const alteracoes = permissoes.map((item) => ({
        chave: item.chave,
        estado: estados[item.chave] ?? 'herdar',
      }));

      const { error } = await (supabase as any).rpc('salvar_permissoes_usuario', {
        p_user_id: userId,
        p_alteracoes: alteracoes,
      });
      if (error) throw error;

      toast.success(`Permissões de ${userName} atualizadas.`);
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar permissões do usuário:', error);
      toast.error(
        typeof (error as any)?.message === 'string' ? (error as any).message : 'Não foi possível salvar as permissões.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90dvh] max-h-[90dvh] w-[min(1100px,96vw)] max-w-none flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4 sm:px-6">
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Permissões personalizadas
          </DialogTitle>
          <DialogDescription>
            Usuário: <strong>{userName}</strong> · Perfil-base: <strong>{userType}</strong>.
            Escolha em cada linha se o usuário deve herdar, receber ou perder o acesso.
          </DialogDescription>
        </DialogHeader>

        {!loading && !armazenamentoIndividualDisponivel && (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-5 py-2.5 text-sm text-amber-700 dark:text-amber-300 sm:px-6">
            As permissões não foram carregadas. Nenhuma alteração pode ser salva.
            <Button variant="outline" size="sm" className="ml-3" onClick={() => void carregar()}>Tentar novamente</Button>
          </div>
        )}

        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden px-4 py-4 md:grid-cols-[210px_minmax(0,1fr)] sm:px-6">
          <aside className="hidden self-start rounded-lg border bg-muted/20 p-4 md:block">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Resumo
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Herdadas</span>
                <Badge variant="secondary">{resumo.herdadas}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Permitidas</span>
                <Badge className="bg-emerald-600">{resumo.permitidas}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Negadas</span>
                <Badge variant="destructive">{resumo.negadas}</Badge>
              </div>
            </div>
            <div className="mt-4 border-t pt-4 text-xs text-muted-foreground">
              <p><strong>Herdar:</strong> usa o padrão do perfil.</p>
              <p className="mt-2"><strong>Permitir:</strong> libera somente para esta pessoa.</p>
              <p className="mt-2"><strong>Negar:</strong> bloqueia somente para esta pessoa.</p>
            </div>
          </aside>

          <section className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden">
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar módulo, grupo ou permissão..."
                className="pl-9"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-scroll overscroll-contain rounded-lg pr-2 [scrollbar-gutter:stable]">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Carregando permissões...
                </div>
              ) : porModulo.length === 0 ? (
                <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
                  Não foi possível carregar as permissões.
                </div>
              ) : (
                <div className="space-y-3 pb-4">
                  {porModulo.map(([modulo, grupos]) => {
                    const aberto = modulosAbertos.has(modulo) || Boolean(busca.trim());
                    return (
                      <div key={modulo} className="overflow-hidden rounded-lg border">
                        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 bg-muted px-4 py-3">
                          <button
                            type="button"
                            className="flex items-center gap-2 font-semibold"
                            onClick={() =>
                              setModulosAbertos((atual) => {
                                const proximo = new Set(atual);
                                proximo.has(modulo)
                                  ? proximo.delete(modulo)
                                  : proximo.add(modulo);
                                return proximo;
                              })
                            }
                          >
                            {aberto ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            {modulo}
                          </button>

                          <div className="flex flex-wrap gap-1">
                            {(['herdar', 'permitir', 'negar'] as EstadoPermissaoUsuario[]).map(
                              (estado) => (
                                <Button
                                  key={estado}
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => definirModulo(modulo, estado)}
                                >
                                  {estadoLabel[estado]} tudo
                                </Button>
                              ),
                            )}
                          </div>
                        </div>

                        {aberto &&
                          [...grupos.entries()].map(([grupo, itens]) => (
                            <div key={`${modulo}-${grupo}`} className="border-t">
                              <div className="bg-muted/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {grupo}
                              </div>

                              {itens.map((item) => {
                                const estado = estados[item.chave] ?? 'herdar';
                                const efetivo =
                                  estado === 'permitir'
                                    ? true
                                    : estado === 'negar'
                                      ? false
                                      : item.perfil_permitido;

                                return (
                                  <div
                                    key={item.chave}
                                    className="grid gap-3 border-t px-4 py-3 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-center"
                                  >
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-medium">{item.nome}</p>
                                        <Badge
                                          variant={efetivo ? 'default' : 'secondary'}
                                          className={cn(efetivo && 'bg-emerald-600')}
                                        >
                                          {efetivo ? 'Acesso efetivo' : 'Sem acesso'}
                                        </Badge>
                                        <Badge variant="outline">
                                          Perfil: {item.perfil_permitido ? 'permitido' : 'negado'}
                                        </Badge>
                                      </div>
                                      {item.descricao && (
                                        <p className="mt-1 text-xs text-muted-foreground">
                                          {item.descricao}
                                        </p>
                                      )}
                                    </div>

                                    <div className="grid min-w-[270px] grid-cols-3 overflow-hidden rounded-md border">
                                      {(
                                        ['herdar', 'permitir', 'negar'] as EstadoPermissaoUsuario[]
                                      ).map((opcao) => (
                                        <button
                                          key={opcao}
                                          type="button"
                                          onClick={() =>
                                            setEstados((atual) => ({
                                              ...atual,
                                              [item.chave]: opcao,
                                            }))
                                          }
                                          className={cn(
                                            'min-h-10 px-3 py-2 text-xs font-semibold transition-colors',
                                            opcao !== 'herdar' && 'border-l',
                                            estado === opcao &&
                                              opcao === 'herdar' &&
                                              'bg-secondary text-secondary-foreground',
                                            estado === opcao &&
                                              opcao === 'permitir' &&
                                              'bg-emerald-600 text-white',
                                            estado === opcao &&
                                              opcao === 'negar' &&
                                              'bg-destructive text-destructive-foreground',
                                          )}
                                        >
                                          {estadoLabel[opcao]}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>

        <DialogFooter className="sticky bottom-0 z-20 shrink-0 border-t bg-background px-5 py-3 sm:px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={saving || loading || !armazenamentoIndividualDisponivel || permissoes.length === 0}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar permissões
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
