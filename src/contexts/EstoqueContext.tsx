import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useEstoque } from '@/hooks/useEstoque';
import { supabase } from '@/integrations/supabase/client';

// Tipo do retorno de useEstoque
type EstoqueContextType = ReturnType<typeof useEstoque>;

const EstoqueContext = createContext<EstoqueContextType | null>(null);

export const EstoqueProvider = ({ children }: { children: React.ReactNode }) => {
  const estoque = useEstoque();
  const carregarDadosRef = useRef(estoque.carregarDados);

  useEffect(() => {
    carregarDadosRef.current = estoque.carregarDados;
  }, [estoque.carregarDados]);

  useEffect(() => {
    const recarregar = () => {
      void carregarDadosRef.current(true);
    };

    const channel = supabase
      .channel('estoque-context-refresh')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'movements' },
        recarregar,
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'locais_utilizacao' },
        recarregar,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <EstoqueContext.Provider value={estoque}>
      {children}
    </EstoqueContext.Provider>
  );
};

export const useEstoqueContext = (): EstoqueContextType => {
  const context = useContext(EstoqueContext);
  if (!context) {
    throw new Error('useEstoqueContext deve ser usado dentro de um EstoqueProvider');
  }
  return context;
};
