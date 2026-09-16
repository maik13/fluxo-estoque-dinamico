import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { usePermissions } from '@/hooks/usePermissions';
import { GerencialProducaoIntegrado } from '@/components/producao/GerencialProducaoIntegrado';
import { PainelGerencial } from './PainelGerencial';

export const PainelGerencialAcesso = () => {
  const { canAccessManagerial, canViewBIProducao } = usePermissions();
  const { locaisUtilizacao } = useConfiguracoes();
  const [abrirGerencialProducao, setAbrirGerencialProducao] = useState(false);
  const entradaGerencialRef = useRef<HTMLDivElement | null>(null);

  const podeVerGerencialAlmoxarifado = canAccessManagerial();
  const podeVerGerencialProducao = canViewBIProducao();

  // O PainelGerencial legado ainda possui o rótulo antigo no card de entrada.
  // Mantemos a tela consolidada e normalizamos visualmente a nomenclatura até
  // a decomposição definitiva desse componente, sem criar outra navegação.
  useEffect(() => {
    if (!podeVerGerencialAlmoxarifado || !podeVerGerencialProducao || abrirGerencialProducao) return;
    const raiz = entradaGerencialRef.current;
    if (!raiz) return;

    const normalizarRotulo = () => {
      raiz.querySelectorAll('p').forEach((elemento) => {
        if ((elemento.textContent ?? '').trim() === 'BI de Produção') {
          elemento.textContent = 'Gerencial de Produção';
        }
      });
    };

    normalizarRotulo();
    const observer = new MutationObserver(normalizarRotulo);
    observer.observe(raiz, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [abrirGerencialProducao, podeVerGerencialAlmoxarifado, podeVerGerencialProducao]);

  if (podeVerGerencialAlmoxarifado && podeVerGerencialProducao) {
    if (abrirGerencialProducao) {
      return (
        <GerencialProducaoIntegrado
          locais={locaisUtilizacao}
          onVoltar={() => setAbrirGerencialProducao(false)}
        />
      );
    }

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
      <div ref={entradaGerencialRef} onClickCapture={interceptarAcessoProducao}>
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
