import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorLike {
  error?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type BrowserComReconhecimento = Window & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}

const obterConstrutor = () => {
  if (typeof window === 'undefined') return null;
  const navegador = window as BrowserComReconhecimento;
  return navegador.SpeechRecognition ?? navegador.webkitSpeechRecognition ?? null;
};

export const CampoDescricaoComVoz = ({
  value,
  onChange,
  placeholder,
  rows = 4,
  disabled = false,
}: Props) => {
  const [suportado, setSuportado] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const reconhecimentoRef = useRef<SpeechRecognitionLike | null>(null);
  const textoBaseRef = useRef('');

  useEffect(() => {
    setSuportado(Boolean(obterConstrutor()));
    return () => {
      reconhecimentoRef.current?.abort();
      reconhecimentoRef.current = null;
    };
  }, []);

  const parar = () => {
    reconhecimentoRef.current?.stop();
  };

  const iniciar = () => {
    if (ouvindo) {
      parar();
      return;
    }

    const Reconhecimento = obterConstrutor();
    if (!Reconhecimento) {
      toast.error('Ditado por voz não está disponível neste navegador.');
      return;
    }

    const reconhecimento = new Reconhecimento();
    reconhecimento.lang = 'pt-BR';
    reconhecimento.continuous = true;
    reconhecimento.interimResults = true;
    textoBaseRef.current = value.trim();

    reconhecimento.onresult = (event) => {
      let transcricao = '';
      for (let indice = 0; indice < event.results.length; indice += 1) {
        transcricao += `${event.results[indice]?.[0]?.transcript ?? ''} `;
      }
      const textoFalado = transcricao.trim();
      const textoBase = textoBaseRef.current;
      onChange([textoBase, textoFalado].filter(Boolean).join(textoBase && textoFalado ? ' ' : ''));
    };

    reconhecimento.onerror = (event) => {
      if (event.error === 'aborted') return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        toast.error('Permita o acesso ao microfone para usar o ditado por voz.');
      } else if (event.error !== 'no-speech') {
        toast.error('Não foi possível transcrever a fala. Tente novamente.');
      }
      setOuvindo(false);
    };

    reconhecimento.onend = () => {
      setOuvindo(false);
      reconhecimentoRef.current = null;
    };

    reconhecimentoRef.current = reconhecimento;
    try {
      reconhecimento.start();
      setOuvindo(true);
    } catch {
      reconhecimentoRef.current = null;
      setOuvindo(false);
      toast.error('Não foi possível iniciar o microfone.');
    }
  };

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled || ouvindo}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={ouvindo ? 'destructive' : 'outline'}
          onClick={iniciar}
          disabled={disabled || !suportado}
          aria-pressed={ouvindo}
          title={
            suportado
              ? ouvindo
                ? 'Parar ditado'
                : 'Ditar descrição usando o microfone'
              : 'Ditado por voz indisponível neste navegador'
          }
        >
          {ouvindo ? (
            <MicOff className="mr-2 h-4 w-4" />
          ) : (
            <Mic className="mr-2 h-4 w-4" />
          )}
          {ouvindo ? 'Parar ditado' : 'Ditar por voz'}
        </Button>
        <span className="text-xs text-muted-foreground">
          {ouvindo
            ? 'Ouvindo… o texto será inserido na descrição.'
            : suportado
              ? 'O áudio não é salvo pelo sistema; fica somente a transcrição.'
              : 'Use um navegador com reconhecimento de voz para habilitar o microfone.'}
        </span>
      </div>
    </div>
  );
};
