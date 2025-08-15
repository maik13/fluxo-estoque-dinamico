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

export const usePermissions = () => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadUserProfile();
    } else {
      setUserProfile(null);
      setLoading(false);
    }
  }, [user]);

  const loadUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) {
        console.error('Erro ao carregar perfil:', error);
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

  // Funções de verificação de permissões
  const isAdmin = () => userProfile?.tipo_usuario === 'administrador';
  const isGestor = () => userProfile?.tipo_usuario === 'gestor';
  const isEngenharia = () => userProfile?.tipo_usuario === 'engenharia';
  const isMestre = () => userProfile?.tipo_usuario === 'mestre';
  const isEstoquista = () => userProfile?.tipo_usuario === 'estoquista';

  // Permissões específicas
  const canCreateUsers = () => isAdmin();
  const canEditUsers = () => isAdmin() || isGestor();
  const canCreateItems = () => isAdmin() || isGestor() || isEngenharia();
  const canEditItems = () => isAdmin() || isGestor() || isEngenharia();
  const canDeleteItems = () => isAdmin() || isGestor();
  const canManageStock = () => isAdmin() || isGestor() || isEstoquista() || isMestre();
  const canViewReports = () => true; // Todos podem ver relatórios
  const canManageSettings = () => isAdmin() || isGestor();

  return {
    userProfile,
    loading,
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
  };
};