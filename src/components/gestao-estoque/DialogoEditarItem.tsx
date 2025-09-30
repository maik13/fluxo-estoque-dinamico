import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
}

export const DialogoEditarItem = ({ aberto, onClose, item, onSalvar }: DialogoEditarItemProps) => {
  const { obterTiposServicoAtivos, obterSubcategoriasAtivas } = useConfiguracoes();
  const [formItem, setFormItem] = useState<Item | null>(null);

  useEffect(() => {
    if (item) {
      setFormItem({ ...item });
    }
  }, [item]);

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
                value={formItem.codigoBarras}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground mt-1">
                O código de barras não pode ser alterado
              </p>
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
              <Label htmlFor="localizacao">Localização</Label>
              <Input
                id="localizacao"
                value={formItem.localizacao}
                onChange={(e) => setFormItem(prev => prev ? {...prev, localizacao: e.target.value} : null)}
                placeholder="Prateleira, setor, etc."
              />
            </div>
            
            <div>
              <Label htmlFor="responsavel">Responsável *</Label>
              <Input
                id="responsavel"
                value={formItem.responsavel}
                onChange={(e) => setFormItem(prev => prev ? {...prev, responsavel: e.target.value} : null)}
                placeholder="Nome do responsável"
                required
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
              <Label htmlFor="tipoItem">Tipo *</Label>
              <Select 
                value={formItem.tipoItem} 
                onValueChange={(value) => setFormItem(prev => prev ? {...prev, tipoItem: value as 'Insumo' | 'Ferramenta'} : null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Insumo">Insumo</SelectItem>
                  <SelectItem value="Ferramenta">Ferramenta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="categoria">Categoria</Label>
              <Input
                id="categoria"
                value={formItem.categoria}
                onChange={(e) => setFormItem(prev => prev ? {...prev, categoria: e.target.value} : null)}
                placeholder="Ex: Cabos, Disjuntores, Ferramentas"
              />
            </div>
            
            <div>
              <Label htmlFor="subcategoria">Subcategoria</Label>
              <Select value={formItem.subcategoria} onValueChange={(value) => setFormItem(prev => prev ? {...prev, subcategoria: value} : null)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a subcategoria" />
                </SelectTrigger>
                <SelectContent>
                  {obterSubcategoriasAtivas().map((sub) => (
                    <SelectItem key={sub.id} value={sub.nome}>
                      {sub.nome} ({sub.categoria})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="subDestino">Sub Destino (Estoque)</Label>
              <Select value={formItem.subDestino} onValueChange={(value) => setFormItem(prev => prev ? {...prev, subDestino: value} : null)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o sub destino" />
                </SelectTrigger>
                <SelectContent>
                  {obterTiposServicoAtivos().map((estoque) => (
                    <SelectItem key={estoque.id} value={estoque.nome}>
                      {estoque.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="tipoServico">Tipo de Serviço</Label>
              <Select value={formItem.tipoServico} onValueChange={(value) => setFormItem(prev => prev ? {...prev, tipoServico: value} : null)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de serviço" />
                </SelectTrigger>
                <SelectContent>
                  {obterTiposServicoAtivos().map((tipo) => (
                    <SelectItem key={tipo.id} value={tipo.nome}>
                      {tipo.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="quantidadeMinima">Quantidade Mínima</Label>
              <Input
                id="quantidadeMinima"
                type="number"
                min="0"
                value={formItem.quantidadeMinima || ''}
                onChange={(e) => setFormItem(prev => prev ? {...prev, quantidadeMinima: e.target.value ? Number(e.target.value) : undefined} : null)}
                placeholder="Estoque mínimo para alerta"
              />
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