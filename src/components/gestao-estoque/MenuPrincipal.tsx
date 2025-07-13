import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Plus, ArrowUp, ArrowDown, Scan } from 'lucide-react';
import { useEstoque } from '@/hooks/useEstoque';
import { Item } from '@/types/estoque';

interface MenuPrincipalProps {
  onMovimentacaoRealizada: () => void;
}

export const MenuPrincipal = ({ onMovimentacaoRealizada }: MenuPrincipalProps) => {
  const { cadastrarItem, registrarEntrada, registrarSaida, buscarItemPorCodigo } = useEstoque();
  
  // Estados para controlar os diálogos
  const [dialogoCadastro, setDialogoCadastro] = useState(false);
  const [dialogoEntrada, setDialogoEntrada] = useState(false);
  const [dialogoSaida, setDialogoSaida] = useState(false);

  // Estados para os formulários
  const [formCadastro, setFormCadastro] = useState<Partial<Item>>({
    codigoBarras: '',
    origem: '',
    caixaOrganizador: '',
    localizacao: '',
    responsavel: '',
    nome: '',
    especificacao: '',
    marca: '',
    quantidade: 0,
    unidade: '',
    condicao: 'Novo',
    categoria: '',
    subcategoria: ''
  });

  const [formMovimentacao, setFormMovimentacao] = useState({
    codigoBarras: '',
    quantidade: 0,
    responsavel: '',
    observacoes: ''
  });

  // Função para resetar formulários
  const resetarFormularios = () => {
    setFormCadastro({
      codigoBarras: '',
      origem: '',
      caixaOrganizador: '',
      localizacao: '',
      responsavel: '',
      nome: '',
      especificacao: '',
      marca: '',
      quantidade: 0,
      unidade: '',
      condicao: 'Novo',
      categoria: '',
      subcategoria: ''
    });
    setFormMovimentacao({
      codigoBarras: '',
      quantidade: 0,
      responsavel: '',
      observacoes: ''
    });
  };

  // Função para lidar com cadastro
  const handleCadastro = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (cadastrarItem(formCadastro as Omit<Item, 'id' | 'dataCriacao'>)) {
      setDialogoCadastro(false);
      resetarFormularios();
      onMovimentacaoRealizada();
    }
  };

  // Função para lidar com entrada
  const handleEntrada = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (registrarEntrada(
      formMovimentacao.codigoBarras,
      formMovimentacao.quantidade,
      formMovimentacao.responsavel,
      formMovimentacao.observacoes
    )) {
      setDialogoEntrada(false);
      resetarFormularios();
      onMovimentacaoRealizada();
    }
  };

  // Função para lidar com saída
  const handleSaida = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (registrarSaida(
      formMovimentacao.codigoBarras,
      formMovimentacao.quantidade,
      formMovimentacao.responsavel,
      formMovimentacao.observacoes
    )) {
      setDialogoSaida(false);
      resetarFormularios();
      onMovimentacaoRealizada();
    }
  };

  // Função para buscar item quando código for digitado
  const buscarItemAoDigitarCodigo = (codigo: string, tipo: 'entrada' | 'saida') => {
    if (codigo.length >= 3) { // Buscar após 3 caracteres
      const item = buscarItemPorCodigo(codigo);
      if (item) {
        // Aqui você pode mostrar informações do item encontrado
        console.log('Item encontrado:', item);
      }
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
          🏭 Sistema de Gestão de Estoque
        </h1>
        <p className="text-muted-foreground mt-2">
          Controle completo do seu estoque de materiais elétricos
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* BOTÃO CADASTRO */}
        <Dialog open={dialogoCadastro} onOpenChange={setDialogoCadastro}>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:scale-105 transition-all duration-300 border-success/20 hover:border-success/40">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-4">
                  <Plus className="h-8 w-8 text-success" />
                </div>
                <CardTitle className="text-success">Cadastrar Item</CardTitle>
                <CardDescription>
                  Cadastrar novos materiais no estoque
                </CardDescription>
              </CardHeader>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>📝 Cadastrar Novo Item</DialogTitle>
              <DialogDescription>
                Preencha todos os campos para cadastrar um novo item no estoque
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleCadastro} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="codigoBarras">Código de Barras *</Label>
                  <Input
                    id="codigoBarras"
                    value={formCadastro.codigoBarras}
                    onChange={(e) => setFormCadastro(prev => ({...prev, codigoBarras: e.target.value}))}
                    placeholder="Digite ou escaneie o código"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="nome">Nome do Item *</Label>
                  <Input
                    id="nome"
                    value={formCadastro.nome}
                    onChange={(e) => setFormCadastro(prev => ({...prev, nome: e.target.value}))}
                    placeholder="Ex: Cabo flexível 2,5mm"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="origem">Origem</Label>
                  <Input
                    id="origem"
                    value={formCadastro.origem}
                    onChange={(e) => setFormCadastro(prev => ({...prev, origem: e.target.value}))}
                    placeholder="Fornecedor, nota fiscal, etc."
                  />
                </div>
                
                <div>
                  <Label htmlFor="caixaOrganizador">Caixa/Organizador</Label>
                  <Input
                    id="caixaOrganizador"
                    value={formCadastro.caixaOrganizador}
                    onChange={(e) => setFormCadastro(prev => ({...prev, caixaOrganizador: e.target.value}))}
                    placeholder="Caixa 01, Estante A, etc."
                  />
                </div>
                
                <div>
                  <Label htmlFor="localizacao">Localização</Label>
                  <Input
                    id="localizacao"
                    value={formCadastro.localizacao}
                    onChange={(e) => setFormCadastro(prev => ({...prev, localizacao: e.target.value}))}
                    placeholder="Prateleira, setor, etc."
                  />
                </div>
                
                <div>
                  <Label htmlFor="responsavel">Responsável *</Label>
                  <Input
                    id="responsavel"
                    value={formCadastro.responsavel}
                    onChange={(e) => setFormCadastro(prev => ({...prev, responsavel: e.target.value}))}
                    placeholder="Nome do responsável"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="marca">Marca</Label>
                  <Input
                    id="marca"
                    value={formCadastro.marca}
                    onChange={(e) => setFormCadastro(prev => ({...prev, marca: e.target.value}))}
                    placeholder="Ex: Tramontina, Schneider"
                  />
                </div>
                
                <div>
                  <Label htmlFor="categoria">Categoria</Label>
                  <Input
                    id="categoria"
                    value={formCadastro.categoria}
                    onChange={(e) => setFormCadastro(prev => ({...prev, categoria: e.target.value}))}
                    placeholder="Ex: Cabos, Disjuntores, Ferramentas"
                  />
                </div>
                
                <div>
                  <Label htmlFor="subcategoria">Subcategoria</Label>
                  <Input
                    id="subcategoria"
                    value={formCadastro.subcategoria}
                    onChange={(e) => setFormCadastro(prev => ({...prev, subcategoria: e.target.value}))}
                    placeholder="Ex: Cabo flexível, Monopolar"
                  />
                </div>
                
                <div>
                  <Label htmlFor="quantidade">Quantidade *</Label>
                  <Input
                    id="quantidade"
                    type="number"
                    min="0"
                    value={formCadastro.quantidade}
                    onChange={(e) => setFormCadastro(prev => ({...prev, quantidade: Number(e.target.value)}))}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="unidade">Unidade *</Label>
                  <Input
                    id="unidade"
                    value={formCadastro.unidade}
                    onChange={(e) => setFormCadastro(prev => ({...prev, unidade: e.target.value}))}
                    placeholder="metro, peça, kg, rolo"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="condicao">Condição</Label>
                  <Select 
                    value={formCadastro.condicao} 
                    onValueChange={(value) => setFormCadastro(prev => ({...prev, condicao: value as any}))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a condição" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Novo">Novo</SelectItem>
                      <SelectItem value="Usado">Usado</SelectItem>
                      <SelectItem value="Defeito">Defeito</SelectItem>
                      <SelectItem value="Descarte">Descarte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="especificacao">Especificação Técnica</Label>
                <Textarea
                  id="especificacao"
                  value={formCadastro.especificacao}
                  onChange={(e) => setFormCadastro(prev => ({...prev, especificacao: e.target.value}))}
                  placeholder="Amperagem, bitola, tipo, BWG, gramatura, etc."
                  rows={3}
                />
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogoCadastro(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  Cadastrar Item
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* BOTÃO ENTRADA */}
        <Dialog open={dialogoEntrada} onOpenChange={setDialogoEntrada}>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:scale-105 transition-all duration-300 border-info/20 hover:border-info/40">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-info/10 rounded-full flex items-center justify-center mb-4">
                  <ArrowUp className="h-8 w-8 text-info" />
                </div>
                <CardTitle className="text-info">Entrada</CardTitle>
                <CardDescription>
                  Registrar entrada de materiais
                </CardDescription>
              </CardHeader>
            </Card>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>📥 Registrar Entrada</DialogTitle>
              <DialogDescription>
                Registre a entrada de materiais no estoque
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleEntrada} className="space-y-4">
              <div>
                <Label htmlFor="codigoBarrasEntrada">Código de Barras *</Label>
                <div className="flex space-x-2">
                  <Input
                    id="codigoBarrasEntrada"
                    value={formMovimentacao.codigoBarras}
                    onChange={(e) => {
                      setFormMovimentacao(prev => ({...prev, codigoBarras: e.target.value}));
                      buscarItemAoDigitarCodigo(e.target.value, 'entrada');
                    }}
                    placeholder="Digite ou escaneie o código"
                    required
                  />
                  <Button type="button" variant="outline" size="icon">
                    <Scan className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div>
                <Label htmlFor="quantidadeEntrada">Quantidade *</Label>
                <Input
                  id="quantidadeEntrada"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formMovimentacao.quantidade}
                  onChange={(e) => setFormMovimentacao(prev => ({...prev, quantidade: Number(e.target.value)}))}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="responsavelEntrada">Responsável *</Label>
                <Input
                  id="responsavelEntrada"
                  value={formMovimentacao.responsavel}
                  onChange={(e) => setFormMovimentacao(prev => ({...prev, responsavel: e.target.value}))}
                  placeholder="Nome do responsável pela entrada"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="observacoesEntrada">Observações</Label>
                <Textarea
                  id="observacoesEntrada"
                  value={formMovimentacao.observacoes}
                  onChange={(e) => setFormMovimentacao(prev => ({...prev, observacoes: e.target.value}))}
                  placeholder="Observações sobre a entrada (opcional)"
                  rows={3}
                />
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogoEntrada(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  Registrar Entrada
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* BOTÃO SAÍDA */}
        <Dialog open={dialogoSaida} onOpenChange={setDialogoSaida}>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:scale-105 transition-all duration-300 border-warning/20 hover:border-warning/40">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mb-4">
                  <ArrowDown className="h-8 w-8 text-warning" />
                </div>
                <CardTitle className="text-warning">Saída</CardTitle>
                <CardDescription>
                  Registrar saída de materiais
                </CardDescription>
              </CardHeader>
            </Card>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>📤 Registrar Saída</DialogTitle>
              <DialogDescription>
                Registre a saída de materiais do estoque
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSaida} className="space-y-4">
              <div>
                <Label htmlFor="codigoBarrasSaida">Código de Barras *</Label>
                <div className="flex space-x-2">
                  <Input
                    id="codigoBarrasSaida"
                    value={formMovimentacao.codigoBarras}
                    onChange={(e) => {
                      setFormMovimentacao(prev => ({...prev, codigoBarras: e.target.value}));
                      buscarItemAoDigitarCodigo(e.target.value, 'saida');
                    }}
                    placeholder="Digite ou escaneie o código"
                    required
                  />
                  <Button type="button" variant="outline" size="icon">
                    <Scan className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div>
                <Label htmlFor="quantidadeSaida">Quantidade *</Label>
                <Input
                  id="quantidadeSaida"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formMovimentacao.quantidade}
                  onChange={(e) => setFormMovimentacao(prev => ({...prev, quantidade: Number(e.target.value)}))}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="responsavelSaida">Responsável *</Label>
                <Input
                  id="responsavelSaida"
                  value={formMovimentacao.responsavel}
                  onChange={(e) => setFormMovimentacao(prev => ({...prev, responsavel: e.target.value}))}
                  placeholder="Nome do responsável pela saída"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="observacoesSaida">Observações</Label>
                <Textarea
                  id="observacoesSaida"
                  value={formMovimentacao.observacoes}
                  onChange={(e) => setFormMovimentacao(prev => ({...prev, observacoes: e.target.value}))}
                  placeholder="Observações sobre a saída (opcional)"
                  rows={3}
                />
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogoSaida(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  Registrar Saída
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};