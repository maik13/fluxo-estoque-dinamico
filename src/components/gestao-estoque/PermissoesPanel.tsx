import { useEffect, useState } from 'react';
import { Check, Loader2, Plus, Shield, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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
  pode_acessar_gerencial: boolean;
  pode_acessar_projetos: boolean;
  pode_apontar_producao: boolean;
  pode_conferir_producao: boolean;
  pode_ver_bi_producao: boolean;
  pode_configurar_producao: boolean;
  pode_acessar_financeiro: boolean;
  pode_gerenciar_financeiro: boolean;
  pode_aprovar_financeiro: boolean;
  pode_programar_financeiro: boolean;
  pode_conciliar_financeiro: boolean;
}

const TIPOS_USUARIO_LABELS: Record<string, string> = {
  administrador: 'Administrador',
  gestor: 'Gestor',
  engenharia: 'Engenharia',
  mestre: 'Mestre',
  estoquista: 'Estoquista',
  financeiro: 'Financeiro',
};

const TIPOS_USUARIO_COLORS: Record<string, string> = {
  administrador: 'bg-red-500/10 text-red-500 border-red-500/30',
  gestor: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  engenharia: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
  mestre: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  estoquista: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  financeiro: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30',
};

interface PermissaoGrupo {
  titulo: string;
  campos: { key: keyof PermissaoTipoUsuario; label: string }[];
}

export const PERMISSOES_GRUPOS: PermissaoGrupo[] = [
  {
    titulo: 'Gestão de Itens',
    campos: [
      { key: 'pode_cadastrar_itens', label: 'Cadastrar itens' },
      { key: 'pode_editar_itens', label: 'Editar itens' },
      { key: 'pode_excluir_itens', label: 'Excluir itens' },
    ],
  },
  {
    titulo: 'Retirada e devolução',
    campos: [
      { key: 'pode_solicitar_material', label: 'Retirada de Material' },
      { key: 'pode_devolver_material', label: 'Devolver material' },
    ],
  },
  {
    titulo: 'Movimentações diretas',
    campos: [
      { key: 'pode_registrar_movimentacoes', label: 'Registrar movimentações' },
      { key: 'pode_registrar_entrada', label: 'Registrar entrada' },
      { key: 'pode_registrar_saida', label: 'Registrar saída' },
      { key: 'pode_transferir', label: 'Transferir entre estoques' },
      { key: 'pode_editar_movimentacoes', label: 'Editar movimentações' },
    ],
  },
  {
    titulo: 'Solicitações e Compras',
    campos: [
      { key: 'pode_solicitacao_material', label: 'Solicitação de Material' },
      { key: 'pode_pedido_compra', label: 'Pedido de compra' },
    ],
  },
  {
    titulo: 'Produção',
    campos: [
      { key: 'pode_apontar_producao', label: 'Apontar Produção' },
      { key: 'pode_conferir_producao', label: 'Conferir Produção' },
      { key: 'pode_configurar_producao', label: 'Configurar Produção' },
    ],
  },
  {
    titulo: 'Gerencial',
    campos: [
      { key: 'pode_acessar_gerencial', label: 'Acessar Gerencial de Almoxarifado' },
      { key: 'pode_ver_bi_producao', label: 'Ver somente BI Produção' },
    ],
  },
  {
    titulo: 'Financeiro',
    campos: [
      { key: 'pode_acessar_financeiro', label: 'Acessar Financeiro' },
      { key: 'pode_gerenciar_financeiro', label: 'Gerenciar Financeiro' },
      { key: 'pode_aprovar_financeiro', label: 'Aprovar compromissos financeiros' },
      { key: 'pode_programar_financeiro', label: 'Programar pagamentos' },
      { key: 'pode_conciliar_financeiro', label: 'Conciliar banco' },
    ],
  },
  {
    titulo: 'Administração',
    campos: [
      { key: 'pode_gerenciar_configuracoes', label: 'Gerenciar configurações' },
      { key: 'pode_gerenciar_usuarios', label: 'Gerenciar usuários' },
      { key: 'pode_ver_relatorios', label: 'Ver relatórios' },
      { key: 'pode_acessar_projetos', label: 'Acessar projetos' },
    ],
  },
];

export const PermissoesPanel = () => {
  const { toast } = useToast();
  const { isAdmin, hasPermission } = usePermissions();
  const podeGerenciar = isAdmin() || hasPermission('administracao.permissoes.gerenciar');
  const [permissoes, setPermissoes] = useState<PermissaoTipoUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [novoPerfil, setNovoPerfil] = useState('');
  const [criandoPerfil, setCriandoPerfil] = useState(false);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('permissoes_tipo_usuario')
        .select('*')
        .order('tipo_usuario');

      if (error) throw error;
      setPermissoes((data ?? []).map((item: any) => ({
        ...item,
        pode_editar_movimentacoes: item.pode_editar_movimentacoes ?? false,
        pode_acessar_gerencial: item.pode_acessar_gerencial ?? false,
        pode_acessar_projetos: item.pode_acessar_projetos ?? false,
        pode_apontar_producao: item.pode_apontar_producao ?? false,
        pode_conferir_producao: item.pode_conferir_producao ?? false,
        pode_ver_bi_producao: item.pode_ver_bi_producao ?? false,
        pode_configurar_producao: item.pode_configurar_producao ?? false,
        pode_acessar_financeiro: item.pode_acessar_financeiro ?? false,
        pode_gerenciar_financeiro: item.pode_gerenciar_financeiro ?? false,
        pode_aprovar_financeiro: item.pode_aprovar_financeiro ?? false,
        pode_programar_financeiro: item.pode_programar_financeiro ?? false,
        pode_conciliar_financeiro: item.pode_conciliar_financeiro ?? false,
      })) as PermissaoTipoUsuario[]);
    } catch (error) {
      console.error('Erro ao carregar permissões:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os padrões de permissões.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregarDados();
  }, []);

  const alternarPermissaoPerfil = (
    tipoUsuario: string,
    campo: keyof PermissaoTipoUsuario,
  ) => {
    if (!podeGerenciar) return;
    setPermissoes((atuais) =>
      atuais.map((permissao) =>
        permissao.tipo_usuario === tipoUsuario
          ? { ...permissao, [campo]: !permissao[campo] }
          : permissao,
      ),
    );
    setHasChanges(true);
  };

  const criarPerfil = async () => {
    if (!podeGerenciar) return;
    const tipo = novoPerfil.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, '_');
    if (!tipo) {
      toast({ title: 'Informe o nome do perfil', variant: 'destructive' });
      return;
    }
    if (!/^[a-z0-9_]+$/.test(tipo)) {
      toast({ title: 'Nome inválido', description: 'Use letras, números e espaços.', variant: 'destructive' });
      return;
    }
    if (permissoes.some((p) => p.tipo_usuario === tipo)) {
      toast({ title: 'Perfil já existe', variant: 'destructive' });
      return;
    }

    setCriandoPerfil(true);
    try {
      const { error } = await (supabase as any).rpc('criar_perfil_acesso', { p_tipo_usuario: tipo });
      if (error) throw error;
      setNovoPerfil('');
      toast({ title: 'Perfil criado', description: 'Agora marque os acessos padrão e salve.' });
      await carregarDados();
    } catch (error) {
      console.error(error);
      toast({ title: 'Erro', description: 'Não foi possível criar o perfil.', variant: 'destructive' });
    } finally {
      setCriandoPerfil(false);
    }
  };

  const salvarPerfis = async () => {
    if (!podeGerenciar) return;
    setSaving(true);
    try {
      const campos = PERMISSOES_GRUPOS.flatMap((grupo) =>
        grupo.campos.map((campo) => campo.key),
      );

      for (const permissao of permissoes) {
        const dados: Record<string, unknown> = {
          id: permissao.id,
          tipo_usuario: permissao.tipo_usuario,
        };
        campos.forEach((campo) => {
          dados[campo] = permissao[campo];
        });

        const { error } = await supabase
          .from('permissoes_tipo_usuario')
          .upsert(dados as any, { onConflict: 'id' });
        if (error) throw error;
      }

      toast({
        title: 'Padrões salvos',
        description: 'Os perfis-base foram atualizados. Usuários em modo Herdar recebem os novos valores.',
      });
      setHasChanges(false);
    } catch (error) {
      console.error('Erro ao salvar padrões:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar os padrões por perfil.',
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Padrões de acesso por perfil
        </CardTitle>
        <CardDescription>
          O Gerencial de Almoxarifado e o BI Produção são acessos independentes. Para personalizar uma pessoa, use o ícone de escudo na tabela Usuários Cadastrados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {podeGerenciar && (
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Novo perfil de acesso</label>
              <Input value={novoPerfil} onChange={(e) => setNovoPerfil(e.target.value)} placeholder="Ex.: Financeiro, Compras, Produção..." />
            </div>
            <Button onClick={() => void criarPerfil()} disabled={criandoPerfil || !novoPerfil.trim()}>
              {criandoPerfil ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Criar perfil
            </Button>
          </div>
        )}
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[800px] table-fixed text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="w-[30%] px-3 py-3 text-left">Permissão padrão</th>
                {permissoes.map((item) => (
                  <th key={item.tipo_usuario} className="px-2 py-3 text-center">
                    <Badge
                      variant="outline"
                      className={TIPOS_USUARIO_COLORS[item.tipo_usuario]}
                    >
                      {TIPOS_USUARIO_LABELS[item.tipo_usuario] ?? item.tipo_usuario}
                    </Badge>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSOES_GRUPOS.map((grupo) => (
                <FragmentGrupo
                  key={grupo.titulo}
                  grupo={grupo}
                  permissoes={permissoes}
                  podeGerenciar={podeGerenciar}
                  onToggle={alternarPermissaoPerfil}
                />
              ))}
            </tbody>
          </table>
        </div>

        {podeGerenciar && (
          <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {hasChanges
                ? 'Existem alterações de perfil não salvas.'
                : 'Todos os padrões estão salvos.'}
            </p>
            <Button onClick={salvarPerfis} disabled={!hasChanges || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar padrões
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const FragmentGrupo = ({
  grupo,
  permissoes,
  podeGerenciar,
  onToggle,
}: {
  grupo: PermissaoGrupo;
  permissoes: PermissaoTipoUsuario[];
  podeGerenciar: boolean;
  onToggle: (tipoUsuario: string, campo: keyof PermissaoTipoUsuario) => void;
}) => (
  <>
    <tr className="bg-muted/20">
      <td
        colSpan={permissoes.length + 1}
        className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {grupo.titulo}
      </td>
    </tr>
    {grupo.campos.map((campo) => (
      <tr key={String(campo.key)} className="border-t hover:bg-muted/20">
        <td className="px-3 py-2.5 text-xs font-medium">{campo.label}</td>
        {permissoes.map((item) => {
          const checked = Boolean(item[campo.key]);
          return (
            <td
              key={`${item.tipo_usuario}-${String(campo.key)}`}
              className="px-3 py-2.5 text-center"
            >
              {podeGerenciar ? (
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => onToggle(item.tipo_usuario, campo.key)}
                />
              ) : (
                <span
                  className={cn(
                    'mx-auto flex h-6 w-6 items-center justify-center rounded-full',
                    checked
                      ? 'bg-emerald-500/15 text-emerald-600'
                      : 'bg-muted text-muted-foreground/40',
                  )}
                >
                  {checked ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                </span>
              )}
            </td>
          );
        })}
      </tr>
    ))}
  </>
);