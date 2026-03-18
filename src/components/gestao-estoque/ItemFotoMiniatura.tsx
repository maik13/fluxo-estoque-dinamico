import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ItemFotoMiniaturaProps {
  fotoUrl?: string | null;
  nome: string;
  className?: string;
  placeholderClassName?: string;
  disableZoom?: boolean;
}

export const ItemFotoMiniatura = ({
  fotoUrl,
  nome,
  className,
  placeholderClassName,
  disableZoom = false,
}: ItemFotoMiniaturaProps) => {
  const [aberto, setAberto] = useState(false);

  if (!fotoUrl) {
    return (
      <div
        className={cn(
          'h-10 w-10 rounded border border-dashed border-muted-foreground/30 flex items-center justify-center',
          placeholderClassName,
        )}
      >
        <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <>
      <img
        src={fotoUrl}
        alt={nome}
        loading="lazy"
        className={cn(
          'h-10 w-10 object-cover rounded border transition-opacity',
          disableZoom ? 'cursor-default' : 'cursor-pointer hover:opacity-80',
          className,
        )}
        onClick={disableZoom ? undefined : () => setAberto(true)}
      />

      {!disableZoom && (
        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{nome}</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center">
              <img
                src={fotoUrl}
                alt={nome}
                className="max-h-[70vh] w-auto object-contain rounded"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};