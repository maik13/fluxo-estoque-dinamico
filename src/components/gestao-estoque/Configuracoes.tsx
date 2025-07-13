import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Settings, User, Palette, FileText, Download, Upload, Moon, Sun } from 'lucide-react';

interface ConfiguracoesProps {
  onConfigChange?: () => void;
}

export const Configuracoes = ({ onConfigChange }: ConfiguracoesProps) => {
  const { toast } = useToast();
  const [tema, setTema] = useState('light');
  const [dialogoCadastroUsuario, setDialogoCadastroUsuario] = useState(false);
  const [dialogoRelatorios, setDialogoRelatorios] = useState(false);
  
  // Estados para cadastro de usuário
  const [formUsuario, setFormUsuario] = useState({
    nome: '',
    email: '',
    perfil: 'operador',
    setor: ''
  });

  // Função para alternar tema
  const alterarTema = (novoTema: string) => {
    setTema(novoTema);
    const html = document.documentElement;
    if (novoTema === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    
    toast({
      title: "Tema alterado",
      description: `Tema ${novoTema === 'dark' ? 'escuro' : 'claro'} ativado com sucesso!`,
    });
  };

  // Função para cadastrar usuário
  const handleCadastroUsuario = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simular cadastro de usuário
    const usuarios = JSON.parse(localStorage.getItem('usuarios') || '[]');
    const novoUsuario = {
      id: Date.now(),
      ...formUsuario,
      dataCadastro: new Date().toISOString()
    };
    
    usuarios.push(novoUsuario);
    localStorage.setItem('usuarios', JSON.stringify(usuarios));
    
    toast({
      title: "Usuário cadastrado",
      description: `Usuário ${formUsuario.nome} cadastrado com sucesso!`,
    });
    
    setDialogoCadastroUsuario(false);
    setFormUsuario({ nome: '', email: '', perfil: 'operador', setor: '' });
    onConfigChange?.();
  };

  // Função para exportar dados
  const exportarDados = () => {
    const estoque = localStorage.getItem('estoque') || '[]';
    const movimentacoes = localStorage.getItem('movimentacoes') || '[]';
    const usuarios = localStorage.getItem('usuarios') || '[]';
    
    const dadosExportacao = {
      estoque: JSON.parse(estoque),
      movimentacoes: JSON.parse(movimentacoes),
      usuarios: JSON.parse(usuarios),
      dataExportacao: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(dadosExportacao, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-estoque-${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Dados exportados",
      description: "Backup dos dados baixado com sucesso!",
    });
  };

  // Função para importar dados
  const importarDados = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const dados = JSON.parse(e.target?.result as string);
        
        if (dados.estoque) localStorage.setItem('estoque', JSON.stringify(dados.estoque));
        if (dados.movimentacoes) localStorage.setItem('movimentacoes', JSON.stringify(dados.movimentacoes));
        if (dados.usuarios) localStorage.setItem('usuarios', JSON.stringify(dados.usuarios));
        
        toast({
          title: "Dados importados",
          description: "Backup restaurado com sucesso!",
        });
        
        onConfigChange?.();
        window.location.reload(); // Recarregar para atualizar os dados
      } catch (error) {
        toast({
          title: "Erro na importação",
          description: "Arquivo inválido ou corrompido.",
          variant: "destructive"
        });
      }
    };
    reader.readAsText(file);
  };

  // Função para gerar relatórios
  const gerarRelatorio = (tipo: string) => {
    const estoque = JSON.parse(localStorage.getItem('estoque') || '[]');
    const movimentacoes = JSON.parse(localStorage.getItem('movimentacoes') || '[]');
    
    let dadosRelatorio = '';
    let nomeArquivo = '';
    
    switch (tipo) {
      case 'estoque':
        dadosRelatorio = `RELATÓRIO DE ESTOQUE - ${new Date().toLocaleDateString('pt-BR')}\n\n`;
        dadosRelatorio += 'CÓDIGO\tNOME\tQUANTIDADE\tUNIDADE\tLOCALIZAÇÃO\tCONDIÇÃO\n';
        estoque.forEach((item: any) => {
          dadosRelatorio += `${item.codigoBarras}\t${item.nome}\t${item.quantidade}\t${item.unidade}\t${item.localizacao}\t${item.condicao}\n`;
        });
        nomeArquivo = `relatorio-estoque-${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.txt`;
        break;
        
      case 'movimentacoes':
        dadosRelatorio = `RELATÓRIO DE MOVIMENTAÇÕES - ${new Date().toLocaleDateString('pt-BR')}\n\n`;
        dadosRelatorio += 'DATA\tTIPO\tCÓDIGO\tITEM\tQUANTIDADE\tRESPONSÁVEL\n';
        movimentacoes.forEach((mov: any) => {
          dadosRelatorio += `${new Date(mov.dataHora).toLocaleDateString('pt-BR')}\t${mov.tipo}\t${mov.codigoBarras}\t${mov.nomeItem}\t${mov.quantidade}\t${mov.responsavel}\n`;
        });
        nomeArquivo = `relatorio-movimentacoes-${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.txt`;
        break;
        
      case 'estoque-baixo':
        dadosRelatorio = `RELATÓRIO DE ESTOQUE BAIXO - ${new Date().toLocaleDateString('pt-BR')}\n\n`;
        dadosRelatorio += 'CÓDIGO\tNOME\tQUANTIDADE\tUNIDADE\tLOCALIZAÇÃO\n';
        estoque.filter((item: any) => item.quantidade <= 5).forEach((item: any) => {
          dadosRelatorio += `${item.codigoBarras}\t${item.nome}\t${item.quantidade}\t${item.unidade}\t${item.localizacao}\n`;
        });
        nomeArquivo = `relatorio-estoque-baixo-${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.txt`;
        break;
    }
    
    const blob = new Blob([dadosRelatorio], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Relatório gerado",
      description: `Relatório de ${tipo} baixado com sucesso!`,
    });
  };

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="hover:scale-105 transition-all">
            <Settings className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {/* Cadastrar Usuário */}
          <DropdownMenuItem onClick={() => setDialogoCadastroUsuario(true)}>
            <User className="mr-2 h-4 w-4" />
            Cadastrar Usuário
          </DropdownMenuItem>
          
          {/* Alterar Tema */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <DropdownMenuItem>
                <Palette className="mr-2 h-4 w-4" />
                Alterar Tema
              </DropdownMenuItem>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="left">
              <DropdownMenuItem onClick={() => alterarTema('light')}>
                <Sun className="mr-2 h-4 w-4" />
                Claro
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => alterarTema('dark')}>
                <Moon className="mr-2 h-4 w-4" />
                Escuro
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Relatórios */}
          <DropdownMenuItem onClick={() => setDialogoRelatorios(true)}>
            <FileText className="mr-2 h-4 w-4" />
            Emitir Relatórios
          </DropdownMenuItem>
          
          {/* Exportar */}
          <DropdownMenuItem onClick={exportarDados}>
            <Download className="mr-2 h-4 w-4" />
            Exportar Dados
          </DropdownMenuItem>
          
          {/* Importar */}
          <DropdownMenuItem asChild>
            <label className="cursor-pointer">
              <Upload className="mr-2 h-4 w-4" />
              Importar Dados
              <input
                type="file"
                accept=".json"
                onChange={importarDados}
                className="hidden"
              />
            </label>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog Cadastro de Usuário */}
      <Dialog open={dialogoCadastroUsuario} onOpenChange={setDialogoCadastroUsuario}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>👤 Cadastrar Usuário</DialogTitle>
            <DialogDescription>
              Cadastre um novo usuário para o sistema
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleCadastroUsuario} className="space-y-4">
            <div>
              <Label htmlFor="nomeUsuario">Nome Completo *</Label>
              <Input
                id="nomeUsuario"
                value={formUsuario.nome}
                onChange={(e) => setFormUsuario(prev => ({...prev, nome: e.target.value}))}
                placeholder="Digite o nome completo"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="emailUsuario">E-mail *</Label>
              <Input
                id="emailUsuario"
                type="email"
                value={formUsuario.email}
                onChange={(e) => setFormUsuario(prev => ({...prev, email: e.target.value}))}
                placeholder="Digite o e-mail"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="perfilUsuario">Perfil de Acesso</Label>
              <Select value={formUsuario.perfil} onValueChange={(value) => setFormUsuario(prev => ({...prev, perfil: value}))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o perfil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="operador">Operador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="setorUsuario">Setor</Label>
              <Input
                id="setorUsuario"
                value={formUsuario.setor}
                onChange={(e) => setFormUsuario(prev => ({...prev, setor: e.target.value}))}
                placeholder="Ex: Estoque, Compras, Vendas"
              />
            </div>
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogoCadastroUsuario(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                Cadastrar Usuário
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Relatórios */}
      <Dialog open={dialogoRelatorios} onOpenChange={setDialogoRelatorios}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>📊 Emitir Relatórios</DialogTitle>
            <DialogDescription>
              Selecione o tipo de relatório que deseja gerar
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4">
            <Card className="cursor-pointer hover:bg-muted/50" onClick={() => gerarRelatorio('estoque')}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Relatório de Estoque</CardTitle>
                <CardDescription>
                  Lista completa de todos os itens em estoque
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="cursor-pointer hover:bg-muted/50" onClick={() => gerarRelatorio('movimentacoes')}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Relatório de Movimentações</CardTitle>
                <CardDescription>
                  Histórico de todas as entradas e saídas
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="cursor-pointer hover:bg-muted/50" onClick={() => gerarRelatorio('estoque-baixo')}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Relatório de Estoque Baixo</CardTitle>
                <CardDescription>
                  Itens com quantidade menor ou igual a 5 unidades
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
          
          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={() => setDialogoRelatorios(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};