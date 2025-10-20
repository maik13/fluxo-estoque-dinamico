import { useState, useEffect } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { gerarRelatorioPDF } from '@/utils/pdfExport';
import { useEstoque } from '@/hooks/useEstoque';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { GuiaImportacaoExcel } from './GuiaImportacaoExcel';
import { UsuariosList } from './UsuariosList';
import { RelatoriosComFiltros } from './RelatoriosComFiltros';

interface ConfiguracoesProps {
  onConfigChange?: () => void;
}

export const Configuracoes = ({ onConfigChange }: ConfiguracoesProps) => {
  const { toast } = useToast();
  const { obterEstoque } = useEstoque();
  const {
    estoques,
    tiposServico,
    subcategorias,
    tiposOperacao,
    solicitantes,
    locaisUtilizacao,
    obterEstoquesAtivos,
    obterTiposServicoAtivos,
    obterSubcategoriasAtivas,
    obterTiposOperacaoAtivos,
    obterSolicitantesAtivos,
    obterLocaisUtilizacaoAtivos,
    adicionarEstoque,
    removerEstoque,
    adicionarTipoServico,
    removerTipoServico,
    adicionarSubcategoria,
    removerSubcategoria,
    adicionarTipoOperacao,
    removerTipoOperacao,
    adicionarSolicitante,
    removerSolicitante,
    adicionarLocalUtilizacao,
    removerLocalUtilizacao,
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
    tipo: 'estoquista',
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

  const [novoTipoOperacao, setNovoTipoOperacao] = useState({
    nome: '',
    descricao: '',
  });

  const [novoSolicitante, setNovoSolicitante] = useState({
    nome: '',
    email: '',
    codigoBarras: '',
  });

  const [novoLocal, setNovoLocal] = useState({
    nome: '',
    codigo: '',
    descricao: '',
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleTemaChange = (tema: 'light' | 'dark') => {
    setConfiguracao(prev => ({ ...prev, tema }));
    document.documentElement.classList.toggle('dark', tema === 'dark');
    onConfigChange?.();
  };

  const handleCadastroUsuario = async () => {
    if (!novoUsuario.nome || !novoUsuario.email || !novoUsuario.senha) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos para cadastrar o usuário.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Verificar duplicidade de email em profiles
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('email')
        .eq('email', novoUsuario.email)
        .maybeSingle();

      if (existingUser) {
        toast({
          title: "Email já existe",
          description: "Já existe um usuário cadastrado com este email.",
          variant: "destructive",
        });
        return;
      }

      // Criar usuário via Edge Function com Service Role
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: novoUsuario.email,
          password: novoUsuario.senha,
          nome: novoUsuario.nome,
          tipo: novoUsuario.tipo,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Usuário cadastrado!",
          description: `Usuário ${novoUsuario.nome} foi cadastrado com sucesso.`,
        });
        setNovoUsuario({ nome: '', email: '', senha: '', tipo: 'estoquista' });
      } else {
        toast({
          title: "Falha no cadastro",
          description: data?.message || 'Não foi possível cadastrar o usuário.',
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Erro:', error);
      toast({
        title: "Erro ao cadastrar",
        description: error?.message || 'Ocorreu um erro ao cadastrar o usuário.',
        variant: "destructive",
      });
    }
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

  const handleCadastroTipoOperacao = () => {
    if (!novoTipoOperacao.nome) {
      toast({
        title: "Nome obrigatório",
        description: "Digite o nome do tipo de operação.",
        variant: "destructive",
      });
      return;
    }

    adicionarTipoOperacao(novoTipoOperacao.nome, novoTipoOperacao.descricao);
    setNovoTipoOperacao({ nome: '', descricao: '' });
    onConfigChange?.();
  };

  const handleCadastroSolicitante = () => {
    if (!novoSolicitante.nome) {
      toast({
        title: "Nome obrigatório",
        description: "Digite o nome do solicitante.",
        variant: "destructive",
      });
      return;
    }

    adicionarSolicitante(novoSolicitante.nome, novoSolicitante.email, novoSolicitante.codigoBarras);
    setNovoSolicitante({ nome: '', email: '', codigoBarras: '' });
    onConfigChange?.();
  };

  const handleCadastroLocal = () => {
    if (!novoLocal.nome) {
      toast({
        title: "Nome obrigatório",
        description: "Digite o nome do local.",
        variant: "destructive",
      });
      return;
    }

    adicionarLocalUtilizacao(novoLocal.nome, novoLocal.codigo, novoLocal.descricao);
    setNovoLocal({ nome: '', codigo: '', descricao: '' });
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

  const handleUploadLogo = async () => {
    if (!logoFile) {
      toast({
        title: "Selecione um arquivo",
        description: "Escolha uma imagem para o logo do sistema.",
        variant: "destructive",
      });
      return;
    }

    setUploadingLogo(true);
    try {
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `logo.${fileExt}`;

      // Remover logo anterior se existir
      const { data: existingFiles } = await supabase.storage
        .from('branding')
        .list();

      if (existingFiles && existingFiles.length > 0) {
        for (const file of existingFiles) {
          await supabase.storage.from('branding').remove([file.name]);
        }
      }

      // Upload do novo logo
      const { error: uploadError } = await supabase.storage
        .from('branding')
        .upload(fileName, logoFile, { upsert: true });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data } = supabase.storage.from('branding').getPublicUrl(fileName);
      setLogoUrl(data.publicUrl);

      toast({
        title: "Logo atualizado!",
        description: "O logo do sistema foi atualizado com sucesso.",
      });

      setLogoFile(null);
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      toast({
        title: "Erro no upload",
        description: error.message || "Não foi possível fazer upload do logo.",
        variant: "destructive",
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const carregarLogo = async () => {
    try {
      const { data: files } = await supabase.storage.from('branding').list();

      if (files && files.length > 0) {
        const logoFile = files[0];
        const { data } = supabase.storage.from('branding').getPublicUrl(logoFile.name);
        setLogoUrl(data.publicUrl);
      }
    } catch (error) {
      console.error('Erro ao carregar logo:', error);
    }
  };

  // Carregar logo ao montar o componente
  useEffect(() => {
    carregarLogo();
  }, []);

  const handleGerarRelatorio = async (tipo: string) => {
    try {
      const itensEstoque = obterEstoque();
      let itensFiltrados = itensEstoque;
      let titulo = '';

      switch (tipo) {
        case 'Estoque Atual':
          titulo = 'RELATÓRIO DE ESTOQUE ATUAL';
          break;
        case 'Movimentações':
          titulo = 'RELATÓRIO DE MOVIMENTAÇÕES';
          // Para relatório de movimentações, seria necessário dados específicos
          break;
        case 'Itens Baixo Estoque':
          titulo = 'RELATÓRIO DE ITENS COM BAIXO ESTOQUE';
          itensFiltrados = itensEstoque.filter(item => 
            item.quantidadeMinima && item.estoqueAtual <= item.quantidadeMinima
          );
          break;
      }

      await gerarRelatorioPDF({
        titulo,
        nomeEstoque: `Relatório: ${tipo}`,
        itens: itensFiltrados
      });

      toast({
        title: "Relatório gerado!",
        description: `Relatório de ${tipo} foi gerado com sucesso.`,
      });
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar o relatório.",
        variant: "destructive",
      });
    }
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
          <TabsList className="grid w-full grid-cols-11 gap-1">
            <TabsTrigger value="usuarios" className="text-xs">Usuários</TabsTrigger>
            <TabsTrigger value="solicitantes" className="text-xs">Solicitantes</TabsTrigger>
            <TabsTrigger value="locais" className="text-xs">Locais</TabsTrigger>
            <TabsTrigger value="estoques" className="text-xs">Estoques</TabsTrigger>
            <TabsTrigger value="tipos-servico" className="text-xs">Tipos Serviço</TabsTrigger>
            <TabsTrigger value="subcategorias" className="text-xs">Subcategorias</TabsTrigger>
            <TabsTrigger value="tipos-operacao" className="text-xs">Operações</TabsTrigger>
            <TabsTrigger value="importacao" className="text-xs">Importação</TabsTrigger>
            <TabsTrigger value="logo" className="text-xs">Logo</TabsTrigger>
            <TabsTrigger value="tema" className="text-xs">Tema</TabsTrigger>
            <TabsTrigger value="relatorios" className="text-xs">Relatórios</TabsTrigger>
          </TabsList>

          {/* Aba Usuários */}
          <TabsContent value="usuarios" className="space-y-4">
            {/* Cadastro de Usuário */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Cadastrar Novo Usuário
                </CardTitle>
                <CardDescription>
                  Adicione novos usuários ao sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nomeUsuario">Nome Completo</Label>
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
                      placeholder="Senha inicial"
                    />
                  </div>
                  <div>
                    <Label htmlFor="tipoUsuario">Tipo de Usuário</Label>
                    <Select value={novoUsuario.tipo} onValueChange={(value) => setNovoUsuario(prev => ({ ...prev, tipo: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="administrador">Administrador</SelectItem>
                        <SelectItem value="gestor">Gestor</SelectItem>
                        <SelectItem value="engenharia">Engenharia</SelectItem>
                        <SelectItem value="mestre">Mestre</SelectItem>
                        <SelectItem value="estoquista">Estoquista</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleCadastroUsuario} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar Usuário
                </Button>
              </CardContent>
            </Card>

            {/* Lista de Usuários */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Usuários Cadastrados
                </CardTitle>
                <CardDescription>
                  Visualize e gerencie os usuários do sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <UsuariosList />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Solicitantes */}
          <TabsContent value="solicitantes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Gerenciar Solicitantes
                </CardTitle>
                <CardDescription>
                  Cadastre solicitantes de material
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="nomeSolicitante">Nome do Solicitante</Label>
                    <Input
                      id="nomeSolicitante"
                      value={novoSolicitante.nome}
                      onChange={(e) => setNovoSolicitante(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Nome completo"
                    />
                  </div>
                  <div>
                    <Label htmlFor="emailSolicitante">Email (Opcional)</Label>
                    <Input
                      id="emailSolicitante"
                      type="email"
                      value={novoSolicitante.email}
                      onChange={(e) => setNovoSolicitante(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="codigoBarrasSolicitante">Código de Barras</Label>
                    <Input
                      id="codigoBarrasSolicitante"
                      value={novoSolicitante.codigoBarras}
                      onChange={(e) => setNovoSolicitante(prev => ({ ...prev, codigoBarras: e.target.value }))}
                      placeholder="Código de 8 dígitos"
                      maxLength={8}
                    />
                  </div>
                </div>
                <Button onClick={handleCadastroSolicitante} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar Solicitante
                </Button>
                
                <Separator />
                
                <div className="space-y-2">
                  <h4 className="font-medium">Solicitantes Cadastrados</h4>
                  <div className="space-y-2">
                    {solicitantes.length === 0 ? (
                      <div className="text-center p-8 border rounded bg-muted/30">
                        <User className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Nenhum solicitante cadastrado ainda.
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Cadastre um solicitante usando o formulário acima.
                        </p>
                      </div>
                    ) : (
                      solicitantes.map((solicitante) => (
                        <div key={solicitante.id} className="flex items-center justify-between p-3 border rounded">
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary">{solicitante.nome}</Badge>
                            {solicitante.email && <span className="text-sm text-muted-foreground">{solicitante.email}</span>}
                            {solicitante.codigoBarras && (
                              <Badge variant="outline" className="font-mono">
                                🔢 {solicitante.codigoBarras}
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removerSolicitante(solicitante.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Locais de Utilização */}
          <TabsContent value="locais" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Gerenciar Locais de Utilização
                </CardTitle>
                <CardDescription>
                  Cadastre locais onde os materiais serão utilizados (padrão: CÓDIGO - Nome)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="codigoLocal">Código (Ex: BFL, GRA)</Label>
                    <Input
                      id="codigoLocal"
                      value={novoLocal.codigo}
                      onChange={(e) => setNovoLocal(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                      placeholder="Código"
                      maxLength={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="nomeLocal">Nome do Local</Label>
                    <Input
                      id="nomeLocal"
                      value={novoLocal.nome}
                      onChange={(e) => setNovoLocal(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Nome completo"
                    />
                  </div>
                  <div>
                    <Label htmlFor="descricaoLocal">Descrição (Opcional)</Label>
                    <Input
                      id="descricaoLocal"
                      value={novoLocal.descricao}
                      onChange={(e) => setNovoLocal(prev => ({ ...prev, descricao: e.target.value }))}
                      placeholder="Descrição"
                    />
                  </div>
                </div>
                <Button onClick={handleCadastroLocal} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar Local
                </Button>
                
                <Separator />
                
                <div className="space-y-2">
                  <h4 className="font-medium">Locais Cadastrados</h4>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {locaisUtilizacao.map((local) => (
                      <div key={local.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          {local.codigo && <Badge variant="outline">{local.codigo}</Badge>}
                          <span className="font-medium">{local.nome}</span>
                          {local.descricao && <span className="text-sm text-muted-foreground">- {local.descricao}</span>}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removerLocalUtilizacao(local.id)}
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

          {/* Aba Tipos de Operação */}
          <TabsContent value="tipos-operacao" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Gerenciar Tipos de Operação
                </CardTitle>
                <CardDescription>
                  Cadastre os tipos de operação para solicitações (compra, saída, quebra, etc)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nomeTipoOperacao">Nome do Tipo</Label>
                    <Input
                      id="nomeTipoOperacao"
                      value={novoTipoOperacao.nome}
                      onChange={(e) => setNovoTipoOperacao(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Ex: Compra, Saída para Produção"
                    />
                  </div>
                  <div>
                    <Label htmlFor="descricaoTipoOperacao">Descrição</Label>
                    <Input
                      id="descricaoTipoOperacao"
                      value={novoTipoOperacao.descricao}
                      onChange={(e) => setNovoTipoOperacao(prev => ({ ...prev, descricao: e.target.value }))}
                      placeholder="Descrição do tipo de operação"
                    />
                  </div>
                </div>
                <Button onClick={handleCadastroTipoOperacao} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar Tipo de Operação
                </Button>
                
                <Separator />
                
                <div className="space-y-2">
                  <h4 className="font-medium">Tipos de Operação Cadastrados</h4>
                  <div className="space-y-2">
                    {tiposOperacao.map((tipo) => (
                      <div key={tipo.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{tipo.nome}</Badge>
                          {tipo.descricao && <span className="text-sm text-muted-foreground">{tipo.descricao}</span>}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removerTipoOperacao(tipo.id)}
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

          {/* Aba Importação */}
          <TabsContent value="importacao" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Importação e Exportação de Dados
                </CardTitle>
                <CardDescription>
                  Importe dados de planilhas Excel ou exporte dados do sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button onClick={handleExportarDados} variant="outline" className="h-12">
                    <Download className="h-5 w-5 mr-2" />
                    <div className="text-left">
                      <div className="font-medium">Exportar Dados</div>
                      <div className="text-xs text-muted-foreground">Baixar backup completo</div>
                    </div>
                  </Button>
                  <Button onClick={handleImportarDados} variant="outline" className="h-12">
                    <Upload className="h-5 w-5 mr-2" />
                    <div className="text-left">
                      <div className="font-medium">Importar Dados</div>
                      <div className="text-xs text-muted-foreground">Carregar arquivo de backup</div>
                    </div>
                  </Button>
                </div>
                
                <Separator />
                
                <GuiaImportacaoExcel />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Logo */}
          <TabsContent value="logo" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Logo do Sistema
                </CardTitle>
                <CardDescription>
                  Faça upload do logo da sua empresa
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Preview do logo atual */}
                {logoUrl && (
                  <div className="space-y-2">
                    <Label>Logo Atual</Label>
                    <div className="border rounded-lg p-4 flex items-center justify-center bg-muted">
                      <img 
                        src={logoUrl} 
                        alt="Logo do sistema" 
                        className="max-h-32 object-contain"
                      />
                    </div>
                  </div>
                )}

                {/* Upload de novo logo */}
                <div className="space-y-2">
                  <Label htmlFor="logoUpload">Selecionar novo logo</Label>
                  <Input
                    id="logoUpload"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setLogoFile(file);
                      }
                    }}
                  />
                  {logoFile && (
                    <p className="text-sm text-muted-foreground">
                      Arquivo selecionado: {logoFile.name}
                    </p>
                  )}
                </div>

                <Button 
                  onClick={handleUploadLogo} 
                  disabled={!logoFile || uploadingLogo}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingLogo ? 'Enviando...' : 'Fazer Upload'}
                </Button>

                <div className="text-sm text-muted-foreground">
                  <p>Formatos aceitos: JPG, PNG, SVG</p>
                  <p>Tamanho máximo recomendado: 2MB</p>
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
                  Relatórios do Sistema
                </CardTitle>
                <CardDescription>
                  Gere e exporte relatórios do estoque e configurações da empresa
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Relatórios Filtrados */}
                <div className="space-y-4">
                  <h4 className="font-medium">Relatórios Avançados</h4>
                  <RelatoriosComFiltros />
                </div>

                <Separator />

                {/* Relatórios Básicos */}
                <div className="space-y-4">
                  <h4 className="font-medium">Relatórios Básicos</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button onClick={() => handleGerarRelatorio('Estoque Atual')} variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Relatório de Estoque
                    </Button>
                    <Button onClick={() => handleGerarRelatorio('Movimentações')} variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Relatório de Movimentações
                    </Button>
                    <Button onClick={() => handleGerarRelatorio('Itens Baixo Estoque')} variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Itens com Baixo Estoque
                    </Button>
                    <Button onClick={() => handleGerarRelatorio('Resumo Mensal')} variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Resumo Mensal
                    </Button>
                  </div>
                </div>
                
                <Separator />
                
                {/* Configuração da Empresa */}
                <div className="space-y-4">
                  <h4 className="font-medium">Configuração da Empresa</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="p-4">
                      <h5 className="font-medium mb-2">Logo da Empresa</h5>
                      <p className="text-sm text-muted-foreground mb-3">
                        Faça upload do logo da sua empresa (PNG, JPG, SVG)
                      </p>
                      <Input 
                        type="file" 
                        accept="image/*"
                        className="mb-2"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const filePath = 'logo.png';
                            const { error: upErr } = await supabase.storage
                              .from('branding')
                              .upload(filePath, file, { upsert: true, contentType: file.type });
                            if (upErr) throw upErr;

                            const { data: pub } = supabase.storage.from('branding').getPublicUrl(filePath);
                            if (pub?.publicUrl) {
                              localStorage.setItem('empresa_logo_url', pub.publicUrl);
                              toast({ title: 'Logo atualizado!', description: 'O logo foi enviado com sucesso.' });
                            }
                          } catch (err: any) {
                            toast({ title: 'Falha no upload', description: err?.message || 'Não foi possível enviar o logo.', variant: 'destructive' });
                          }
                        }}
                      />
                      <Button size="sm" className="w-full" onClick={() => (document.getElementById('logo-upload-input') as HTMLInputElement)?.click()}>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Logo
                      </Button>
                    </Card>
                  </div>
                </div>

                <Separator />
                
                {/* Backup e Importação */}
                <div className="space-y-4">
                  <h4 className="font-medium">Backup e Importação</h4>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button onClick={handleExportarDados} className="flex-1">
                      <Upload className="h-4 w-4 mr-2" />
                      Exportar Dados
                    </Button>
                    <Button onClick={handleImportarDados} variant="outline" className="flex-1">
                      <Download className="h-4 w-4 mr-2" />
                      Importar Dados
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};