import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MenuPrincipal } from '@/components/gestao-estoque/MenuPrincipal';
import { TabelaEstoque } from '@/components/gestao-estoque/TabelaEstoque';
import { TabelaMovimentacoes } from '@/components/gestao-estoque/TabelaMovimentacoes';
import { Package, Menu, History } from 'lucide-react';

const Index = () => {
  const [tabAtiva, setTabAtiva] = useState('menu');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Função chamada quando uma movimentação é realizada
  const handleMovimentacaoRealizada = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="container mx-auto p-4">
          <h1 className="text-2xl font-bold text-foreground">
            Controle completo do seu estoque de materiais
          </h1>
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
            <MenuPrincipal onMovimentacaoRealizada={handleMovimentacaoRealizada} />
          </TabsContent>

          <TabsContent value="estoque" className="space-y-6">
            <TabelaEstoque key={refreshTrigger} />
          </TabsContent>

          <TabsContent value="movimentacoes" className="space-y-6">
            <TabelaMovimentacoes key={refreshTrigger} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
