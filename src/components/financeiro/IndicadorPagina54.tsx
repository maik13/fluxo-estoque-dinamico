import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface DadosOrigemPagina54 {
  origem_tipo?: unknown;
  pagina54_integracao_id?: unknown;
  planilha_linha?: unknown;
  pagina54_sync_status?: unknown;
  pagina54_sync_erro?: unknown;
  origem_planilha?: unknown;
}

const preenchido = (valor: unknown) => valor !== null && valor !== undefined && String(valor).trim() !== '';

export const temOrigemPagina54 = (dados?: DadosOrigemPagina54 | null) => Boolean(
  dados && (
    dados.origem_tipo === 'pagina54'
    || preenchido(dados.pagina54_integracao_id)
    || preenchido(dados.planilha_linha)
    || preenchido(dados.pagina54_sync_status)
    || dados.origem_planilha === true
  )
);

const detalhesOrigem = (dados?: DadosOrigemPagina54 | null) => {
  const detalhes = ['Origem: planilha histórica Página54'];
  if (preenchido(dados?.planilha_linha)) detalhes.push(`Linha: ${String(dados?.planilha_linha)}`);
  if (preenchido(dados?.pagina54_integracao_id)) detalhes.push(`ID da integração: ${String(dados?.pagina54_integracao_id)}`);
  if (preenchido(dados?.pagina54_sync_status)) detalhes.push(`Status da sincronização: ${String(dados?.pagina54_sync_status)}`);
  if (preenchido(dados?.pagina54_sync_erro)) detalhes.push(`Erro da sincronização: ${String(dados?.pagina54_sync_erro)}`);
  return detalhes.join('\n');
};

interface IndicadorPagina54Props {
  dados?: DadosOrigemPagina54 | null;
  forcarExibicao?: boolean;
  className?: string;
}

export const IndicadorPagina54 = ({ dados, forcarExibicao = false, className }: IndicadorPagina54Props) => {
  if (!forcarExibicao && !temOrigemPagina54(dados)) return null;

  const detalhes = detalhesOrigem(dados);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          title={detalhes}
          aria-label={detalhes.replaceAll('\n', '. ')}
          className={`inline-flex shrink-0 items-center gap-1 border-warning/50 bg-warning/10 text-warning ${className ?? ''}`}
        >
          <AlertTriangle className="h-3.5 w-3.5 fill-warning/20" aria-hidden="true" />
          Página54
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm whitespace-pre-line">{detalhes}</TooltipContent>
    </Tooltip>
  );
};