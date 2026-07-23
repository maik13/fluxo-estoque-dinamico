import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Edit, Search, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { userEditSchema, type UserEditInput } from '@/schemas/validation';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { usePermissions } from '@/hooks/usePermissions';
import { PermissoesUsuarioDialog } from './PermissoesUsuarioDialog';

interface Profile {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  tipo_usuario: string;
  ativo: boolean;
  created_at: string;
}

export const UsuariosList = () => {
  const { userProfile, permissoesDinamicas, hasPermission } = usePermissions();
  const [usuarios, setUsuarios] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editandoUsuario, setEditandoUsuario] = useState<Profile | null>(null);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [usuarioPermissoes, setUsuarioPermissoes] = useState<Profile | null>(null);
  const [permissoesDialogAberto, setPermissoesDialogAberto] = useState(false);
  const { toast } = useToast();

  const isAdmin = userProfile?.tipo_usuario === 'administrador';
  const podeVisualizarUsuarios =
    isAdmin ||
    hasPermission('administracao.usuarios.visualizar') ||
    permissoesDinamicas.pode_gerenciar_usuarios;
  const podeEditarUsuarios =
    isAdmin ||
    hasPermission('administracao.usuarios.editar') ||
    permissoesDinamicas.pode_gerenciar_usuarios;
  const podeAtivarUsuarios =
    isAdmin ||
    hasPermission('administracao.usuarios.ativar') ||
    permissoesDinamicas.pode_gerenciar_usuarios;
  const podeGerenciarPermissoes =
    isAdmin || hasPermission('administracao.permissoes.gerenciar');

  const form = useForm<UserEditInput>({
    resolver: zodResolver(userEditSchema),
    defaultValues: {
      nome: '',
      email: '',
      tipo_usuario: 'estoquista',
    },
  });

  useEffect(() => {
    if (podeVisualizarUsuarios) {
      void carregarUsuarios();
    } else {
      setLoading(false);
    }
  }, [podeVisualizarUsuarios]);

  const carregarUsuarios = async () => {
    if (!podeVisualizarUsuarios) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, nome, email, tipo_usuario, ativo, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsuarios((data ?? []) as Profile[]);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast({
        title: 'Erro ao carregar usuários',
        description: 'Não foi possível carregar a lista de usuários.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const abrirDialogEdicao = (usuario: Profile) => {
    if (!podeEditarUsuarios) {
      toast({
        title: 'Acesso negado',
        description: 'Você não pode editar usuários.',
        variant: 'destructive',
      });
      return;
    }

    setEditandoUsuario(usuario);
    form.reset({
      nome: usuario.nome,
      email: usuario.email,
      tipo_usuario: usuario.tipo_usuario as UserEditInput['tipo_usuario'],
    });
    setDialogAberto(true);
  };

  const abrirPermissoes = (usuario: Profile) => {
    if (!podeGerenciarPermissoes) {
      toast({
        title: 'Acesso negado',
        description: 'Você não pode alterar permissões individuais.',
        variant: 'destructive',
      });
      return;
    }

    setUsuarioPermissoes(usuario);
    setPermissoesDialogAberto(true);
  };

  const fecharDialog = () => {
    setDialogAberto(false);
    setEditandoUsuario(null);
    form.reset();
  };

  const salvarEdicao = async (data: UserEditInput) => {
    if (!editandoUsuario || !podeEditarUsuarios) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          nome: data.nome,
          email: data.email,
          tipo_usuario: data.tipo_usuario,
        })
        .eq('id', editandoUsuario.id);

      if (error) throw error;

      setUsuarios((prev) =>
        prev.map((usuario) =>
          usuario.id === editandoUsuario.id
            ? { ...usuario, ...data }
            : usuario,
        ),
      );

      toast({
        title: 'Usuário atualizado!',
        description: 'As informações do usuário foram atualizadas com sucesso.',
      });
      fecharDialog();
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o usuário.',
        variant: 'destructive',
      });
    }
  };

  const toggleUsuarioStatus = async (userId: string, novoStatus: boolean) => {
    if (!podeAtivarUsuarios) {
      toast({
        title: 'Acesso negado',
        description: 'Você não pode ativar ou desativar usuários.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ativo: novoStatus })
        .eq('id', userId);

      if (error) throw error;

      setUsuarios((prev) =>
        prev.map((usuario) =>
          usuario.id === userId ? { ...usuario, ativo: novoStatus } : usuario,
        ),
      );

      toast({
        title: 'Status atualizado!',
        description: `Usuário ${novoStatus ? 'ativado' : 'desativado'} com sucesso.`,
      });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o status do usuário.',
        variant: 'destructive',
      });
    }
  };

  const usuariosFiltrados = usuarios.filter((usuario) => {
    const termo = searchTerm.toLocaleLowerCase('pt-BR');
    return (
      usuario.nome.toLocaleLowerCase('pt-BR').includes(termo) ||
      usuario.email.toLocaleLowerCase('pt-BR').includes(termo) ||
      usuario.tipo_usuario.toLocaleLowerCase('pt-BR').includes(termo)
    );
  });

  const getTipoUsuarioBadge = (tipo: string) => {
    const cores = {
      administrador: 'destructive',
      gestor: 'default',
      engenharia: 'secondary',
      mestre: 'outline',
      estoquista: 'secondary',
    };
    return cores[tipo as keyof typeof cores] || 'secondary';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          <p className="text-muted-foreground">Carregando usuários...</p>
        </div>
      </div>
    );
  }

  if (!podeVisualizarUsuarios) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 p-12">
        <div className="space-y-3 text-center">
          <UserX className="mx-auto h-12 w-12 text-destructive opacity-50" />
          <h3 className="text-lg font-semibold text-destructive">Acesso Negado</h3>
          <p className="max-w-xs text-sm text-muted-foreground">
            Você não tem permissão para visualizar a lista de usuários do sistema.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Pesquisar usuários por nome, email ou tipo..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="pl-10"
        />
      </div>

      <div className="mb-4 grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-3">
          <div className="text-sm text-muted-foreground">Total</div>
          <div className="text-2xl font-bold">{usuarios.length}</div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-sm text-muted-foreground">Ativos</div>
          <div className="text-2xl font-bold text-green-600">
            {usuarios.filter((usuario) => usuario.ativo).length}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-sm text-muted-foreground">Inativos</div>
          <div className="text-2xl font-bold text-red-600">
            {usuarios.filter((usuario) => !usuario.ativo).length}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Nome</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Email</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Tipo</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Cadastrado em</th>
              <th className="px-3 py-3 text-right font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuariosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  {searchTerm
                    ? 'Nenhum usuário encontrado com os critérios de pesquisa.'
                    : 'Nenhum usuário cadastrado.'}
                </td>
              </tr>
            ) : (
              usuariosFiltrados.map((usuario) => (
                <tr key={usuario.id} className="border-b transition-colors hover:bg-muted/50">
                  <td className="whitespace-nowrap px-3 py-2.5 font-medium">{usuario.nome}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{usuario.email}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={getTipoUsuarioBadge(usuario.tipo_usuario) as any} className="text-xs">
                      {usuario.tipo_usuario}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={usuario.ativo ? 'default' : 'secondary'} className="text-xs">
                      {usuario.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {new Date(usuario.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      {podeGerenciarPermissoes && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => abrirPermissoes(usuario)}
                          title="Configurar acessos deste usuário"
                          aria-label={`Configurar acessos de ${usuario.nome}`}
                        >
                          <ShieldCheck className="h-4 w-4 text-primary" />
                        </Button>
                      )}

                      {podeAtivarUsuarios && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void toggleUsuarioStatus(usuario.id, !usuario.ativo)}
                          title={usuario.ativo ? 'Desativar usuário' : 'Ativar usuário'}
                          aria-label={`${usuario.ativo ? 'Desativar' : 'Ativar'} ${usuario.nome}`}
                        >
                          {usuario.ativo ? (
                            <UserX className="h-4 w-4 text-red-600" />
                          ) : (
                            <UserCheck className="h-4 w-4 text-green-600" />
                          )}
                        </Button>
                      )}

                      {podeEditarUsuarios && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => abrirDialogEdicao(usuario)}
                          title="Editar usuário"
                          aria-label={`Editar ${usuario.nome}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Altere as informações cadastrais e o perfil-base. Os acessos individuais são configurados pelo ícone de escudo na lista.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(salvarEdicao)} className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@exemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tipo_usuario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Perfil-base</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o perfil-base" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="administrador">Administrador</SelectItem>
                        <SelectItem value="gestor">Gestor</SelectItem>
                        <SelectItem value="engenharia">Engenharia</SelectItem>
                        <SelectItem value="mestre">Mestre</SelectItem>
                        <SelectItem value="estoquista">Estoquista</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={fecharDialog}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {usuarioPermissoes && (
        <PermissoesUsuarioDialog
          open={permissoesDialogAberto}
          onOpenChange={(open) => {
            setPermissoesDialogAberto(open);
            if (!open) setUsuarioPermissoes(null);
          }}
          userId={usuarioPermissoes.user_id}
          userName={usuarioPermissoes.nome}
          userType={usuarioPermissoes.tipo_usuario}
        />
      )}
    </div>
  );
};
