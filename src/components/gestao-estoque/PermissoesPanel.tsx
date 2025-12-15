import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';

interface PermissaoTipoUsuario {
  id: string;
  tipo_usuario: string;
  pode_cadastrar_itens: boolean;
  pode_editar_itens: boolean;
  pode_excluir_itens: boolean;
  pode_registrar_movimentacoes: boolean;
  pode_gerenciar_configuracoes: boolean;
  pode_gerenciar_usuarios: boolean;
}

const TIPOS_USUARIO_LABELS: Record<string, string> = {
  administrador: 'Administrador',
  gestor: 'Gestor',
  engenharia: 'Engenharia',
  mestre: 'Mestre',
  estoquista: 'Estoquista',
};

const PERMISSOES_LABELS: Record<string, string> = {
  pode_cadastrar_itens: 'Cadastrar Itens',
  pode_editar_itens: 'Editar Itens',
  pode_excluir_itens: 'Excluir Itens',
  pode_registrar_movimentacoes: 'Registrar Movimentações',
  pode_gerenciar_configuracoes: 'Gerenciar Configurações',
  pode_gerenciar_usuarios: 'Gerenciar Usuários',
};

export const PermissoesPanel = () => {
  const { toast } = useToast();
  const { isAdmin } = usePermissions();
  const [permissoes, setPermissoes] = useState<PermissaoTipoUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    carregarPermissoes();

    // Configurar realtime
    const channel = supabase
      .channel('permissoes-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'permissoes_tipo_usuario',
        },
        () => {
          carregarPermissoes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const carregarPermissoes = async () => {
    try {
      const { data, error } = await supabase
        .from('permissoes_tipo_usuario')
        .select('*')
        .order('tipo_usuario');

      if (error) throw error;
      setPermissoes(data || []);
    } catch (error) {
      console.error('Erro ao carregar permissões:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as permissões.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePermissao = (tipoUsuario: string, campo: keyof PermissaoTipoUsuario) => {
    if (!isAdmin()) {
      toast({
        title: 'Acesso negado',
        description: 'Apenas administradores podem alterar permissões.',
        variant: 'destructive',
      });
      return;
    }

    setPermissoes((prev) =>
      prev.map((p) =>
        p.tipo_usuario === tipoUsuario
          ? { ...p, [campo]: !p[campo] }
          : p
      )
    );
    setHasChanges(true);
  };

  const handleSalvar = async () => {
    if (!isAdmin()) {
      toast({
        title: 'Acesso negado',
        description: 'Apenas administradores podem alterar permissões.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      for (const permissao of permissoes) {
        const { error } = await supabase
          .from('permissoes_tipo_usuario')
          .update({
            pode_cadastrar_itens: permissao.pode_cadastrar_itens,
            pode_editar_itens: permissao.pode_editar_itens,
            pode_excluir_itens: permissao.pode_excluir_itens,
            pode_registrar_movimentacoes: permissao.pode_registrar_movimentacoes,
            pode_gerenciar_configuracoes: permissao.pode_gerenciar_configuracoes,
            pode_gerenciar_usuarios: permissao.pode_gerenciar_usuarios,
          })
          .eq('id', permissao.id);

        if (error) throw error;
      }

      toast({
        title: 'Permissões salvas!',
        description: 'As permissões foram atualizadas com sucesso.',
      });
      setHasChanges(false);
    } catch (error) {
      console.error('Erro ao salvar permissões:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar as permissões.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const permissoesCampos = Object.keys(PERMISSOES_LABELS) as (keyof PermissaoTipoUsuario)[];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Permissões por Tipo de Usuário
        </CardTitle>
        <CardDescription>
          Configure quais ações cada tipo de usuário pode realizar no sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Permissão</TableHead>
                {permissoes.map((p) => (
                  <TableHead key={p.tipo_usuario} className="text-center">
                    <Badge variant="outline">{TIPOS_USUARIO_LABELS[p.tipo_usuario] || p.tipo_usuario}</Badge>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissoesCampos.map((campo) => (
                <TableRow key={campo}>
                  <TableCell className="font-medium">{PERMISSOES_LABELS[campo]}</TableCell>
                  {permissoes.map((p) => (
                    <TableCell key={`${p.tipo_usuario}-${campo}`} className="text-center">
                      <Checkbox
                        checked={p[campo] as boolean}
                        onCheckedChange={() => handleTogglePermissao(p.tipo_usuario, campo)}
                        disabled={!isAdmin()}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {isAdmin() && (
          <div className="flex justify-end">
            <Button onClick={handleSalvar} disabled={!hasChanges || saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Alterações
            </Button>
          </div>
        )}

        {!isAdmin() && (
          <p className="text-sm text-muted-foreground text-center">
            Apenas administradores podem alterar as permissões.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
