import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, RefreshCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
}

const erroCamera = (error: unknown) => {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Permissão de câmera negada. Libere o acesso à câmera nas permissões do navegador e tente novamente.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Nenhuma câmera foi encontrada neste dispositivo.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'A câmera está em uso por outro aplicativo ou não pôde ser acessada.';
  }
  if (name === 'OverconstrainedError') {
    return 'A câmera disponível não atende à configuração solicitada.';
  }
  return 'Não foi possível acessar a câmera deste dispositivo.';
};

export const CameraCaptureDialog = ({ open, onOpenChange, onCapture }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [conectando, setConectando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [cameraPronta, setCameraPronta] = useState(false);

  const desligarCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraPronta(false);
  };

  const conectarCamera = async () => {
    desligarCamera();
    setErro(null);
    setConectando(true);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('CAMERA_API_INDISPONIVEL');
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch (primeiroErro) {
        const name = primeiroErro instanceof DOMException ? primeiroErro.name : '';
        if (name === 'OverconstrainedError' || name === 'NotFoundError') {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } else {
          throw primeiroErro;
        }
      }

      streamRef.current = stream;
      if (!videoRef.current) {
        desligarCamera();
        throw new Error('VIDEO_NAO_DISPONIVEL');
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraPronta(true);
    } catch (error) {
      setErro(
        error instanceof Error && error.message === 'CAMERA_API_INDISPONIVEL'
          ? 'Este navegador não disponibiliza acesso direto à câmera. Use um navegador atualizado e conexão HTTPS.'
          : erroCamera(error),
      );
      setCameraPronta(false);
    } finally {
      setConectando(false);
    }
  };

  useEffect(() => {
    if (open) {
      void conectarCamera();
    } else {
      desligarCamera();
      setErro(null);
    }

    return () => desligarCamera();
  }, [open]);

  const capturar = async () => {
    const video = videoRef.current;
    if (!video || !cameraPronta || !video.videoWidth || !video.videoHeight) {
      toast.error('A câmera ainda não está pronta para capturar.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const contexto = canvas.getContext('2d');
    if (!contexto) {
      toast.error('Não foi possível preparar a captura da foto.');
      return;
    }

    contexto.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.9);
    });

    if (!blob) {
      toast.error('Não foi possível gerar a foto capturada.');
      return;
    }

    const file = new File(
      [blob],
      `camera-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`,
      { type: 'image/jpeg', lastModified: Date.now() },
    );

    onCapture(file);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-hidden p-0">
        <div className="p-5">
          <DialogHeader>
            <DialogTitle>Capturar foto pela câmera</DialogTitle>
            <DialogDescription>
              O sistema solicita conexão direta com a câmera do dispositivo. No celular ou tablet, tenta usar a câmera traseira.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="relative bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="aspect-video w-full bg-black object-contain"
          />

          {conectando && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-white">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Conectando à câmera...</p>
            </div>
          )}

          {erro && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 p-6 text-center text-white">
              <Camera className="h-10 w-10 opacity-70" />
              <p className="max-w-md text-sm">{erro}</p>
              <Button type="button" variant="secondary" onClick={() => void conectarCamera()}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Tentar novamente
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" />
            Fechar
          </Button>
          <Button type="button" onClick={() => void capturar()} disabled={!cameraPronta || conectando || Boolean(erro)}>
            <Camera className="mr-2 h-4 w-4" />
            Capturar foto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
