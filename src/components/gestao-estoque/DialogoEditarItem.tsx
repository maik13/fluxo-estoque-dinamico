import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputCurrency } from '@/components/ui/input-currency';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { Item } from '@/types/estoque';

interface DialogoEditarItemProps {
  aberto: boolean;
  onClose: () => void;
  item: Item | null;
  onSalvar: (itemEditado: Item) => Promise<boolean>;
  isAdmin?: boolean;
}

export const DialogoEditarItem = ({ aberto, onClose, item, onSalvar, isAdmin = false }: DialogoEditarItemProps) => {
  const { 
    obterTiposServicoAtivos, 
    obterSubcategoriasAtivas, 
    obterCategoriasUnicas, 
    obterSubcategoriasPorCategoria,
    obterPrimeiraCategoriaDeSubcategoria 
  } = useConfiguracoes();
  const [formItem, setFormItem] = useState<Item | null>(null);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>('');

  useEffect(() => {
    if (item) {
      setFormItem({ ...item });
      // Carregar categoria do item se houver subcategoria
      if (item.subcategoriaId) {
        const primeiraCategoria = obterPrimeiraCategoriaDeSubcategoria(item.subcategoriaId);
        setCategoriaSelecionada(primeiraCategoria);
      } else {
        setCategoriaSelecionada('');
      }
    }
  }, [item, obterPrimeiraCategoriaDeSubcategoria]);

  // Obter categorias únicas
  const categoriasUnicas = obterCategoriasUnicas();

  // Obter subcategorias filtradas por categoria
  const subcategoriasFiltradas = categoriaSelecionada 
    ? obterSubcategoriasPorCategoria(categoriaSelecionada) 
    : [];

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formItem) return;

    const sucesso = await onSalvar(formItem);
    if (sucesso) {
      onClose();
    }
  };

  const handleClose = () => {
    setFormItem(null);
    setCategoriaSelecionada('');
    onClose();
  };

  if (!formItem) return null;

  return (
    <Dialog open={aberto} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>✏️ Editar Item</DialogTitle>
          <DialogDescription>
            Edite as informações do item. O código de barras não pode ser alterado.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSalvar} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="codigoBarras">Código de Barras</Label>
              <Input
                id="codigoBarras"
                type="number"
                value={formItem.codigoBarras}
                onChange={(e) => setFormItem(prev => prev ? {...prev, codigoBarras: Number(e.target.value)} : null)}
                disabled={true}
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground mt-1">
                O código de barras não pode ser alterado
              </p>
            </div>

            <div>
              <Label htmlFor="codigoAntigo">Código Antigo</Label>
              <Input
                id="codigoAntigo"
                value={formItem.codigoAntigo || ''}
                onChange={(e) => setFormItem(prev => prev ? {...prev, codigoAntigo: e.target.value} : null)}
                placeholder="Código anterior do item (se houver)"
              />
            </div>
            
            <div>
              <Label htmlFor="nome">Nome do Item *</Label>
              <Input
                id="nome"
                value={formItem.nome}
                onChange={(e) => setFormItem(prev => prev ? {...prev, nome: e.target.value} : null)}
                placeholder="Ex: Cabo flexível 2,5mm"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="tipoItem">Tipo *</Label>
              <Select 
                value={formItem.tipoItem} 
                onValueChange={(value) => setFormItem(prev => prev ? {...prev, tipoItem: value as 'Insumo' | 'Ferramenta' | 'Produto Acabado' | 'Matéria Prima'} : null)}
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
                value={formItem.origem}
                onChange={(e) => setFormItem(prev => prev ? {...prev, origem: e.target.value} : null)}
                placeholder="Fornecedor, nota fiscal, etc."
              />
            </div>
            
            <div>
              <Label htmlFor="caixaOrganizador">Caixa/Organizador</Label>
              <Input
                id="caixaOrganizador"
                value={formItem.caixaOrganizador}
                onChange={(e) => setFormItem(prev => prev ? {...prev, caixaOrganizador: e.target.value} : null)}
                placeholder="Caixa 01, Estante A, etc."
              />
            </div>
            
            <div>
              <Label htmlFor="marca">Marca</Label>
              <Input
                id="marca"
                value={formItem.marca}
                onChange={(e) => setFormItem(prev => prev ? {...prev, marca: e.target.value} : null)}
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
                  setFormItem(prev => prev ? {...prev, subcategoriaId: undefined} : null);
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
                value={formItem.subcategoriaId || ''} 
                onValueChange={(value) => setFormItem(prev => prev ? {...prev, subcategoriaId: value} : null)}
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
                value={formItem.unidade}
                onChange={(e) => setFormItem(prev => prev ? {...prev, unidade: e.target.value} : null)}
                placeholder="metro, peça, kg, rolo"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="condicao">Condição</Label>
              <Select 
                value={formItem.condicao} 
                onValueChange={(value) => setFormItem(prev => prev ? {...prev, condicao: value as any} : null)}
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
            
            <div>
              <Label htmlFor="ncm">NCM</Label>
              <Input
                id="ncm"
                value={formItem.ncm || ''}
                onChange={(e) => setFormItem(prev => prev ? {...prev, ncm: e.target.value} : null)}
                placeholder="Ex: 8544.42.00"
              />
            </div>
            
            <div>
              <Label htmlFor="valor">Valor</Label>
              <InputCurrency
                id="valor"
                value={formItem.valor || 0}
                onChange={(valor) => setFormItem(prev => prev ? {...prev, valor} : null)}
                placeholder="0,00"
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="especificacao">Especificação Técnica</Label>
            <Textarea
              id="especificacao"
              value={formItem.especificacao}
              onChange={(e) => setFormItem(prev => prev ? {...prev, especificacao: e.target.value} : null)}
              placeholder="Amperagem, bitola, tipo, BWG, gramatura, etc."
              rows={3}
            />
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit">
              Salvar Alterações
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};