import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputCurrency } from '@/components/ui/input-currency';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Package, Plus, ArrowUp, ArrowDown, Scan, Check, ChevronsUpDown, FileBarChart, Send, Copy, X } from 'lucide-react';
import { useEstoque } from '@/hooks/useEstoque';
import { Item, EstoqueItem } from '@/types/estoque';
import { Configuracoes } from './Configuracoes';
import { SeletorEstoque } from './SeletorEstoque';
import { UploadFotoProduto } from './UploadFotoProduto';
import { SolicitarMaterial } from './SolicitarMaterial';
import { DevolverMaterial } from './DevolverMaterial';
import { RegistrarEntrada } from './RegistrarEntrada';
import { Transferencia } from './Transferencia';
import { Badge } from '@/components/ui/badge';
import { RelatoriosComFiltros } from './RelatoriosComFiltros';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { itemRegistrationSchema } from '@/schemas/validation';
import { toast } from 'sonner';

interface MenuPrincipalProps {
  onMovimentacaoRealizada: () => void;
}

export const MenuPrincipal = ({ onMovimentacaoRealizada }: MenuPrincipalProps) => {
  const { cadastrarItem, registrarEntrada, registrarSaida, buscarItemPorCodigo, verificarCodigoExistente, obterProximoCodigoDisponivel, obterEstoque } = useEstoque();
  const { obterTiposServicoAtivos, obterSubcategoriasAtivas, obterCategoriasUnicas, obterSubcategoriasPorCategoria, obterEstoqueAtivoInfo, tiposOperacao } = useConfiguracoes();
  const { canCreateItems, canManageStock } = usePermissions();
  
  // Estados para controlar os diálogos
  const [dialogoCadastro, setDialogoCadastro] = useState(false);
  const [dialogoSaida, setDialogoSaida] = useState(false);
  

  // Estados para os formulários
  const [formCadastro, setFormCadastro] = useState<Partial<Item>>({
    codigoBarras: 0,
    codigoAntigo: '',
    origem: '',
    caixaOrganizador: '',
    nome: '',
    especificacao: '',
    marca: '',
    unidade: '',
    condicao: 'Novo',
    subcategoriaId: undefined,
    ncm: '',
    valor: 0
  });

  const [codigoBarrasManual, setCodigoBarrasManual] = useState<string>('');
  const [erroCodigoBarras, setErroCodigoBarras] = useState<string>('');
  const [proximoCodigoDisponivel, setProximoCodigoDisponivel] = useState<number | null>(null);

  const [formMovimentacao, setFormMovimentacao] = useState({
    codigoBarras: 0,
    quantidade: 0,
    observacoes: '',
    tipoOperacaoId: '',
    destinatario: ''
  });

  // Estados para busca inteligente na saída
  const [buscaSaida, setBuscaSaida] = useState('');
  const [popoverSaidaAberto, setPopoverSaidaAberto] = useState(false);
  const [itemSelecionadoSaida, setItemSelecionadoSaida] = useState<EstoqueItem | null>(null);
  
  // Estado para categoria selecionada no formulário de cadastro
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>('');
  
  // Estado para lista de itens na saída
  interface ItemSaida {
    item: EstoqueItem;
    quantidade: number;
  }
  const [itensSaida, setItensSaida] = useState<ItemSaida[]>([]);

  // Obter todos os itens do estoque para busca inteligente
  const itensEstoque = useMemo(() => {
    return obterEstoque(); // Retorna todos os itens, independente do estoque
  }, [obterEstoque]);

  // Obter categorias únicas
  const categoriasUnicas = useMemo(() => {
    return obterCategoriasUnicas();
  }, [obterCategoriasUnicas]);

  // Obter subcategorias ativas filtradas por categoria
  const subcategoriasFiltradas = useMemo(() => {
    if (!categoriaSelecionada) return [];
    return obterSubcategoriasPorCategoria(categoriaSelecionada);
  }, [categoriaSelecionada, obterSubcategoriasPorCategoria]);

  // Filtrar itens para busca inteligente na saída
  const itensFiltrarados = useMemo(() => {
    if (!buscaSaida) return itensEstoque;
    
    const termo = buscaSaida.toLowerCase();
    return itensEstoque.filter(item => 
      item.nome.toLowerCase().includes(termo) ||
      item.codigoBarras.toString().includes(termo) ||
      item.marca.toLowerCase().includes(termo)
    );
  }, [buscaSaida, itensEstoque]);

  // Obter informações do estoque ativo
  const estoqueAtivoInfo = obterEstoqueAtivoInfo();
  const podeUsarCadastro = canCreateItems;
  const podeMovimentar = canManageStock;

  // Buscar próximo código disponível quando o dialog de cadastro abrir
  useEffect(() => {
    const buscarProximoCodigo = async () => {
      if (dialogoCadastro) {
        try {
          const { data, error } = await supabase
            .from('items')
            .select('codigo_barras')
            .order('codigo_barras', { ascending: true });

          if (error) {
            console.error('Erro ao buscar próximo código:', error);
            return;
          }

          // Códigos bloqueados/reservados que não devem ser sugeridos
          const codigosBloqueados = new Set([1001]);

          // Encontrar o primeiro número inteiro positivo disponível
          const codigosUsados = new Set(data?.map(item => Number(item.codigo_barras)) || []);
          let proximoCodigo = 1;
          
          while (codigosUsados.has(proximoCodigo) || codigosBloqueados.has(proximoCodigo)) {
            proximoCodigo++;
          }
          
          setProximoCodigoDisponivel(proximoCodigo);
        } catch (error) {
          console.error('Erro ao buscar próximo código:', error);
        }
      }
    };

    buscarProximoCodigo();
  }, [dialogoCadastro]);

  // Função para resetar formulários
  const resetarFormularios = () => {
    setFormCadastro({
      origem: '',
      codigoAntigo: '',
      caixaOrganizador: '',
      nome: '',
      tipoItem: 'Insumo',
      especificacao: '',
      marca: '',
      unidade: '',
      condicao: 'Novo',
      subcategoriaId: undefined
    });
    setCategoriaSelecionada('');
    setFormMovimentacao({
      codigoBarras: 0,
      quantidade: 0,
      observacoes: '',
      tipoOperacaoId: '',
      destinatario: ''
    });
    setBuscaSaida('');
    setItemSelecionadoSaida(null);
  };

  // Função para carregar último cadastro
  const carregarUltimoCadastro = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar último cadastro:', error);
        return;
      }

      if (data) {
        setFormCadastro({
          codigoAntigo: data.codigo_antigo || '',
          origem: data.origem || '',
          caixaOrganizador: data.caixa_organizador || '',
          nome: data.nome || '',
          tipoItem: data.tipo_item as 'Insumo' | 'Ferramenta' | 'Produto Acabado' | 'Matéria Prima',
          especificacao: data.especificacao || '',
          marca: data.marca || '',
          unidade: data.unidade || '',
          condicao: data.condicao as any,
          subcategoriaId: data.subcategoria_id || undefined,
          ncm: data.ncm || '',
          valor: data.valor || 0
        });
        // Limpar código de barras para forçar novo cadastro
        setCodigoBarrasManual('');
        setErroCodigoBarras('');
      }
    } catch (error) {
      console.error('Erro ao carregar último cadastro:', error);
    }
  };

  // Função para validar código de barras ao sair do campo
  const validarCodigoBarras = async () => {
    if (!codigoBarrasManual) {
      setErroCodigoBarras('O código de barras é obrigatório');
      return false;
    }
    
    const codigo = Number(codigoBarrasManual);
    
    // Validar diretamente no banco de dados
    const { data, error } = await supabase
      .from('items')
      .select('id')
      .eq('codigo_barras', codigo)
      .maybeSingle();
    
    if (error) {
      console.error('Erro ao validar código:', error);
      setErroCodigoBarras('Erro ao validar código de barras');
      return false;
    }
    
    if (data) {
      setErroCodigoBarras('Este código de barras já está sendo usado por outro item');
      return false;
    } else {
      setErroCodigoBarras('');
      setFormCadastro(prev => ({ ...prev, codigoBarras: codigo }));
      return true;
    }
  };

  // Função para lidar com cadastro
  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar que o código de barras foi preenchido
    if (!codigoBarrasManual) {
      setErroCodigoBarras('O código de barras é obrigatório');
      toast.error('O código de barras é obrigatório');
      return;
    }
    
    // Validar código no banco antes de prosseguir
    const codigoValido = await validarCodigoBarras();
    if (!codigoValido) {
      return;
    }
    
    const codigoFinal = Number(codigoBarrasManual);
    
    const dadosParaValidar = {
      ...formCadastro,
      codigoBarras: codigoFinal,
      nome: formCadastro.nome || '',
      unidade: formCadastro.unidade || '',
      condicao: formCadastro.condicao || 'Novo',
      subcategoriaId: formCadastro.subcategoriaId || '',
      valor: formCadastro.valor || 0
    };
    
    // Validar com zod
    const resultado = itemRegistrationSchema.safeParse(dadosParaValidar);
    
    if (!resultado.success) {
      const erros = resultado.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join('\n');
      toast.error(`Erro de validação:\n${erros}`);
      console.error('Erros de validação:', resultado.error.errors);
      return;
    }
    
    if (cadastrarItem(resultado.data as any)) {
      setDialogoCadastro(false);
      resetarFormularios();
      setCodigoBarrasManual('');
      setErroCodigoBarras('');
      onMovimentacaoRealizada();
    }
  };

  // Função para adicionar item à lista de saída
  const adicionarItemSaida = () => {
    if (!itemSelecionadoSaida) {
      toast.error('Selecione um item');
      return;
    }
    
    if (!formMovimentacao.quantidade || formMovimentacao.quantidade <= 0) {
      toast.error('Informe uma quantidade válida');
      return;
    }
    
    // Verificar se o item já está na lista
    const itemJaAdicionado = itensSaida.find(i => i.item.id === itemSelecionadoSaida.id);
    if (itemJaAdicionado) {
      toast.error('Este item já foi adicionado à lista');
      return;
    }
    
    // Adicionar item à lista
    setItensSaida(prev => [...prev, {
      item: itemSelecionadoSaida,
      quantidade: formMovimentacao.quantidade
    }]);
    
    // Limpar seleção
    limparItemSelecionado();
    setFormMovimentacao(prev => ({
      ...prev,
      quantidade: 0
    }));
    
    toast.success('Item adicionado à lista de saída');
  };
  
  // Função para remover item da lista de saída
  const removerItemSaida = (itemId: string) => {
    setItensSaida(prev => prev.filter(i => i.item.id !== itemId));
    toast.success('Item removido da lista');
  };
  
  // Função para lidar com saída (registrar todos os itens)
  const handleSaida = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (itensSaida.length === 0) {
      toast.error('Adicione pelo menos um item à lista de saída');
      return;
    }
    
    // Verificar se destinatário é obrigatório para ENTREGA DE EPI
    const tipoOperacao = tiposOperacao.find(op => op.id === formMovimentacao.tipoOperacaoId);
    const isEntregaEPI = tipoOperacao?.nome.toUpperCase().includes('ENTREGA DE EPI');
    
    if (isEntregaEPI && !formMovimentacao.destinatario.trim()) {
      toast.error('O campo Destinatário é obrigatório para Entrega de EPI');
      return;
    }
    
    // Registrar saída de todos os itens
    let todosRegistrados = true;
    for (const itemSaida of itensSaida) {
      const sucesso = registrarSaida(
        itemSaida.item.codigoBarras,
        itemSaida.quantidade,
        '',
        formMovimentacao.observacoes,
        formMovimentacao.tipoOperacaoId || undefined,
        formMovimentacao.destinatario || undefined
      );
      
      if (!sucesso) {
        todosRegistrados = false;
        break;
      }
    }
    
    if (todosRegistrados) {
      setDialogoSaida(false);
      setItensSaida([]);
      resetarFormularios();
      onMovimentacaoRealizada();
      toast.success(`Saída registrada com sucesso! ${itensSaida.length} item(ns) processado(s).`);
    }
  };

  // Função para selecionar item na busca inteligente
  const selecionarItemSaida = (item: EstoqueItem) => {
    setItemSelecionadoSaida(item);
    setBuscaSaida(item.nome);
    setFormMovimentacao(prev => ({
      ...prev,
      codigoBarras: item.codigoBarras
    }));
    setPopoverSaidaAberto(false);
  };

  // Função para limpar item selecionado
  const limparItemSelecionado = () => {
    setItemSelecionadoSaida(null);
    setBuscaSaida('');
    setFormMovimentacao(prev => ({
      ...prev,
      codigoBarras: 0
    }));
  };
  
  // Limpar lista de itens ao fechar o diálogo de saída
  const fecharDialogoSaida = () => {
    setDialogoSaida(false);
    setItensSaida([]);
    limparItemSelecionado();
    resetarFormularios();
  };

  // Função para buscar item quando código for digitado
  const buscarItemAoDigitarCodigo = (codigo: number, tipo: 'entrada' | 'saida') => {
    if (codigo > 0) {
      const item = buscarItemPorCodigo(codigo);
      if (item) {
        // Aqui você pode mostrar informações do item encontrado
        console.log('Item encontrado:', item);
      }
    }
  };


  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div className="text-center flex-1">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
            🏭 Sistema de Gestão de Almoxarifado
          </h1>
          <p className="text-muted-foreground mt-2">
            Controle completo do seu almoxarifado de materiais
          </p>
          {!podeUsarCadastro && (
            <p className="text-warning text-sm mt-1">
              📋 {!canCreateItems 
                ? "Sem permissão para cadastrar itens" 
                : "Cadastros só podem ser feitos no Estoque Principal"
              }. Estoque atual: {estoqueAtivoInfo?.nome}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Configuracoes onConfigChange={onMovimentacaoRealizada} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Solicitar Material */}
        <SolicitarMaterial />
        
        {/* Devolução de Material */}
        <DevolverMaterial />
        
        {/* Registrar Entrada */}
        <RegistrarEntrada onEntradaRealizada={onMovimentacaoRealizada} />
        
        {/* Transferência */}
        <Transferencia onTransferenciaRealizada={onMovimentacaoRealizada} />
        
        {/* BOTÃO CADASTRO */}
        <Dialog open={dialogoCadastro} onOpenChange={setDialogoCadastro}>
          <DialogTrigger asChild>
            <Card className={cn(
              "cursor-pointer hover:scale-105 transition-all duration-300",
              podeUsarCadastro 
                ? "border-success/20 hover:border-success/40" 
                : "border-muted/20 hover:border-muted/40 opacity-60"
            )}>
              <CardHeader className="text-center">
                <div className={cn(
                  "mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4",
                  podeUsarCadastro ? "bg-success/10" : "bg-muted/10"
                )}>
                  <Plus className={cn("h-8 w-8", podeUsarCadastro ? "text-success" : "text-muted-foreground")} />
                </div>
                <CardTitle className={cn(podeUsarCadastro ? "text-success" : "text-muted-foreground")}>
                  Cadastrar Item
                </CardTitle>
                <CardDescription>
                  {podeUsarCadastro 
                    ? "Cadastrar novos materiais no estoque"
                    : !canCreateItems
                      ? "Sem permissão para cadastrar"
                      : "Disponível apenas no Estoque Principal"
                  }
                </CardDescription>
              </CardHeader>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-start justify-between">
                <div>
                  <DialogTitle>📝 Cadastrar Novo Item</DialogTitle>
                  <DialogDescription>
                    Preencha todos os campos para cadastrar um novo item no estoque
                  </DialogDescription>
                </div>
                <div className="flex gap-2">
                  {proximoCodigoDisponivel && (
                    <Badge variant="secondary" className="text-sm">
                      Próximo código: {proximoCodigoDisponivel}
                    </Badge>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={carregarUltimoCadastro}
                    className="flex items-center gap-1"
                  >
                    <Copy className="h-4 w-4" />
                    Copiar Último
                  </Button>
                </div>
              </div>
            </DialogHeader>
            
            <form onSubmit={handleCadastro} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="codigoBarrasCadastro">Código de Barras *</Label>
                  <Input
                    id="codigoBarrasCadastro"
                    type="number"
                    value={codigoBarrasManual}
                    onChange={(e) => setCodigoBarrasManual(e.target.value)}
                    onBlur={validarCodigoBarras}
                    placeholder="Digite o código de barras"
                    className={erroCodigoBarras ? "border-destructive" : ""}
                    required
                  />
                  {erroCodigoBarras && (
                    <p className="text-xs text-destructive mt-1">{erroCodigoBarras}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="codigoAntigo">Código Antigo</Label>
                  <Input
                    id="codigoAntigo"
                    value={formCadastro.codigoAntigo || ''}
                    onChange={(e) => setFormCadastro(prev => ({...prev, codigoAntigo: e.target.value}))}
                    placeholder="Código anterior do item (se houver)"
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
                  <Label htmlFor="tipoItem">Tipo *</Label>
                  <Select 
                    value={formCadastro.tipoItem} 
                    onValueChange={(value) => setFormCadastro(prev => ({...prev, tipoItem: value as 'Insumo' | 'Ferramenta' | 'Produto Acabado' | 'Matéria Prima'}))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Insumo">Insumo</SelectItem>
                      <SelectItem value="Ferramenta">Ferramenta</SelectItem>
                      <SelectItem value="Produto Acabado">Produto Acabado</SelectItem>
                      <SelectItem value="Matéria Prima">Matéria Prima</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <Label htmlFor="marca">Marca</Label>
                  <Input
                    id="marca"
                    value={formCadastro.marca}
                    onChange={(e) => setFormCadastro(prev => ({...prev, marca: e.target.value}))}
                    placeholder="Ex: Tramontina, Schneider"
                  />
                </div>
                
                <div>
                  <Label htmlFor="categoria">Categoria *</Label>
                  <Select 
                    value={categoriaSelecionada} 
                    onValueChange={(value) => {
                      setCategoriaSelecionada(value);
                      // Limpar subcategoria quando categoria mudar
                      setFormCadastro(prev => ({
                        ...prev, 
                        subcategoriaId: undefined
                      }));
                    }}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {categoriasUnicas.map((cat) => (
                        <SelectItem key={cat.id} value={cat.nome}>
                          {cat.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="subcategoria">Subcategoria *</Label>
                  <Select 
                    value={formCadastro.subcategoriaId} 
                    onValueChange={(value) => {
                      setFormCadastro(prev => ({
                        ...prev, 
                        subcategoriaId: value
                      }));
                    }}
                    disabled={!categoriaSelecionada}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder={categoriaSelecionada ? "Selecione a subcategoria" : "Selecione uma categoria primeiro"} />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {subcategoriasFiltradas.map((sub) => (
                        <SelectItem key={sub.id} value={sub.id}>
                          {sub.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Selecione a condição" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="Novo">Novo</SelectItem>
                      <SelectItem value="Usado">Usado</SelectItem>
                      <SelectItem value="Defeito">Defeito</SelectItem>
                      <SelectItem value="Descarte">Descarte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="ncm">NCM *</Label>
                  <Input
                    id="ncm"
                    value={formCadastro.ncm}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, ''); // Remove tudo que não é número
                      let formatted = value;
                      
                      // Aplica a máscara 0000.00.00
                      if (value.length > 4) {
                        formatted = value.slice(0, 4) + '.' + value.slice(4);
                      }
                      if (value.length > 6) {
                        formatted = value.slice(0, 4) + '.' + value.slice(4, 6) + '.' + value.slice(6, 8);
                      }
                      
                      setFormCadastro(prev => ({...prev, ncm: formatted}));
                    }}
                    placeholder="Ex: 8544.42.00"
                    maxLength={10}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="valor">Valor</Label>
                  <InputCurrency
                    id="valor"
                    value={formCadastro.valor}
                    onChange={(valor) => setFormCadastro(prev => ({...prev, valor}))}
                    placeholder="0,00"
                  />
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
              
              <UploadFotoProduto
                fotoUrl={formCadastro.fotoUrl}
                onFotoChange={(url) => setFormCadastro(prev => ({...prev, fotoUrl: url}))}
              />
              
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


        {/* BOTÃO SAÍDA */}
        <Dialog open={dialogoSaida} onOpenChange={(aberto) => {
          if (!aberto) {
            fecharDialogoSaida();
          } else {
            setDialogoSaida(true);
          }
        }}>
          <DialogTrigger asChild>
            <Card className={cn(
              "cursor-pointer hover:scale-105 transition-all duration-300",
              podeMovimentar 
                ? "border-warning/20 hover:border-warning/40" 
                : "border-muted/20 hover:border-muted/40 opacity-60"
            )}>
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
                Adicione múltiplos itens para registrar a saída de materiais do estoque
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSaida} className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <Label htmlFor="buscaSaida">Buscar Item (Nome ou Código de Barras) *</Label>
                <div className="flex space-x-2">
                  <Popover open={popoverSaidaAberto} onOpenChange={setPopoverSaidaAberto}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={popoverSaidaAberto}
                        className="flex-1 justify-between"
                      >
                        {itemSelecionadoSaida ? itemSelecionadoSaida.nome : "Selecione um item..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput
                          placeholder="Buscar por nome ou código..."
                          value={buscaSaida}
                          onValueChange={setBuscaSaida}
                        />
                        <CommandList>
                          <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                          <CommandGroup>
                            {itensFiltrarados.map((item) => (
                              <CommandItem
                                key={item.id}
                                onSelect={() => selecionarItemSaida(item)}
                                className="cursor-pointer"
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    itemSelecionadoSaida?.id === item.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex-1">
                                  <div className="font-medium">{item.nome}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {item.codigoBarras} • {item.marca} • Estoque: {item.estoqueAtual} {item.unidade}
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {itemSelecionadoSaida && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon"
                      onClick={limparItemSelecionado}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  <Button type="button" variant="outline" size="icon">
                    <Scan className="h-4 w-4" />
                  </Button>
                </div>
                {itemSelecionadoSaida && (
                  <div className="mt-2 p-3 bg-muted rounded-md relative">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={limparItemSelecionado}
                      className="absolute top-1 right-1 h-6 w-6 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <div className="text-sm pr-6">
                      <p><strong>Nome:</strong> {itemSelecionadoSaida.nome}</p>
                      <p><strong>Código:</strong> {itemSelecionadoSaida.codigoBarras}</p>
                      <p><strong>Estoque Atual:</strong> {itemSelecionadoSaida.estoqueAtual} {itemSelecionadoSaida.unidade}</p>
                      <p><strong>Localização:</strong> {itemSelecionadoSaida.localizacao}</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <Label htmlFor="quantidadeSaida">Quantidade *</Label>
                <div className="flex space-x-2">
                  <Input
                    id="quantidadeSaida"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={formMovimentacao.quantidade || ''}
                    onChange={(e) => setFormMovimentacao(prev => ({...prev, quantidade: Number(e.target.value)}))}
                    placeholder="Digite a quantidade"
                    className="flex-1"
                  />
                  <Button 
                    type="button" 
                    onClick={adicionarItemSaida}
                    variant="default"
                    className="whitespace-nowrap"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar
                  </Button>
                </div>
              </div>

              {/* Lista de itens adicionados */}
              {itensSaida.length > 0 && (
                <div className="border rounded-md p-4 space-y-2 bg-muted/30">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-base font-semibold">Itens da Saída ({itensSaida.length})</Label>
                  </div>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {itensSaida.map((itemSaida, index) => (
                      <div key={itemSaida.item.id} className="flex items-start justify-between p-3 bg-background rounded border">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{itemSaida.item.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            Código: {itemSaida.item.codigoBarras} • 
                            Quantidade: <strong>{itemSaida.quantidade} {itemSaida.item.unidade}</strong>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Estoque disponível: {itemSaida.item.estoqueAtual} {itemSaida.item.unidade}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removerItemSaida(itemSaida.item.id)}
                          className="text-destructive hover:text-destructive ml-2"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

               <div>
                 <Label htmlFor="tipoOperacaoSaida">Operação *</Label>
                 <Select 
                   value={formMovimentacao.tipoOperacaoId} 
                   onValueChange={(value) => setFormMovimentacao(prev => ({...prev, tipoOperacaoId: value}))}
                   required
                 >
                   <SelectTrigger>
                     <SelectValue placeholder="Selecione a operação" />
                   </SelectTrigger>
                   <SelectContent>
                     {tiposOperacao
                       .filter(op => op.ativo && op.tipo === 'saida')
                       .map(op => (
                         <SelectItem key={op.id} value={op.id}>
                           {op.nome}
                         </SelectItem>
                       ))
                     }
                   </SelectContent>
                 </Select>
               </div>

               {/* Campo Destinatário - obrigatório para ENTREGA DE EPI */}
               {formMovimentacao.tipoOperacaoId && 
                 tiposOperacao.find(op => op.id === formMovimentacao.tipoOperacaoId)?.nome.toUpperCase().includes('ENTREGA DE EPI') && (
                 <div>
                   <Label htmlFor="destinatarioSaida">Destinatário (Nome da pessoa) *</Label>
                   <Input
                     id="destinatarioSaida"
                     value={formMovimentacao.destinatario}
                     onChange={(e) => setFormMovimentacao(prev => ({...prev, destinatario: e.target.value}))}
                     placeholder="Nome de quem está recebendo o EPI"
                     required
                   />
                 </div>
               )}
                 
                  <div>
                    <Label htmlFor="observacoesSaida">Observações Adicionais</Label>
                    <Textarea
                      id="observacoesSaida"
                      value={formMovimentacao.observacoes}
                      onChange={(e) => setFormMovimentacao(prev => ({...prev, observacoes: e.target.value}))}
                      placeholder="Observações adicionais sobre a saída (opcional)"
                      rows={2}
                    />
                  </div>
              
              <div className="flex justify-end space-x-2 pt-4 border-t mt-4">
                <Button type="button" variant="outline" onClick={fecharDialogoSaida}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={itensSaida.length === 0}>
                  Registrar Saída ({itensSaida.length} {itensSaida.length === 1 ? 'item' : 'itens'})
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

      </div>

    </div>
  );
};
