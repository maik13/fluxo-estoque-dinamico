import { createContext, useContext, type ReactNode } from 'react';
import { useConfiguracoesInterno } from '@/hooks/useConfiguracoes';

export type {
  CategoriaConfig,
  CategoriaSubcategoriaRelacao,
  LocalUtilizacaoConfig,
  ProjectGroupConfig,
  SolicitanteConfig,
  TipoOperacaoConfig,
} from '@/hooks/useConfiguracoes';

type ConfiguracoesContextValue = ReturnType<typeof useConfiguracoesInterno>;

const ConfiguracoesContext = createContext<ConfiguracoesContextValue | null>(null);

export const ConfiguracoesProvider = ({ children }: { children: ReactNode }) => {
  const value = useConfiguracoesInterno();
  return (
    <ConfiguracoesContext.Provider value={value}>
      {children}
    </ConfiguracoesContext.Provider>
  );
};

export const useConfiguracoes = () => {
  const value = useContext(ConfiguracoesContext);
  if (!value) {
    throw new Error('useConfiguracoes deve ser usado dentro de ConfiguracoesProvider.');
  }
  return value;
};
