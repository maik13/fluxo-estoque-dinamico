import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit, UserCheck, UserX, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { userEditSchema, type UserEditInput } from '@/schemas/validation';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

interface Profile {
  id: string;
  nome: string;
  email: string;
  tipo_usuario: string;
  ativo: boolean;
  created_at: string;
}

export const UsuariosList = () => {
  const [usuarios, setUsuarios] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editandoUsuario, setEditandoUsuario] = useState<Profile | null>(null);
  const [dialogAberto, setDialogAberto] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<UserEditInput>({
    resolver: zodResolver(userEditSchema),
    defaultValues: {
      nome: '',
      email: '',
      tipo_usuario: 'estoquista'
    }
  });

  useEffect(() => {
    carregarUsuarios();
  }, []);

  const carregarUsuarios = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar usuários:', error);
        toast({
          title: "Erro ao carregar usuários",
          description: "Não foi possível carregar a lista de usuários.",
          variant: "destructive",
        });
        return;
      }

      setUsuarios(data || []);
    } catch (error) {
      console.error('Erro:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const abrirDialogEdicao = (usuario: Profile) => {
    setEditandoUsuario(usuario);
    form.reset({
      nome: usuario.nome,
      email: usuario.email,
      tipo_usuario: usuario.tipo_usuario as any
    });
    setDialogAberto(true);
  };

  const fecharDialog = () => {
    setDialogAberto(false);
    setEditandoUsuario(null);
    form.reset();
  };

  const salvarEdicao = async (data: UserEditInput) => {
    if (!editandoUsuario) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          nome: data.nome,
          email: data.email,
          tipo_usuario: data.tipo_usuario
        })
        .eq('id', editandoUsuario.id);

      if (error) throw error;

      setUsuarios(prev =>
        prev.map(user =>
          user.id === editandoUsuario.id
            ? { ...user, ...data }
            : user
        )
      );

      toast({
        title: "Usuário atualizado!",
        description: "As informações do usuário foram atualizadas com sucesso.",
      });

      fecharDialog();
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o usuário.",
        variant: "destructive",
      });
    }
  };

  const toggleUsuarioStatus = async (userId: string, novoStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ativo: novoStatus })
        .eq('id', userId);

      if (error) throw error;

      setUsuarios(prev => 
        prev.map(user => 
          user.id === userId ? { ...user, ativo: novoStatus } : user
        )
      );

      toast({
        title: "Status atualizado!",
        description: `Usuário ${novoStatus ? 'ativado' : 'desativado'} com sucesso.`,
      });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do usuário.",
        variant: "destructive",
      });
    }
  };

  const usuariosFiltrados = usuarios.filter(usuario =>
    usuario.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    usuario.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    usuario.tipo_usuario.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTipoUsuarioBadge = (tipo: string) => {
    const cores = {
      'administrador': 'destructive',
      'gestor': 'default',
      'engenharia': 'secondary',
      'mestre': 'outline',
      'estoquista': 'secondary'
    };
    return cores[tipo as keyof typeof cores] || 'secondary';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando usuários...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de pesquisa */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar usuários por nome, email ou tipo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-card p-3 rounded-lg border">
          <div className="text-sm text-muted-foreground">Total</div>
          <div className="text-2xl font-bold">{usuarios.length}</div>
        </div>
        <div className="bg-card p-3 rounded-lg border">
          <div className="text-sm text-muted-foreground">Ativos</div>
          <div className="text-2xl font-bold text-green-600">
            {usuarios.filter(u => u.ativo).length}
          </div>
        </div>
        <div className="bg-card p-3 rounded-lg border">
          <div className="text-sm text-muted-foreground">Inativos</div>
          <div className="text-2xl font-bold text-red-600">
            {usuarios.filter(u => !u.ativo).length}
          </div>
        </div>
      </div>

      {/* Tabela de usuários */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Cadastrado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuariosFiltrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {searchTerm ? 'Nenhum usuário encontrado com os critérios de pesquisa.' : 'Nenhum usuário cadastrado.'}
                </TableCell>
              </TableRow>
            ) : (
              usuariosFiltrados.map((usuario) => (
                <TableRow key={usuario.id}>
                  <TableCell className="font-medium">{usuario.nome}</TableCell>
                  <TableCell>{usuario.email}</TableCell>
                  <TableCell>
                    <Badge variant={getTipoUsuarioBadge(usuario.tipo_usuario) as any}>
                      {usuario.tipo_usuario}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={usuario.ativo ? 'default' : 'secondary'}>
                      {usuario.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(usuario.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleUsuarioStatus(usuario.id, !usuario.ativo)}
                        title={usuario.ativo ? 'Desativar usuário' : 'Ativar usuário'}
                      >
                        {usuario.ativo ? (
                          <UserX className="h-4 w-4 text-red-600" />
                        ) : (
                          <UserCheck className="h-4 w-4 text-green-600" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => abrirDialogEdicao(usuario)}
                        title="Editar usuário"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog de Edição */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Altere as informações do usuário abaixo.
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
                    <FormLabel>Tipo de Usuário</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
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
    </div>
  );
};