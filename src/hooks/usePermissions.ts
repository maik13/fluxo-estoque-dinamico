import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export interface UserProfile {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  tipo_usuario: string;
  ativo: boolean;
}

export interface PermissoesFuncionalidades {
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

export type MapaPermissoes = Record<string, boolean>;

const DEFAULT_PERMISSIONS: PermissoesFuncionalidades = {
  pode_cadastrar_itens: false,
  pode_editar_itens: false,
  pode_excluir_itens: false,
  pode_registrar_movimentacoes: false,
  pode_gerenciar_configuracoes: false,
  pode_gerenciar_usuarios: false,
  pode_solicitar_material: false,
  pode_devolver_material: false,
  pode_registrar_entrada: false,
  pode_transferir: false,
  pode_registrar_saida: false,
  pode_pedido_compra: false,
  pode_solicitacao_material: false,
  pode_ver_relatorios: false,
  pode_editar_movimentacoes: false,
  pode_acessar_gerencial: false,
  pode_acessar_projetos: false,
  pode_apontar_producao: false,
  pode_conferir_producao: false,
  pode_ver_bi_producao: false,
  pode_configurar_producao: false,
};

const mapaParaLegado = (mapa: MapaPermissoes): PermissoesFuncionalidades => ({
  pode_cadastrar_itens: Boolean(mapa['estoque.itens.criar']),
  pode_editar_itens: Boolean(mapa['estoque.itens.editar']),
  pode_excluir_itens: Boolean(mapa['estoque.itens.excluir']),
  pode_registrar_movimentacoes: Boolean(mapa['estoque.movimentacoes.registrar']),
  pode_gerenciar_configuracoes: Boolean(mapa['administracao.configuracoes.gerenciar']),
  pode_gerenciar_usuarios: Boolean(
    mapa['administracao.usuarios.visualizar'] ||
    mapa['administracao.usuarios.criar'] ||
    mapa['administracao.usuarios.editar'] ||
    mapa['administracao.permissoes.gerenciar'],
  ),
  pode_solicitar_material: Boolean(mapa['estoque.solicitacoes.solicitar']),
  pode_devolver_material: Boolean(mapa['estoque.solicitacoes.devolver']),
  pode_registrar_entrada: Boolean(mapa['estoque.movimentacoes.entrada']),
  pode_transferir: Boolean(mapa['estoque.movimentacoes.transferir']),
  pode_registrar_saida: Boolean(mapa['estoque.movimentacoes.saida']),
  pode_pedido_compra: Boolean(mapa['compras.pedidos.criar'] || mapa['compras.pedidos.visualizar']),
  pode_solicitacao_material: Boolean(mapa['estoque.solicitacoes.gerenciar']),
  pode_ver_relatorios: Boolean(mapa['relatorios.visualizar']),
  pode_editar_movimentacoes: Boolean(mapa['estoque.movimentacoes.editar']),
  pode_acessar_gerencial: Boolean(mapa['gerencial.visualizar']),
  pode_acessar_projetos: Boolean(mapa['projetos.visualizar']),
  pode_apontar_producao: Boolean(mapa['producao.apontamentos.criar']),
  pode_conferir_producao: Boolean(mapa['producao.apontamentos.conferir']),
  pode_ver_bi_producao: Boolean(mapa['producao.bi.visualizar']),
  pode_configurar_producao: Boolean(
    mapa['producao.configuracoes.gerenciar'] ||
    mapa['producao.projetos.gerenciar'] ||
    mapa['producao.etapas.gerenciar'] ||
    mapa['producao.cronograma.configurar'],
  ),
});

export const usePermissions = () => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [permissoesDinamicas, setPermissoesDinamicas] = useState<PermissoesFuncionalidades>(DEFAULT_PERMISSIONS);
  const [permissoesEfetivas, setPermissoesEfetivas] = useState<MapaPermissoes>({});
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const carregarPermissoesLegadas = useCallback(async (tipoUsuario: string) => {
    const { data, error } = await supabase
      .from('permissoes_tipo_usuario')
      .select('*')
      .eq('tipo_usuario', tipoUsuario)
      .maybeSingle();

    if (error) throw error;
    if (!data) return DEFAULT_PERMISSIONS;

    return {
      pode_cadastrar_itens: data.pode_cadastrar_itens,
      pode_editar_itens: data.pode_editar_itens,
      pode_excluir_itens: data.pode_excluir_itens,
      pode_registrar_movimentacoes: data.pode_registrar_movimentacoes,
      pode_gerenciar_configuracoes: data.pode_gerenciar_configuracoes,
      pode_gerenciar_usuarios: data.pode_gerenciar_usuarios,
      pode_solicitar_material: data.pode_solicitar_material,
      pode_devolver_material: data.pode_devolver_material,
      pode_registrar_entrada: data.pode_registrar_entrada || data.pode_registrar_movimentacoes,
      pode_transferir: data.pode_transferir,
      pode_registrar_saida: data.pode_registrar_saida || data.pode_registrar_movimentacoes,
      pode_pedido_compra: data.pode_pedido_compra,
      pode_solicitacao_material: data.pode_solicitacao_material,
      pode_ver_relatorios: data.pode_ver_relatorios,
      pode_editar_movimentacoes: (data as any).pode_editar_movimentacoes ?? false,
      pode_acessar_gerencial: (data as any).pode_acessar_gerencial ?? false,
      pode_acessar_projetos: (data as any).pode_acessar_projetos ?? false,
      pode_apontar_producao: data.pode_apontar_producao ?? false,
      pode_conferir_producao: data.pode_conferir_producao ?? false,
      pode_ver_bi_producao: data.pode_ver_bi_producao ?? false,
      pode_configurar_producao: data.pode_configurar_producao ?? false,
    } satisfies PermissoesFuncionalidades;
  }, []);

  const carregarPermissoesEfetivas = useCallback(async (tipoUsuario: string) => {
    const { data, error } = await (supabase as any).rpc('obter_minhas_permissoes');

    // Antes da migration ser aplicada, a aplicação continua operando pela matriz antiga.
    if (error) {
      const legado = await carregarPermissoesLegadas(tipoUsuario);
      setPermissoesEfetivas({});
      setPermissoesDinamicas(legado);
      return;
    }

    const mapa = (data && typeof data === 'object' ? data : {}) as MapaPermissoes;
    setPermissoesEfetivas(mapa);
    setPermissoesDinamicas(mapaParaLegado(mapa));
  }, [carregarPermissoesLegadas]);

  const recarregarPermissoes = useCallback(async () => {
    if (!userProfile?.tipo_usuario) return;
    await carregarPermissoesEfetivas(userProfile.tipo_usuario);
  }, [carregarPermissoesEfetivas, userProfile?.tipo_usuario]);

  useEffect(() => {
    const carregar = async () => {
      if (!user?.id) {
        setUserProfile(null);
        setPermissoesEfetivas({});
        setPermissoesDinamicas(DEFAULT_PERMISSIONS);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          setUserProfile(null);
          setPermissoesEfetivas({});
          setPermissoesDinamicas(DEFAULT_PERMISSIONS);
          return;
        }

        const perfil = data as UserProfile;
        setUserProfile(perfil);
        await carregarPermissoesEfetivas(perfil.tipo_usuario);
      } catch (error) {
        console.error('Erro ao carregar perfil e permissões:', error);
        setUserProfile(null);
        setPermissoesEfetivas({});
        setPermissoesDinamicas(DEFAULT_PERMISSIONS);
      } finally {
        setLoading(false);
      }
    };

    void carregar();
  }, [carregarPermissoesEfetivas, user?.id]);

  useEffect(() => {
    if (!user?.id || !userProfile?.tipo_usuario) return;

    const recarregar = () => void carregarPermissoesEfetivas(userProfile.tipo_usuario);
    const channel = supabase
      .channel(`permissoes-efetivas-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'permissoes_tipo_usuario' }, recarregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'perfil_permissoes' }, recarregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'usuario_permissoes', filter: `user_id=eq.${user.id}` }, recarregar)
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [carregarPermissoesEfetivas, user?.id, userProfile?.tipo_usuario]);

  const isAdmin = () => userProfile?.tipo_usuario === 'administrador';
  const isGestor = () => userProfile?.tipo_usuario === 'gestor';
  const isEngenharia = () => userProfile?.tipo_usuario === 'engenharia';
  const isMestre = () => userProfile?.tipo_usuario === 'mestre';
  const isEstoquista = () => userProfile?.tipo_usuario === 'estoquista';

  const hasPermission = useCallback((chave: string) => {
    if (!userProfile?.ativo) return false;
    if (isAdmin()) return true;
    if (Object.prototype.hasOwnProperty.call(permissoesEfetivas, chave)) {
      return Boolean(permissoesEfetivas[chave]);
    }
    return false;
  }, [permissoesEfetivas, userProfile?.ativo, userProfile?.tipo_usuario]);

  const canCreateUsers = () => isAdmin() || hasPermission('administracao.usuarios.criar');
  const canEditUsers = () => isAdmin() || hasPermission('administracao.usuarios.editar');
  const canCreateItems = () => isAdmin() || hasPermission('estoque.itens.criar') || permissoesDinamicas.pode_cadastrar_itens;
  const canEditItems = () => isAdmin() || hasPermission('estoque.itens.editar') || permissoesDinamicas.pode_editar_itens;
  const canDeleteItems = () => isAdmin() || hasPermission('estoque.itens.excluir') || permissoesDinamicas.pode_excluir_itens;
  const canManageStock = () => hasPermission('estoque.movimentacoes.registrar') || permissoesDinamicas.pode_registrar_movimentacoes;
  const canViewReports = () => hasPermission('relatorios.visualizar') || permissoesDinamicas.pode_ver_relatorios;
  const canManageSettings = () => isAdmin() || hasPermission('administracao.configuracoes.gerenciar') || permissoesDinamicas.pode_gerenciar_configuracoes;
  const canSolicitarMaterial = () => hasPermission('estoque.solicitacoes.solicitar') || permissoesDinamicas.pode_solicitar_material;
  const canDevolverMaterial = () => hasPermission('estoque.solicitacoes.devolver') || permissoesDinamicas.pode_devolver_material;
  const canRegistrarEntrada = () => hasPermission('estoque.movimentacoes.entrada') || permissoesDinamicas.pode_registrar_entrada;
  const canTransferir = () => hasPermission('estoque.movimentacoes.transferir') || permissoesDinamicas.pode_transferir;
  const canRegistrarSaida = () => hasPermission('estoque.movimentacoes.saida') || permissoesDinamicas.pode_registrar_saida;
  const canPedidoCompra = () => hasPermission('compras.pedidos.criar') || permissoesDinamicas.pode_pedido_compra;
  const canSolicitacaoMaterial = () => hasPermission('estoque.solicitacoes.gerenciar') || permissoesDinamicas.pode_solicitacao_material;
  const canEditMovements = () => hasPermission('estoque.movimentacoes.editar') || permissoesDinamicas.pode_editar_movimentacoes;
  const canAccessManagerial = () => isAdmin() || hasPermission('gerencial.visualizar') || permissoesDinamicas.pode_acessar_gerencial;
  const canAccessProjects = () => isAdmin() || hasPermission('projetos.visualizar') || permissoesDinamicas.pode_acessar_projetos;
  const canApontarProducao = () => isAdmin() || hasPermission('producao.apontamentos.criar') || permissoesDinamicas.pode_apontar_producao;
  const canConferirProducao = () => isAdmin() || hasPermission('producao.apontamentos.conferir') || permissoesDinamicas.pode_conferir_producao;
  const canViewBIProducao = () => isAdmin() || hasPermission('producao.bi.visualizar') || permissoesDinamicas.pode_ver_bi_producao;
  const canConfigurarProducao = () => isAdmin() || hasPermission('producao.configuracoes.gerenciar') || permissoesDinamicas.pode_configurar_producao;

  return useMemo(() => ({
    userProfile,
    loading,
    permissoesDinamicas,
    permissoesEfetivas,
    hasPermission,
    recarregarPermissoes,
    isAdmin,
    isGestor,
    isEngenharia,
    isMestre,
    isEstoquista,
    canCreateUsers,
    canEditUsers,
    canCreateItems,
    canEditItems,
    canDeleteItems,
    canManageStock,
    canViewReports,
    canManageSettings,
    canSolicitarMaterial,
    canDevolverMaterial,
    canRegistrarEntrada,
    canTransferir,
    canRegistrarSaida,
    canPedidoCompra,
    canSolicitacaoMaterial,
    canEditMovements,
    canAccessManagerial,
    canAccessProjects,
    canApontarProducao,
    canConferirProducao,
    canViewBIProducao,
    canConfigurarProducao,
  }), [hasPermission, loading, permissoesDinamicas, permissoesEfetivas, recarregarPermissoes, userProfile]);
};
