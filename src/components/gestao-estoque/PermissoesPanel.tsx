import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Search, Shield, SlidersHorizontal, UserCog, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { PermissoesUsuarioDialog } from './PermissoesUsuarioDialog';

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
  pode_acessar_gerencial: boolean;
  pode_acessar_projetos: boolean;
  pode_apontar_producao: boolean;
  pode_conferir_producao: boolean;
  pode_ver_bi_producao: boolean;
  pode_configurar_producao: boolean;
}

interface UsuarioPermissoes {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  tipo_usuario: string;
  ativo: boolean;
  created_at: string;
}

const TIPOS_USUARIO_LABELS: Record<string, string> = {
  administrador: 'Administrador',
  gestor: 'Gestor',
  engenharia: 'Engenharia',
  mestre: 'Mestre',
  estoquista: 'Estoquista',
};

const TIPOS_USUARIO_COLORS: Record<string, string> = {
  administrador: 'bg-red-500/10 text-red-500 border-red-500/30',
  gestor: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  engenharia: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
  mestre: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  estoquista: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
};

interface PermissaoGrupo {
  titulo: string;
  campos: { key: keyof PermissaoTipoUsuario; label: string }[];
}

const PERMISSOES_GRUPOS: PermissaoGrupo[] = [
  {
    titulo: 'Gestão de Itens',
    campos: [
      { key: 'pode_cadastrar_itens', label: 'Cadastrar itens' },
      { key: 'pode_editar_itens', label: 'Editar itens' },
      { key: 'pode_excluir_itens', label: 'Excluir itens' },
    ],
  },
  {
    titulo: 'Movimentações',
    campos: [
      { key: 'pode_registrar_movimentacoes', label: 'Registrar movimentações' },
      { key: 'pode_solicitar_material', label: 'Solicitar material' },
      { key: 'pode_devolver_material', label: 'Devolver material' },
      { key: 'pode_registrar_entrada', label: 'Registrar entrada' },
      { key: 'pode_registrar_saida', label: 'Registrar saída' },
      { key: 'pode_transferir', label: 'Transferir entre estoques' },
      { key: 'pode_editar_movimentacoes', label: 'Editar movimentações' },
    ],
  },
  {
    titulo: 'Solicitações e Compras',
    campos: [
      { key: 'pode_solicitacao_material', label: 'Gerenciar solicitações' },
      { key: 'pode_pedido_compra', label: 'Pedido de compra' },
    ],
  },
  {
    titulo: 'Produção',
    campos: [
      { key: 'pode_apontar_producao', label: 'Apontar Produção' },
      { key: 'pode_conferir_producao', label: 'Conferir Produção' },
      { key: 'pode_ver_bi_producao', label: 'Ver BI Produção' },
      { key: 'pode_configurar_producao', label: 'Configurar Produção' },
    ],
  },
  {
    titulo: 'Administração',
    campos: [
      { key: 'pode_gerenciar_configuracoes', label: 'Gerenciar configurações' },
      { key: 'pode_gerenciar_usuarios', label: 'Gerenciar usuários' },
      { key: 'pode_ver_relatorios', label: 'Ver relatórios' },
      { key: 'pode_acessar_gerencial', label: 'Acessar painel gerencial' },
      { key: 'pode_acessar_projetos', label: 'Acessar projetos' },
    ],
  },
];

export const PermissoesPanel = () => {
  const { toast } = useToast();
  const { isAdmin, hasPermission } = usePermissions();
  const podeGerenciar = isAdmin() || hasPermission('administracao.permissoes.gerenciar');
  const [permissoes, setPermissoes] = useState<PermissaoTipoUsuario[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioPermissoes[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [busca, setBusca] = useState('');
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<UsuarioPermissoes | null>(null);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [permissoesResult, usuariosResult] = await Promise.all([
        supabase.from('permissoes_tipo_usuario').select('*').order('tipo_usuario'),
        supabase.from('profiles').select('id,user_id,nome,email,tipo_usuario,ativo,created_at').order('nome'),
      ]);
      if (permissoesResult.error) throw permissoesResult.error;
      if (usuariosResult.error) throw usuariosResult.error;

      setPermissoes((permissoesResult.data ?? []).map((item: any) => ({
        ...item,
        pode_editar_movimentacoes: item.pode_editar_movimentacoes ?? false,
        pode_acessar_gerencial: item.pode_acessar_gerencial ?? false,
        pode_acessar_projetos: item.pode_acessar_projetos ?? false,
        pode_apontar_producao: item.pode_apontar_producao ?? false,
        pode_conferir_producao: item.pode_conferir_producao ?? false,
        pode_ver_bi_producao: item.pode_ver_bi_producao ?? false,
        pode_configurar_producao: item.pode_configurar_producao ?? false,
      })) as PermissaoTipoUsuario[]);
      setUsuarios((usuariosResult.data ?? []) as UsuarioPermissoes[]);
    } catch (error) {
      console.error('Erro ao carregar permissões:', error);
      toast({ title: 'Erro', description: 'Não foi possível carregar usuários e permissões.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregarDados();
  }, []);

  const usuariosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    if (!termo) return usuarios;
    return usuarios.filter((usuario) =>
      [usuario.nome, usuario.email, usuario.tipo_usuario]
        .some((valor) => valor.toLocaleLowerCase('pt-BR').includes(termo)),
    );
  }, [busca, usuarios]);

  const alternarPermissaoPerfil = (tipoUsuario: string, campo: keyof PermissaoTipoUsuario) => {
    if (!podeGerenciar) return;
    setPermissoes((atuais) => atuais.map((permissao) =>
      permissao.tipo_usuario === tipoUsuario
        ? { ...permissao, [campo]: !permissao[campo] }
        : permissao,
    ));
    setHasChanges(true);
  };

  const salvarPerfis = async () => {
    if (!podeGerenciar) return;
    setSaving(true);
    try {
      const campos = PERMISSOES_GRUPOS.flatMap((grupo) => grupo.campos.map((campo) => campo.key));
      for (const permissao of permissoes) {
        const dados: Record<string, unknown> = { id: permissao.id, tipo_usuario: permissao.tipo_usuario };
        campos.forEach((campo) => { dados[campo] = permissao[campo]; });
        const { error } = await supabase.from('permissoes_tipo_usuario').upsert(dados as any, { onConflict: 'id' });
        if (error) throw error;
      }
      toast({ title: 'Padrões salvos', description: 'Os perfis-base foram atualizados. Usuários em modo Herdar recebem os novos valores.' });
      setHasChanges(false);
    } catch (error) {
      console.error('Erro ao salvar padrões:', error);
      toast({ title: 'Erro', description: 'Não foi possível salvar os padrões por perfil.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Card><CardContent className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  return (
    <>
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" />Controle de acessos</CardTitle>
          <CardDescription>Defina padrões por perfil e depois personalize cada usuário sem criar novos cargos.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="usuarios" className="space-y-5">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="usuarios" className="gap-2"><UserCog className="h-4 w-4" />Permissões por usuário</TabsTrigger>
              <TabsTrigger value="perfis" className="gap-2"><SlidersHorizontal className="h-4 w-4" />Padrões por perfil</TabsTrigger>
            </TabsList>

            <TabsContent value="usuarios" className="space-y-4">
              <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                O perfil-base continua sendo Engenharia, Gestor, Mestre, Estoquista ou Administrador. As permissões individuais podem <strong>herdar</strong>, <strong>permitir</strong> ou <strong>negar</strong> cada acesso.
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Pesquisar por nome, e-mail ou perfil..." className="pl-9" />
              </div>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-4 py-3 text-left">Usuário</th>
                      <th className="px-4 py-3 text-left">Perfil-base</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-right">Acessos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuariosFiltrados.map((usuario) => (
                      <tr key={usuario.id} className="border-t hover:bg-muted/20">
                        <td className="px-4 py-3"><p className="font-medium">{usuario.nome}</p><p className="text-xs text-muted-foreground">{usuario.email}</p></td>
                        <td className="px-4 py-3"><Badge variant="outline" className={TIPOS_USUARIO_COLORS[usuario.tipo_usuario]}>{TIPOS_USUARIO_LABELS[usuario.tipo_usuario] ?? usuario.tipo_usuario}</Badge></td>
                        <td className="px-4 py-3"><Badge variant={usuario.ativo ? 'default' : 'secondary'}>{usuario.ativo ? 'Ativo' : 'Inativo'}</Badge></td>
                        <td className="px-4 py-3 text-right"><Button size="sm" variant="outline" disabled={!podeGerenciar || !usuario.user_id} onClick={() => setUsuarioSelecionado(usuario)}><Shield className="mr-2 h-4 w-4" />Configurar permissões</Button></td>
                      </tr>
                    ))}
                    {usuariosFiltrados.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">Nenhum usuário encontrado.</td></tr>}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="perfis" className="space-y-4">
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[800px] table-fixed text-sm">
                  <thead><tr className="border-b bg-muted/30"><th className="w-[30%] px-3 py-3 text-left">Permissão padrão</th>{permissoes.map((item) => <th key={item.tipo_usuario} className="px-2 py-3 text-center"><Badge variant="outline" className={TIPOS_USUARIO_COLORS[item.tipo_usuario]}>{TIPOS_USUARIO_LABELS[item.tipo_usuario] ?? item.tipo_usuario}</Badge></th>)}</tr></thead>
                  <tbody>
                    {PERMISSOES_GRUPOS.map((grupo) => (
                      <>
                        <tr key={`grupo-${grupo.titulo}`} className="bg-muted/20"><td colSpan={permissoes.length + 1} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{grupo.titulo}</td></tr>
                        {grupo.campos.map((campo) => (
                          <tr key={String(campo.key)} className="border-t hover:bg-muted/20">
                            <td className="px-3 py-2.5 text-xs font-medium">{campo.label}</td>
                            {permissoes.map((item) => {
                              const checked = Boolean(item[campo.key]);
                              return <td key={`${item.tipo_usuario}-${String(campo.key)}`} className="px-3 py-2.5 text-center">{podeGerenciar ? <Checkbox checked={checked} onCheckedChange={() => alternarPermissaoPerfil(item.tipo_usuario, campo.key)} /> : <span className={cn('mx-auto flex h-6 w-6 items-center justify-center rounded-full', checked ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground/40')}>{checked ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}</span>}</td>;
                            })}
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
              {podeGerenciar && <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3"><p className="text-xs text-muted-foreground">{hasChanges ? 'Existem alterações de perfil não salvas.' : 'Todos os padrões estão salvos.'}</p><Button onClick={salvarPerfis} disabled={!hasChanges || saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar padrões</Button></div>}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {usuarioSelecionado?.user_id && (
        <PermissoesUsuarioDialog
          open={Boolean(usuarioSelecionado)}
          onOpenChange={(open) => { if (!open) setUsuarioSelecionado(null); }}
          userId={usuarioSelecionado.user_id}
          userName={usuarioSelecionado.nome}
          userType={TIPOS_USUARIO_LABELS[usuarioSelecionado.tipo_usuario] ?? usuarioSelecionado.tipo_usuario}
        />
      )}
    </>
  );
};
