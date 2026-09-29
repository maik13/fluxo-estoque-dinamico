import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  titulo?: string;
}

interface State {
  erro: Error | null;
}

export class SecaoProducaoSegura extends Component<Props, State> {
  state: State = { erro: null };

  static getDerivedStateFromError(erro: Error): State {
    return { erro };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error('[Produção] Falha isolada em seção:', erro, info.componentStack);
  }

  render() {
    if (this.state.erro) {
      return (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="font-semibold text-destructive">
                {this.props.titulo ?? 'Esta seção não pôde ser carregada'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                O restante do projeto continua disponível. Atualize esta seção após a correção dos dados.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
