import { useState, type MouseEvent } from 'react';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { usePermissions } from '@/hooks/usePermissions';
import { GerencialProducaoIntegrado } from '@/components/producao/GerencialProducaoIntegrado';
import { PainelGerencial } from './PainelGerencial';

export const PainelGerencialAcesso = () => {
  const { canAccessManagerial, canViewBIProducao } = usePermissions();
  const { locaisUtilizacao } = useConfiguracoes();
  const [abrirGerencialProducao, setAbrirGerencialProducao] = useState(false);

  const podeVerGerencialAlmoxarifado = canAccessManagerial();
  const podeVerGerencialProducao = canViewBIProducao();

  if (podeVerGerencialAlmoxarifado && podeVerGerencialProducao) {
    if (abrirGerencialProducao) {
      return (
        <GerencialProducaoIntegrado
          locais={locaisUtilizacao}
          onVoltar={() => setAbrirGerencialProducao(false)}
        />
      );
    }

    // Ponte de compatibilidade: preserva integralmente o Gerencial do
    // Almoxarifado atual e substitui somente a entrada de Produção pela nova
    // experiência integrada. Assim o painel ao vivo permanece dentro do
    // Gerencial, sem criar uma navegação paralela.
    const interceptarAcessoProducao = (event: MouseEvent<HTMLDivElement>) => {
      const alvo = event.target as HTMLElement;
      const botao = alvo.closest('button');
      if (!botao) return;

      const texto = (botao.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (!texto.includes('BI de Produção') && !texto.includes('Gerencial de Produção')) return;

      event.preventDefault();
      event.stopPropagation();
      setAbrirGerencialProducao(true);
    };

    return (
      <div onClickCapture={interceptarAcessoProducao}>
        <PainelGerencial />
      </div>
    );
  }

  if (podeVerGerencialAlmoxarifado) {
    return <PainelGerencial />;
  }

  if (podeVerGerencialProducao) {
    return <GerencialProducaoIntegrado locais={locaisUtilizacao} />;
  }

  return null;
};
