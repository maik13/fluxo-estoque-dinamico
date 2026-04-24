import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MenuPrincipal } from '@/components/gestao-estoque/MenuPrincipal';
import { TabelaEstoque } from '@/components/gestao-estoque/TabelaEstoque';
import { TabelaMovimentacoes } from '@/components/gestao-estoque/TabelaMovimentacoes';
import { PainelGerencial } from '@/components/gestao-estoque/PainelGerencial';
import { VisaoProjetos } from '@/components/gestao-estoque/VisaoProjetos';
import { Package, Menu, History, LogOut, BarChart3 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { SeletorEstoque } from '@/components/gestao-estoque/SeletorEstoque';
import { EstoqueProvider } from '@/contexts/EstoqueContext';
import { usePermissions } from '@/hooks/usePermissions';

const Index = () => {
  const [tabAtiva, setTabAtiva] = useState('menu');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const { session, loading, signOut } = useAuth();
  const { canManageStock, canViewReports, canAccessManagerial, canAccessProjects } = usePermissions();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) {
      navigate('/auth');
    }
  }, [loading, session, navigate]);

  useEffect(() => {
    carregarLogo();
  }, []);

  const carregarLogo = async () => {
    try {
      const { data, error } = await supabase.storage
        .from('branding')
        .list('', { limit: 1 });

      if (error) throw error;

      if (data && data.length > 0) {
        const { data: publicUrlData } = supabase.storage
          .from('branding')
          .getPublicUrl(data[0].name);
        
        setLogoUrl(publicUrlData.publicUrl);
      }
    } catch (error) {
      console.error('Erro ao carregar logo:', error);
    }
  };

  return (
    <EstoqueProvider>
      <div className="min-h-screen bg-background overflow-x-hidden">
        {/* Header Premium */}
        <div
          className="sticky top-0 z-40 border-b"
          style={{
            background: 'linear-gradient(180deg, hsl(224 32% 9%), hsl(222 28% 7%))',
            borderBottomColor: 'hsl(145 72% 42% / 0.2)',
            boxShadow: '0 1px 0 hsl(145 72% 42% / 0.15), 0 4px 24px hsl(222 28% 4% / 0.6)',
          }}
        >
          <div className="px-6 py-3 flex items-center justify-between gap-4">
            {/* Logo + Title */}
            <div className="flex items-center gap-3 min-w-0">
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="h-10 w-auto object-contain flex-shrink-0 drop-shadow-lg"
                />
              )}
              <div className="min-w-0">
                <h1 className="text-lg font-bold leading-tight truncate"
                  style={{
                    background: 'linear-gradient(135deg, hsl(145 72% 62%), hsl(186 72% 57%))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  🏭 Almoxarifado
                </h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Sistema de gestão de materiais
                </p>
              </div>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <SeletorEstoque />
              {session?.user?.email && (
                <span className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground
                  bg-muted/60 border border-border rounded-lg px-3 py-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  {session.user.email}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">Sair</span>
              </Button>
            </div>
          </div>
        </div>
        
        <div className="w-full px-4 py-4">
          {(() => {
            const showEstoque = canManageStock();
            const showMovimentacoes = canManageStock(); // A Engenharia agora acessa Relatórios e Projetos via Menu Principal
            const showGerencial = canAccessManagerial();
            const showProjetos = canAccessProjects();
            
            // Filtra as abas que serão mostradas no topo
            const tabCount = 1 + (showEstoque ? 1 : 0) + (showMovimentacoes ? 1 : 0);
            
            return (
              <Tabs value={tabAtiva} onValueChange={setTabAtiva} className="w-full">
                <TabsList 
                  className="grid w-full mb-6" 
                  style={{ gridTemplateColumns: `repeat(${tabCount}, 1fr)` }}
                >
                  <TabsTrigger value="menu" className="flex items-center gap-2">
                    <Menu className="h-4 w-4" />
                    Menu Principal
                  </TabsTrigger>
                  {showEstoque && (
                    <TabsTrigger value="estoque" className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Estoque
                    </TabsTrigger>
                  )}
                  {showMovimentacoes && (
                    <TabsTrigger value="movimentacoes" className="flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Movimentações
                    </TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="menu" className="space-y-6">
                  <MenuPrincipal 
                    onAbrirGerencial={() => setTabAtiva('gerencial')} 
                    onAbrirProjetos={() => setTabAtiva('projetos')}
                  />
                </TabsContent>

                {showGerencial && (
                  <TabsContent value="gerencial" className="space-y-6">
                    <PainelGerencial />
                  </TabsContent>
                )}

                {showProjetos && (
                  <TabsContent value="projetos" className="space-y-6">
                    <VisaoProjetos />
                  </TabsContent>
                )}

                {showEstoque && (
                  <TabsContent value="estoque" className="space-y-6">
                    <TabelaEstoque 
                      onAbrirRetirada={() => setTabAtiva('menu')}
                    />
                  </TabsContent>
                )}

                {showMovimentacoes && (
                  <TabsContent value="movimentacoes" className="space-y-6">
                    <TabelaMovimentacoes />
                  </TabsContent>
                )}
              </Tabs>
            );
          })()}
        </div>
      </div>
    </EstoqueProvider>
  );
};

export default Index;
