import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MenuPrincipal } from '@/components/gestao-estoque/MenuPrincipal';
import { TabelaEstoque } from '@/components/gestao-estoque/TabelaEstoque';
import { TabelaMovimentacoes } from '@/components/gestao-estoque/TabelaMovimentacoes';
import { Package, Menu, History, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { SeletorEstoque } from '@/components/gestao-estoque/SeletorEstoque';
import { EstoqueProvider } from '@/contexts/EstoqueContext';

const Index = () => {
  const [tabAtiva, setTabAtiva] = useState('menu');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const { session, loading, signOut } = useAuth();
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
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="bg-card border-b">
          <div className="container mx-auto p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {logoUrl && (
                <img 
                  src={logoUrl} 
                  alt="Logo" 
                  className="h-12 w-auto object-contain"
                />
              )}
              <h1 className="text-2xl font-bold text-foreground">
                Controle completo do seu almoxarifado de materiais
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <SeletorEstoque />
              {session?.user?.email && (
                <span className="text-sm text-muted-foreground">
                  {session.user.email}
                </span>
              )}
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" /> Sair
              </Button>
            </div>
          </div>
        </div>
        
        <div className="container mx-auto p-4">
          <Tabs value={tabAtiva} onValueChange={setTabAtiva} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="menu" className="flex items-center gap-2">
                <Menu className="h-4 w-4" />
                Menu Principal
              </TabsTrigger>
              <TabsTrigger value="estoque" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Estoque
              </TabsTrigger>
              <TabsTrigger value="movimentacoes" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Movimentações
              </TabsTrigger>
            </TabsList>

            <TabsContent value="menu" className="space-y-6">
              <MenuPrincipal />
            </TabsContent>

            <TabsContent value="estoque" className="space-y-6">
              <TabelaEstoque 
                onAbrirRetirada={() => setTabAtiva('menu')}
              />
            </TabsContent>

            <TabsContent value="movimentacoes" className="space-y-6">
              <TabelaMovimentacoes />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </EstoqueProvider>
  );
};

export default Index;
