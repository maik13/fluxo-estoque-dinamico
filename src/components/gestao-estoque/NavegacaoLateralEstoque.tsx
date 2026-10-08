import { useEffect, useState } from 'react';
import {
  BarChart3,
  ClipboardList,
  Factory,
  History,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Package,
  Settings,
  WalletCards,
  UsersRound,
  UserRound,
  Clock3,
  ChevronDown,
  ClipboardCheck,
  GanttChartSquare,
  Image as ImageIcon,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

type NavegacaoLateralEstoqueProps = {
  tabAtiva: string;
  onNavigate: (tab: string) => void;
  showEstoque: boolean;
  showMovimentacoes: boolean;
  showSolicitantes: boolean;
  showGerencial: boolean;
  showProjetos: boolean;
  showProducao: boolean;
  showFinanceiro: boolean;
  showAcompanhamentoPedido: boolean;
  showPlanejamento2: boolean;
  showImagensOP: boolean;
  showMeuPonto: boolean;
  showControlePonto: boolean;
  showRHInformacoes: boolean;
  showConfiguracoes: boolean;
  solicitacoesPendentesCount: number;
  mensagensNaoLidasCount: number;
  somenteBIProducao: boolean;
};

type NavItem = {
  value: string;
  label: string;
  icon: LucideIcon;
  visible?: boolean;
  badge?: number;
};

type NavSection = {
  label: string;
  items: NavItem[];
  collapsible?: boolean;
};

export const NavegacaoLateralEstoque = ({
  tabAtiva,
  onNavigate,
  showEstoque,
  showMovimentacoes,
  showSolicitantes,
  showGerencial,
  showProjetos,
  showProducao,
  showFinanceiro,
  showAcompanhamentoPedido,
  showPlanejamento2,
  showImagensOP,
  showMeuPonto,
  showControlePonto,
  showRHInformacoes,
  showConfiguracoes,
  solicitacoesPendentesCount,
  mensagensNaoLidasCount,
  somenteBIProducao,
}: NavegacaoLateralEstoqueProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set([
      'Painel',
      'Almoxarifado',
      ...(showFinanceiro || showAcompanhamentoPedido || showGerencial || showProjetos ? ['Gestão'] : []),
      ...(showProducao || showPlanejamento2 || showImagensOP ? ['Produção'] : []),
    ]),
  );

  const sections: NavSection[] = [
    {
      label: 'Painel',
      items: [
        { value: 'visao-geral', label: 'Visão Geral', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Almoxarifado',
      collapsible: true,
      items: [
        {
          value: 'menu',
          label: 'Menu Principal',
          icon: Menu,
          badge: solicitacoesPendentesCount,
        },
        { value: 'estoque', label: 'Estoque', icon: Package, visible: showEstoque },
        {
          value: 'movimentacoes',
          label: 'Movimentações',
          icon: History,
          visible: showMovimentacoes,
        },
        {
          value: 'solicitantes',
          label: 'Solicitantes',
          icon: ClipboardList,
          visible: showSolicitantes,
        },
      ],
    },
    {
      label: 'Gestão',
      collapsible: true,
      items: [
        {
          value: 'gerencial',
          label: somenteBIProducao ? 'Gerencial de Produção' : 'Gerencial',
          icon: BarChart3,
          visible: showGerencial,
        },
        {
          value: 'projetos',
          label: 'Projetos',
          icon: ClipboardList,
          visible: showProjetos,
        },
        {
          value: 'acompanhamento-pedido',
          label: 'Acompanhamento do Pedido',
          icon: ClipboardCheck,
          visible: showAcompanhamentoPedido,
        },
        {
          value: 'financeiro',
          label: 'Financeiro',
          icon: WalletCards,
          visible: showFinanceiro,
        },
      ],
    },
    {
      label: 'Produção',
      collapsible: true,
      items: [
        {
          value: 'producao',
          label: 'Produção',
          icon: Factory,
          visible: showProducao,
        },
        {
          value: 'planejamento-2',
          label: 'Planejamento 2.0',
          icon: GanttChartSquare,
          visible: showPlanejamento2,
        },
        {
          value: 'imagens-op',
          label: 'Imagens OP',
          icon: ImageIcon,
          visible: showImagensOP,
        },
      ],
    },
    {
      label: 'RH',
      collapsible: true,
      items: [
        {
          value: 'meu-ponto',
          label: 'Meu Ponto',
          icon: UserRound,
          visible: showMeuPonto,
        },
        {
          value: 'controle-ponto',
          label: 'Controle de Ponto',
          icon: Clock3,
          visible: showControlePonto,
        },
        {
          value: 'rh-informacoes',
          label: 'Informações RH',
          icon: UsersRound,
          visible: showRHInformacoes,
        },
      ],
    },
    {
      label: 'Administração',
      collapsible: true,
      items: [
        {
          value: 'configuracoes',
          label: 'Configurações',
          icon: Settings,
          visible: showConfiguracoes,
        },
      ],
    },
    {
      label: 'Comunicação',
      collapsible: true,
      items: [
        { value: 'mensagens', label: 'Mensagens', icon: MessageCircle, badge: mensagensNaoLidasCount },
      ],
    },
  ];

  useEffect(() => {
    const activeSection = sections.find((section) =>
      section.items.some((item) => item.value === tabAtiva && item.visible !== false),
    );

    if (!activeSection) return;

    setOpenSections((current) => {
      if (current.has(activeSection.label)) return current;
      const next = new Set(current);
      next.add(activeSection.label);
      return next;
    });
  }, [
    tabAtiva,
    showEstoque,
    showMovimentacoes,
    showSolicitantes,
    showGerencial,
    showProjetos,
    showProducao,
    showFinanceiro,
    showAcompanhamentoPedido,
    showPlanejamento2,
    showImagensOP,
    showMeuPonto,
    showControlePonto,
    showRHInformacoes,
    showConfiguracoes,
  ]);

  const toggleSection = (label: string) => {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const handleNavigate = (value: string, closeMobile = false) => {
    onNavigate(value);
    if (closeMobile) setMobileOpen(false);
  };

  const renderNavigation = (closeMobile: boolean) => (
    <nav aria-label="Navegação principal do almoxarifado" className="space-y-5 px-3 py-4">
      {sections.map((section) => {
        const visibleItems = section.items.filter((item) => item.visible !== false);
        if (visibleItems.length === 0) return null;

        const isOpen = section.collapsible ? openSections.has(section.label) : true;
        const hasActiveItem = visibleItems.some((item) => item.value === tabAtiva);

        return (
          <div key={section.label} className="space-y-1.5">
            {section.collapsible ? (
              <button
                type="button"
                onClick={() => toggleSection(section.label)}
                aria-expanded={isOpen}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors',
                  hasActiveItem
                    ? 'text-primary'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                <span>{section.label}</span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform duration-200',
                    isOpen ? 'rotate-180' : 'rotate-0',
                  )}
                />
              </button>
            ) : (
              <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {section.label}
              </p>
            )}

            {isOpen && (
              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const active = tabAtiva === item.value;
                  const badge = item.badge && item.badge > 0 ? item.badge : 0;

                  return (
                    <button
                      key={item.value}
                      type="button"
                      aria-current={active ? 'page' : undefined}
                      onClick={() => handleNavigate(item.value, closeMobile)}
                      className={cn(
                        'group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors',
                        active
                          ? 'border-primary/30 bg-primary/10 text-primary shadow-sm'
                          : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors',
                          active
                            ? 'bg-primary/15 text-primary'
                            : 'bg-muted/60 text-muted-foreground group-hover:text-foreground',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {badge > 0 && (
                        <span
                          className="inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[11px] font-bold leading-none text-destructive-foreground shadow-sm"
                          aria-label={`${badge} ${badge === 1 ? 'solicitação pendente' : 'solicitações pendentes'}`}
                          title={`${badge} ${badge === 1 ? 'solicitação pendente' : 'solicitações pendentes'}`}
                        >
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      <aside
        className="hidden w-60 shrink-0 border-r border-border/70 bg-card/35 lg:block"
        aria-label="Coluna lateral do almoxarifado"
      >
        <div className="sticky top-[65px] max-h-[calc(100vh-65px)] overflow-y-auto py-2">
          {renderNavigation(false)}
        </div>
      </aside>

      <div className="sticky top-[65px] z-30 flex items-center justify-between border-b border-border/70 bg-background/95 px-4 py-2 backdrop-blur lg:hidden">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Seção atual</p>
          <p className="text-sm font-semibold">
            {sections
              .flatMap((section) => section.items)
              .find((item) => item.value === tabAtiva)?.label ?? 'Visão Geral'}
          </p>
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Menu className="h-4 w-4" />
              Navegação
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[290px] p-0 sm:w-[320px]">
            <SheetHeader className="border-b border-border px-5 py-4 text-left">
              <SheetTitle>Almoxarifado</SheetTitle>
            </SheetHeader>
            <div className="max-h-[calc(100vh-65px)] overflow-y-auto">
              {renderNavigation(true)}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
};
