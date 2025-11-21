import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UploadFotoProdutoProps {
  fotoUrl?: string;
  onFotoChange: (url: string | undefined) => void;
  itemId?: string;
}

export const UploadFotoProduto = ({ fotoUrl, onFotoChange, itemId }: UploadFotoProdutoProps) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(fotoUrl);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida');
      return;
    }

    // Validar tamanho (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    try {
      setUploading(true);

      // Deletar foto anterior se existir
      if (fotoUrl) {
        const oldPath = fotoUrl.split('/').pop();
        if (oldPath) {
          await supabase.storage.from('product-photos').remove([oldPath]);
        }
      }

      // Nome único para o arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload da imagem
      const { error: uploadError } = await supabase.storage
        .from('product-photos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('product-photos')
        .getPublicUrl(fileName);

      setPreviewUrl(publicUrl);
      onFotoChange(publicUrl);
      toast.success('Foto enviada com sucesso!');
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast.error('Erro ao enviar foto');
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!fotoUrl) return;

    try {
      const path = fotoUrl.split('/').pop();
      if (path) {
        const { error } = await supabase.storage
          .from('product-photos')
          .remove([path]);

        if (error) throw error;
      }

      setPreviewUrl(undefined);
      onFotoChange(undefined);
      toast.success('Foto removida com sucesso!');
    } catch (error) {
      console.error('Erro ao remover foto:', error);
      toast.error('Erro ao remover foto');
    }
  };

  return (
    <div className="space-y-2">
      <Label>Foto do Produto</Label>
      <div className="flex items-start gap-4">
        {previewUrl ? (
          <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-border">
            <img
              src={previewUrl}
              alt="Foto do produto"
              className="w-full h-full object-cover"
            />
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="absolute top-1 right-1 h-6 w-6"
              onClick={handleRemovePhoto}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="w-32 h-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/50">
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="foto-upload"
            disabled={uploading}
          />
          <Label
            htmlFor="foto-upload"
            className={`cursor-pointer inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Enviando...' : previewUrl ? 'Alterar Foto' : 'Adicionar Foto'}
          </Label>
          <p className="text-xs text-muted-foreground">
            JPG, PNG ou WEBP (máx. 5MB)
          </p>
        </div>
      </div>
    </div>
  );
};
