import React, { createContext, useContext } from 'react';
import { useEstoque } from '@/hooks/useEstoque';

// Tipo do retorno de useEstoque
type EstoqueContextType = ReturnType<typeof useEstoque>;

const EstoqueContext = createContext<EstoqueContextType | null>(null);

export const EstoqueProvider = ({ children }: { children: React.ReactNode }) => {
  const estoque = useEstoque();

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
