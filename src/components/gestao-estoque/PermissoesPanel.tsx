import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, Save, Loader2, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';

interface PermissaoTipoUsuario {
  id: string;
  tipo_usuario: string;
  pode_cadastrar_itens: boolean;
  pode_editar_itens: boolean;
  pode_excluir_itens: boolean;
  pode_registrar_movimentacoes: boolean;
  pode_gerenciar_configuracoes: boolean;
  pode_gerenciar_usuarios: boolean;
  pode_solicitar_material: boolean;
  pode_devolver_material: boolean;
  pode_registrar_entrada: boolean;
  pode_transferir: boolean;
  pode_registrar_saida: boolean;
  pode_pedido_compra: boolean;
  pode_solicitacao_material: boolean;
  pode_ver_relatorios: boolean;
  pode_editar_movimentacoes: boolean;
}

const TIPOS_USUARIO_LABELS: Record<string, string> = {
  administrador: 'Administrador',
  gestor: 'Gestor',
  engenharia: 'Engenharia',
  mestre: 'Mestre',
  estoquista: 'Estoquista',
};

const TIPOS_USUARIO_COLORS: Record<string, string> = {
  administrador: 'bg-red-500/10 text-red-400 border-red-500/30',
  gestor: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  engenharia: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  mestre: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  estoquista: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
};

interface PermissaoGrupo {
  titulo: string;
  campos: { key: keyof PermissaoTipoUsuario; label: string }[];
}

const PERMISSOES_GRUPOS: PermissaoGrupo[] = [
  {
    titulo: '📦 Gestão de Itens',
    campos: [
      { key: 'pode_cadastrar_itens', label: 'Cadastrar Itens' },
      { key: 'pode_editar_itens', label: 'Editar Itens' },
      { key: 'pode_excluir_itens', label: 'Excluir Itens' },
    ],
  },
  {
    titulo: '🔄 Movimentações',
    campos: [
      { key: 'pode_registrar_movimentacoes', label: 'Registrar Movimentações' },
      { key: 'pode_solicitar_material', label: 'Solicitar Material (Retirada)' },
      { key: 'pode_devolver_material', label: 'Devolver Material' },
      { key: 'pode_registrar_entrada', label: 'Registrar Entrada' },
      { key: 'pode_registrar_saida', label: 'Registrar Saída' },
      { key: 'pode_transferir', label: 'Transferência entre Estoques' },
      { key: 'pode_editar_movimentacoes', label: 'Editar Movimentações' },
    ],
  },
  {
    titulo: '📋 Solicitações e Compras',
    campos: [
      { key: 'pode_solicitacao_material', label: 'Solicitação de Material' },
      { key: 'pode_pedido_compra', label: 'Pedido de Compra' },
    ],
  },
  {
    titulo: '⚙️ Administração',
    campos: [
      { key: 'pode_gerenciar_configuracoes', label: 'Gerenciar Configurações' },
      { key: 'pode_gerenciar_usuarios', label: 'Gerenciar Usuários' },
      { key: 'pode_ver_relatorios', label: 'Ver Relatórios' },
    ],
  },
];

export const PermissoesPanel = () => {
  const { toast } = useToast();
  const { isAdmin } = usePermissions();
  const [permissoes, setPermissoes] = useState<PermissaoTipoUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    carregarPermissoes();

    const channel = supabase
      .channel('permissoes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'permissoes_tipo_usuario' }, () => {
        carregarPermissoes();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const carregarPermissoes = async () => {
    try {
      const { data, error } = await supabase
        .from('permissoes_tipo_usuario')
        .select('*')
        .order('tipo_usuario');

      if (error) throw error;
      setPermissoes((data || []).map((d: any) => ({ ...d, pode_editar_movimentacoes: d.pode_editar_movimentacoes ?? false })));
    } catch (error) {
      console.error('Erro ao carregar permissões:', error);
      toast({ title: 'Erro', description: 'Não foi possível carregar as permissões.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePermissao = (tipoUsuario: string, campo: keyof PermissaoTipoUsuario) => {
    if (!isAdmin()) {
      toast({ title: 'Acesso negado', description: 'Apenas administradores podem alterar permissões.', variant: 'destructive' });
      return;
    }

    setPermissoes((prev) =>
      prev.map((p) => p.tipo_usuario === tipoUsuario ? { ...p, [campo]: !p[campo] } : p)
    );
    setHasChanges(true);
  };

  const handleSalvar = async () => {
    if (!isAdmin()) return;
    setSaving(true);
    try {
      const allCampos = PERMISSOES_GRUPOS.flatMap(g => g.campos.map(c => c.key));
      for (const permissao of permissoes) {
        const upsertData: any = { id: permissao.id, tipo_usuario: permissao.tipo_usuario };
        allCampos.forEach(campo => { upsertData[campo] = (permissao as any)[campo]; });

        const { error } = await supabase
          .from('permissoes_tipo_usuario')
          .upsert(upsertData, { onConflict: 'id' });

        if (error) {
          console.error('Supabase error details:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            tipo_usuario: permissao.tipo_usuario,
          });
          throw error;
        }
      }
      toast({ title: 'Permissões salvas!', description: 'As permissões foram atualizadas com sucesso.' });
      setHasChanges(false);
    } catch (error: any) {
      console.error('Erro ao salvar permissões:', error);
      toast({
        title: 'Erro',
        description: `Não foi possível salvar as permissões. ${error?.message || ''}`,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5 text-primary" />
          Permissões por Tipo de Usuário
        </CardTitle>
        <CardDescription>
          Configure quais ações cada tipo de usuário pode realizar no sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Header com tipos de usuário */}
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="bg-muted/30 px-3 py-3 text-left font-medium text-muted-foreground w-[30%]">
                  Permissão
                </th>
                {permissoes.map((p) => (
                  <th key={p.tipo_usuario} className="px-1 py-3 text-center">
                    <Badge variant="outline" className={cn('text-xs font-medium', TIPOS_USUARIO_COLORS[p.tipo_usuario])}>
                      {TIPOS_USUARIO_LABELS[p.tipo_usuario] || p.tipo_usuario}
                    </Badge>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSOES_GRUPOS.map((grupo, gIdx) => (
                <>
                  {/* Separador de grupo */}
                  <tr key={`grupo-${gIdx}`} className="bg-muted/20">
                    <td colSpan={permissoes.length + 1} className="px-4 py-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {grupo.titulo}
                      </span>
                    </td>
                  </tr>
                  {grupo.campos.map((campo, cIdx) => (
                    <tr
                      key={campo.key}
                      className={cn(
                        'border-b border-border/30 transition-colors hover:bg-muted/20',
                        cIdx === grupo.campos.length - 1 && 'border-b-0'
                      )}
                    >
                      <td className="bg-card px-3 py-2.5 font-medium text-foreground text-xs">
                        {campo.label}
                      </td>
                      {permissoes.map((p) => {
                        const isChecked = p[campo.key] as boolean;
                        return (
                          <td key={`${p.tipo_usuario}-${campo.key}`} className="px-3 py-2.5 text-center">
                            <div className="flex items-center justify-center">
                              {isAdmin() ? (
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={() => handleTogglePermissao(p.tipo_usuario, campo.key)}
                                  className={cn(
                                    'h-5 w-5 rounded transition-all',
                                    isChecked
                                      ? 'border-emerald-500 bg-emerald-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500'
                                      : 'border-muted-foreground/30'
                                  )}
                                />
                              ) : (
                                <div className={cn(
                                  'flex h-6 w-6 items-center justify-center rounded-full',
                                  isChecked
                                    ? 'bg-emerald-500/15 text-emerald-500'
                                    : 'bg-muted text-muted-foreground/40'
                                )}>
                                  {isChecked ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Ações */}
        {isAdmin() && (
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {hasChanges ? '⚠️ Você tem alterações não salvas' : '✅ Todas as permissões estão salvas'}
            </p>
            <Button onClick={handleSalvar} disabled={!hasChanges || saving} size="sm">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Alterações
            </Button>
          </div>
        )}

        {!isAdmin() && (
          <p className="text-sm text-muted-foreground text-center py-2">
            Apenas administradores podem alterar as permissões.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
