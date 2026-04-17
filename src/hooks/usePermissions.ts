import { useState, useEffect } from 'react';
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
}

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
};

export const usePermissions = () => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [permissoesDinamicas, setPermissoesDinamicas] = useState<PermissoesFuncionalidades>(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.id) {
      setLoading(true);
      setUserProfile(null);
      setPermissoesDinamicas(DEFAULT_PERMISSIONS);
      loadUserProfile(user.id);
    } else {
      setUserProfile(null);
      setPermissoesDinamicas(DEFAULT_PERMISSIONS);
      setLoading(false);
    }
  }, [user?.id]);

  // Carregar permissões dinâmicas quando o perfil mudar
  useEffect(() => {
    if (userProfile?.tipo_usuario) {
      loadPermissoesDinamicas(userProfile.tipo_usuario);
    } else {
      setPermissoesDinamicas(DEFAULT_PERMISSIONS);
    }
  }, [userProfile?.tipo_usuario]);

  // Atualizar permissões em tempo real
  useEffect(() => {
    if (!userProfile?.tipo_usuario) return;

    const channel = supabase
      .channel('permissoes-realtime-hook')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'permissoes_tipo_usuario' }, () => {
        if (userProfile?.tipo_usuario) {
          loadPermissoesDinamicas(userProfile.tipo_usuario);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userProfile?.tipo_usuario]);

  const loadUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Erro ao carregar perfil:', error);
        setUserProfile(null);
      } else if (!data) {
        console.warn('Perfil não encontrado. Faça logout e login novamente para criar o perfil.');
        setUserProfile(null);
      } else {
        setUserProfile(data);
      }
    } catch (error) {
      console.error('Erro:', error);
      setUserProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const loadPermissoesDinamicas = async (tipoUsuario: string) => {
    try {
      const { data, error } = await supabase
        .from('permissoes_tipo_usuario')
        .select('*')
        .eq('tipo_usuario', tipoUsuario)
        .maybeSingle();

      if (error) {
        console.error('Erro ao carregar permissões dinâmicas:', error);
        return;
      }

      if (data) {
        setPermissoesDinamicas({
          pode_cadastrar_itens: data.pode_cadastrar_itens,
          pode_editar_itens: data.pode_editar_itens,
          pode_excluir_itens: data.pode_excluir_itens,
          pode_registrar_movimentacoes: data.pode_registrar_movimentacoes,
          pode_gerenciar_configuracoes: data.pode_gerenciar_configuracoes,
          pode_gerenciar_usuarios: data.pode_gerenciar_usuarios,
          pode_solicitar_material: data.pode_solicitar_material,
          pode_devolver_material: data.pode_devolver_material,
          pode_registrar_entrada: data.pode_registrar_entrada,
          pode_transferir: data.pode_transferir,
          pode_registrar_saida: data.pode_registrar_saida,
          pode_pedido_compra: data.pode_pedido_compra,
          pode_solicitacao_material: data.pode_solicitacao_material,
          pode_ver_relatorios: data.pode_ver_relatorios,
          pode_editar_movimentacoes: (data as any).pode_editar_movimentacoes ?? false,
          pode_acessar_gerencial: (data as any).pode_acessar_gerencial ?? false,
          pode_acessar_projetos: (data as any).pode_acessar_projetos ?? false,
        });
      }
    } catch (error) {
      console.error('Erro ao carregar permissões:', error);
    }
  };

  // Funções de verificação de tipo
  const isAdmin = () => userProfile?.tipo_usuario === 'administrador';
  const isGestor = () => userProfile?.tipo_usuario === 'gestor';
  const isEngenharia = () => userProfile?.tipo_usuario === 'engenharia';
  const isMestre = () => userProfile?.tipo_usuario === 'mestre';
  const isEstoquista = () => userProfile?.tipo_usuario === 'estoquista';

  // Permissões baseadas nas configurações dinâmicas do banco
  const canCreateUsers = () => isAdmin() || permissoesDinamicas.pode_gerenciar_usuarios;
  const canEditUsers = () => isAdmin() || isGestor() || permissoesDinamicas.pode_gerenciar_usuarios;
  const canCreateItems = () => isAdmin() || permissoesDinamicas.pode_cadastrar_itens;
  const canEditItems = () => isAdmin() || permissoesDinamicas.pode_editar_itens;
  const canDeleteItems = () => isAdmin() || permissoesDinamicas.pode_excluir_itens;
  const canManageStock = () => isAdmin() || permissoesDinamicas.pode_registrar_movimentacoes;
  const canViewReports = () => isAdmin() || permissoesDinamicas.pode_ver_relatorios;
  const canManageSettings = () => isAdmin() || permissoesDinamicas.pode_gerenciar_configuracoes;

  // Permissões de funcionalidades do menu
  const canSolicitarMaterial = () => isAdmin() || permissoesDinamicas.pode_solicitar_material;
  const canDevolverMaterial = () => isAdmin() || permissoesDinamicas.pode_devolver_material;
  const canRegistrarEntrada = () => isAdmin() || permissoesDinamicas.pode_registrar_entrada;
  const canTransferir = () => isAdmin() || permissoesDinamicas.pode_transferir;
  const canRegistrarSaida = () => isAdmin() || permissoesDinamicas.pode_registrar_saida;
  const canPedidoCompra = () => isAdmin() || permissoesDinamicas.pode_pedido_compra;
  const canSolicitacaoMaterial = () => isAdmin() || permissoesDinamicas.pode_solicitacao_material;
  const canEditMovements = () => isAdmin() || permissoesDinamicas.pode_editar_movimentacoes;
  const canAccessManagerial = () => isAdmin() || permissoesDinamicas.pode_acessar_gerencial;
  const canAccessProjects = () => isAdmin() || permissoesDinamicas.pode_acessar_projetos;

  return {
    userProfile,
    loading,
    permissoesDinamicas,
    // Verificações de tipo
    isAdmin,
    isGestor,
    isEngenharia,
    isMestre,
    isEstoquista,
    // Verificações de permissão
    canCreateUsers,
    canEditUsers,
    canCreateItems,
    canEditItems,
    canDeleteItems,
    canManageStock,
    canViewReports,
    canManageSettings,
    // Funcionalidades do menu
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
  };
};
