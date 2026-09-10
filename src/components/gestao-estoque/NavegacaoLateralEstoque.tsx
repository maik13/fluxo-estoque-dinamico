import { useState } from 'react';
import {
  BarChart3,
  ClipboardList,
  Factory,
  History,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Package,
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
  showGerencial: boolean;
  showProjetos: boolean;
  showProducao: boolean;
  somenteBIProducao: boolean;
};

type NavItem = {
  value: string;
  label: string;
  icon: LucideIcon;
  visible?: boolean;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

export const NavegacaoLateralEstoque = ({
  tabAtiva,
  onNavigate,
  showEstoque,
  showMovimentacoes,
  showGerencial,
  showProjetos,
  showProducao,
  somenteBIProducao,
}: NavegacaoLateralEstoqueProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const sections: NavSection[] = [
    {
      label: 'Painel',
      items: [
        { value: 'visao-geral', label: 'Visão Geral', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Almoxarifado',
      items: [
        { value: 'menu', label: 'Menu Principal', icon: Menu },
        { value: 'estoque', label: 'Estoque', icon: Package, visible: showEstoque },
        {
          value: 'movimentacoes',
          label: 'Movimentações',
          icon: History,
          visible: showMovimentacoes,
        },
      ],
    },
    {
      label: 'Gestão',
      items: [
        {
          value: 'gerencial',
          label: somenteBIProducao ? 'BI Produção' : 'Gerencial',
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
          value: 'producao',
          label: 'Produção',
          icon: Factory,
          visible: showProducao,
        },
      ],
    },
    {
      label: 'Comunicação',
      items: [
        { value: 'mensagens', label: 'Mensagens', icon: MessageCircle },
      ],
    },
  ];

  const handleNavigate = (value: string, closeMobile = false) => {
    onNavigate(value);
    if (closeMobile) setMobileOpen(false);
  };

  const renderNavigation = (closeMobile: boolean) => (
    <nav aria-label="Navegação principal do almoxarifado" className="space-y-5 px-3 py-4">
      {sections.map((section) => {
        const visibleItems = section.items.filter((item) => item.visible !== false);
        if (visibleItems.length === 0) return null;

        return (
          <div key={section.label} className="space-y-1.5">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {section.label}
            </p>
            <div className="space-y-1">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const active = tabAtiva === item.value;

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
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
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
