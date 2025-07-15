import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Settings, User, Palette, FileText, Download, Upload, Plus, Trash2, Database, Wrench, Tag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';

interface ConfiguracoesProps {
  onConfigChange?: () => void;
}

export const Configuracoes = ({ onConfigChange }: ConfiguracoesProps) => {
  const { toast } = useToast();
  const {
    estoques,
    tiposServico,
    subcategorias,
    obterEstoquesAtivos,
    obterTiposServicoAtivos,
    obterSubcategoriasAtivas,
    adicionarEstoque,
    removerEstoque,
    adicionarTipoServico,
    removerTipoServico,
    adicionarSubcategoria,
    removerSubcategoria,
  } = useConfiguracoes();

  const [configuracao, setConfiguracao] = useState({
    tema: 'light',
    notificacoes: true,
    alertaEstoqueBaixo: true,
    backupAutomatico: false,
  });

  const [novoUsuario, setNovoUsuario] = useState({
    nome: '',
    email: '',
    senha: '',
    tipo: 'usuario',
  });

  const [novoEstoque, setNovoEstoque] = useState({
    nome: '',
    descricao: '',
  });

  const [novoTipoServico, setNovoTipoServico] = useState({
    nome: '',
    descricao: '',
  });

  const [novaSubcategoria, setNovaSubcategoria] = useState({
    nome: '',
    categoria: '',
  });

  const handleTemaChange = (tema: 'light' | 'dark') => {
    setConfiguracao(prev => ({ ...prev, tema }));
    document.documentElement.classList.toggle('dark', tema === 'dark');
    onConfigChange?.();
  };

  const handleCadastroUsuario = () => {
    if (!novoUsuario.nome || !novoUsuario.email || !novoUsuario.senha) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos para cadastrar o usuário.",
        variant: "destructive",
      });
      return;
    }

    // Aqui você implementaria a lógica de cadastro
    toast({
      title: "Usuário cadastrado!",
      description: `Usuário ${novoUsuario.nome} foi cadastrado com sucesso.`,
    });

    setNovoUsuario({
      nome: '',
      email: '',
      senha: '',
      tipo: 'usuario',
    });
  };

  const handleCadastroEstoque = () => {
    if (!novoEstoque.nome) {
      toast({
        title: "Nome obrigatório",
        description: "Digite o nome do estoque.",
        variant: "destructive",
      });
      return;
    }

    adicionarEstoque(novoEstoque.nome, novoEstoque.descricao);
    setNovoEstoque({ nome: '', descricao: '' });
    onConfigChange?.();
  };

  const handleCadastroTipoServico = () => {
    if (!novoTipoServico.nome) {
      toast({
        title: "Nome obrigatório",
        description: "Digite o nome do tipo de serviço.",
        variant: "destructive",
      });
      return;
    }

    adicionarTipoServico(novoTipoServico.nome, novoTipoServico.descricao);
    setNovoTipoServico({ nome: '', descricao: '' });
    onConfigChange?.();
  };

  const handleCadastroSubcategoria = () => {
    if (!novaSubcategoria.nome || !novaSubcategoria.categoria) {
      toast({
        title: "Campos obrigatórios",
        description: "Digite o nome da subcategoria e a categoria.",
        variant: "destructive",
      });
      return;
    }

    adicionarSubcategoria(novaSubcategoria.nome, novaSubcategoria.categoria);
    setNovaSubcategoria({ nome: '', categoria: '' });
    onConfigChange?.();
  };

  const handleExportarDados = () => {
    toast({
      title: "Exportação iniciada",
      description: "Os dados estão sendo exportados...",
    });
  };

  const handleImportarDados = () => {
    toast({
      title: "Importação iniciada",
      description: "Os dados estão sendo importados...",
    });
  };

  const handleGerarRelatorio = (tipo: string) => {
    toast({
      title: "Relatório gerado",
      description: `Relatório de ${tipo} foi gerado com sucesso.`,
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Configurações
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>⚙️ Configurações do Sistema</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="usuarios" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="usuarios">Usuários</TabsTrigger>
            <TabsTrigger value="estoques">Estoques</TabsTrigger>
            <TabsTrigger value="tipos-servico">Tipos de Serviço</TabsTrigger>
            <TabsTrigger value="subcategorias">Subcategorias</TabsTrigger>
            <TabsTrigger value="tema">Tema</TabsTrigger>
            <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          </TabsList>

          {/* Aba Usuários */}
          <TabsContent value="usuarios" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Cadastro de Usuário
                </CardTitle>
                <CardDescription>
                  Cadastre novos usuários para acessar o sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nomeUsuario">Nome</Label>
                    <Input
                      id="nomeUsuario"
                      value={novoUsuario.nome}
                      onChange={(e) => setNovoUsuario(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Nome do usuário"
                    />
                  </div>
                  <div>
                    <Label htmlFor="emailUsuario">Email</Label>
                    <Input
                      id="emailUsuario"
                      type="email"
                      value={novoUsuario.email}
                      onChange={(e) => setNovoUsuario(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="senhaUsuario">Senha</Label>
                    <Input
                      id="senhaUsuario"
                      type="password"
                      value={novoUsuario.senha}
                      onChange={(e) => setNovoUsuario(prev => ({ ...prev, senha: e.target.value }))}
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <Label htmlFor="tipoUsuario">Tipo de Usuário</Label>
                    <select
                      id="tipoUsuario"
                      value={novoUsuario.tipo}
                      onChange={(e) => setNovoUsuario(prev => ({ ...prev, tipo: e.target.value }))}
                      className="w-full p-2 border rounded"
                    >
                      <option value="usuario">Usuário</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                </div>
                <Button onClick={handleCadastroUsuario} className="w-full">
                  Cadastrar Usuário
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Estoques */}
          <TabsContent value="estoques" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Gerenciar Estoques
                </CardTitle>
                <CardDescription>
                  Cadastre e gerencie múltiplos estoques
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nomeEstoque">Nome do Estoque</Label>
                    <Input
                      id="nomeEstoque"
                      value={novoEstoque.nome}
                      onChange={(e) => setNovoEstoque(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Ex: Estoque Principal"
                    />
                  </div>
                  <div>
                    <Label htmlFor="descricaoEstoque">Descrição</Label>
                    <Input
                      id="descricaoEstoque"
                      value={novoEstoque.descricao}
                      onChange={(e) => setNovoEstoque(prev => ({ ...prev, descricao: e.target.value }))}
                      placeholder="Descrição do estoque"
                    />
                  </div>
                </div>
                <Button onClick={handleCadastroEstoque} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar Estoque
                </Button>
                
                <Separator />
                
                <div className="space-y-2">
                  <h4 className="font-medium">Estoques Cadastrados</h4>
                  <div className="space-y-2">
                    {estoques.map((estoque) => (
                      <div key={estoque.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{estoque.nome}</Badge>
                          {estoque.descricao && <span className="text-sm text-muted-foreground">{estoque.descricao}</span>}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removerEstoque(estoque.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Tipos de Serviço */}
          <TabsContent value="tipos-servico" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Gerenciar Tipos de Serviço
                </CardTitle>
                <CardDescription>
                  Cadastre tipos de serviço para classificar itens
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nomeTipoServico">Nome do Tipo</Label>
                    <Input
                      id="nomeTipoServico"
                      value={novoTipoServico.nome}
                      onChange={(e) => setNovoTipoServico(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Ex: Instalação Elétrica"
                    />
                  </div>
                  <div>
                    <Label htmlFor="descricaoTipoServico">Descrição</Label>
                    <Input
                      id="descricaoTipoServico"
                      value={novoTipoServico.descricao}
                      onChange={(e) => setNovoTipoServico(prev => ({ ...prev, descricao: e.target.value }))}
                      placeholder="Descrição do tipo de serviço"
                    />
                  </div>
                </div>
                <Button onClick={handleCadastroTipoServico} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar Tipo de Serviço
                </Button>
                
                <Separator />
                
                <div className="space-y-2">
                  <h4 className="font-medium">Tipos de Serviço Cadastrados</h4>
                  <div className="space-y-2">
                    {tiposServico.map((tipo) => (
                      <div key={tipo.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{tipo.nome}</Badge>
                          {tipo.descricao && <span className="text-sm text-muted-foreground">{tipo.descricao}</span>}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removerTipoServico(tipo.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Subcategorias */}
          <TabsContent value="subcategorias" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Gerenciar Subcategorias
                </CardTitle>
                <CardDescription>
                  Cadastre subcategorias para organizar melhor os itens
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nomeSubcategoria">Nome da Subcategoria</Label>
                    <Input
                      id="nomeSubcategoria"
                      value={novaSubcategoria.nome}
                      onChange={(e) => setNovaSubcategoria(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Ex: Cabo Flexível"
                    />
                  </div>
                  <div>
                    <Label htmlFor="categoriaSubcategoria">Categoria</Label>
                    <Input
                      id="categoriaSubcategoria"
                      value={novaSubcategoria.categoria}
                      onChange={(e) => setNovaSubcategoria(prev => ({ ...prev, categoria: e.target.value }))}
                      placeholder="Ex: Cabos"
                    />
                  </div>
                </div>
                <Button onClick={handleCadastroSubcategoria} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar Subcategoria
                </Button>
                
                <Separator />
                
                <div className="space-y-2">
                  <h4 className="font-medium">Subcategorias Cadastradas</h4>
                  <div className="space-y-2">
                    {subcategorias.map((subcategoria) => (
                      <div key={subcategoria.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{subcategoria.nome}</Badge>
                          <span className="text-sm text-muted-foreground">({subcategoria.categoria})</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removerSubcategoria(subcategoria.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Tema */}
          <TabsContent value="tema" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Configurações do Tema
                </CardTitle>
                <CardDescription>
                  Altere a aparência do sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tema-light">Tema Claro</Label>
                  <Switch
                    id="tema-light"
                    checked={configuracao.tema === 'light'}
                    onCheckedChange={() => handleTemaChange('light')}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="tema-dark">Tema Escuro</Label>
                  <Switch
                    id="tema-dark"
                    checked={configuracao.tema === 'dark'}
                    onCheckedChange={() => handleTemaChange('dark')}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Relatórios */}
          <TabsContent value="relatorios" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Relatórios
                </CardTitle>
                <CardDescription>
                  Gere relatórios do sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Button onClick={() => handleGerarRelatorio('estoque')} variant="outline">
                    Relatório de Estoque
                  </Button>
                  <Button onClick={() => handleGerarRelatorio('movimentacoes')} variant="outline">
                    Relatório de Movimentações
                  </Button>
                  <Button onClick={() => handleGerarRelatorio('estoque-baixo')} variant="outline">
                    Relatório de Estoque Baixo
                  </Button>
                </div>
                
                <Separator />
                
                <div className="grid grid-cols-2 gap-4">
                  <Button onClick={handleImportarDados} variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Importar Arquivo
                  </Button>
                  <Button onClick={handleExportarDados} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Dados
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};