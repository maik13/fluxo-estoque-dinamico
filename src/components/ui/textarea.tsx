import * as React from "react"
import { Mic, MicOff } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"

interface SpeechRecognitionAlternativeLike {
  transcript: string
}

interface SpeechRecognitionResultLike {
  length: number
  [index: number]: SpeechRecognitionAlternativeLike
}

interface SpeechRecognitionEventLike {
  results: {
    length: number
    [index: number]: SpeechRecognitionResultLike
  }
}

interface SpeechRecognitionErrorLike {
  error?: string
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

type BrowserComReconhecimento = Window & {
  SpeechRecognition?: SpeechRecognitionCtor
  webkitSpeechRecognition?: SpeechRecognitionCtor
}

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  ditadoPorVoz?: boolean
}

const obterConstrutor = () => {
  if (typeof window === "undefined") return null
  const navegador = window as BrowserComReconhecimento
  return navegador.SpeechRecognition ?? navegador.webkitSpeechRecognition ?? null
}

const atualizarValorNativo = (
  elemento: HTMLTextAreaElement,
  novoValor: string
) => {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value"
  )?.set

  if (setter) {
    setter.call(elemento, novoValor)
  } else {
    elemento.value = novoValor
  }

  elemento.dispatchEvent(new Event("input", { bubbles: true }))
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ditadoPorVoz = true, disabled, readOnly, ...props }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
    const reconhecimentoRef = React.useRef<SpeechRecognitionLike | null>(null)
    const textoBaseRef = React.useRef("")
    const [suportado, setSuportado] = React.useState(false)
    const [ouvindo, setOuvindo] = React.useState(false)

    const definirRef = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        textareaRef.current = node
        if (typeof ref === "function") {
          ref(node)
        } else if (ref) {
          ;(ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node
        }
      },
      [ref]
    )

    React.useEffect(() => {
      setSuportado(Boolean(obterConstrutor()))
      return () => {
        reconhecimentoRef.current?.abort()
        reconhecimentoRef.current = null
      }
    }, [])

    const pararDitado = () => {
      reconhecimentoRef.current?.stop()
    }

    const iniciarDitado = () => {
      if (ouvindo) {
        pararDitado()
        return
      }

      const elemento = textareaRef.current
      const Reconhecimento = obterConstrutor()

      if (!elemento || !Reconhecimento) {
        toast.error("Ditado por voz não está disponível neste navegador.")
        return
      }

      const reconhecimento = new Reconhecimento()
      reconhecimento.lang = "pt-BR"
      reconhecimento.continuous = true
      reconhecimento.interimResults = true
      textoBaseRef.current = elemento.value.trimEnd()

      reconhecimento.onresult = (event) => {
        let transcricao = ""
        for (let indice = 0; indice < event.results.length; indice += 1) {
          transcricao += `${event.results[indice]?.[0]?.transcript ?? ""} `
        }

        const textoFalado = transcricao.trim()
        const textoBase = textoBaseRef.current
        const novoValor = [textoBase, textoFalado]
          .filter(Boolean)
          .join(textoBase && textoFalado ? " " : "")

        atualizarValorNativo(elemento, novoValor)
      }

      reconhecimento.onerror = (event) => {
        if (event.error === "aborted") return
        if (
          event.error === "not-allowed" ||
          event.error === "service-not-allowed"
        ) {
          toast.error("Permita o acesso ao microfone para usar o ditado por voz.")
        } else if (event.error !== "no-speech") {
          toast.error("Não foi possível transcrever a fala. Tente novamente.")
        }
        setOuvindo(false)
      }

      reconhecimento.onend = () => {
        setOuvindo(false)
        reconhecimentoRef.current = null
      }

      reconhecimentoRef.current = reconhecimento

      try {
        reconhecimento.start()
        setOuvindo(true)
      } catch {
        reconhecimentoRef.current = null
        setOuvindo(false)
        toast.error("Não foi possível iniciar o microfone.")
      }
    }

    const mostrarDitado = ditadoPorVoz && !disabled && !readOnly

    return (
      <div className="w-full space-y-1.5">
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          ref={definirRef}
          disabled={disabled}
          readOnly={readOnly}
          {...props}
        />

        {mostrarDitado && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={iniciarDitado}
              disabled={!suportado}
              aria-pressed={ouvindo}
              className={cn(
                "inline-flex h-8 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
                ouvindo && "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90"
              )}
              title={
                suportado
                  ? ouvindo
                    ? "Parar ditado"
                    : "Ditar texto usando o microfone"
                  : "Ditado por voz indisponível neste navegador"
              }
            >
              {ouvindo ? (
                <MicOff className="h-3.5 w-3.5" />
              ) : (
                <Mic className="h-3.5 w-3.5" />
              )}
              {ouvindo ? "Parar ditado" : "Ditar por voz"}
            </button>
            <span className="text-[11px] text-muted-foreground">
              {ouvindo
                ? "Ouvindo… a transcrição será acrescentada ao texto."
                : suportado
                  ? "O áudio não é salvo; fica somente a transcrição."
                  : "Ditado indisponível neste navegador."}
            </span>
          </div>
        )}
      </div>
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
