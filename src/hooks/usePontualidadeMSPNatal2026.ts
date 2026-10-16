import { useCallback, useState } from 'react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

export type SituacaoPontualidadeMSP =
  | 'antecipado'
  | 'iniciado_no_prazo'
  | 'iniciado_atrasado'
  | 'atrasado_para_iniciar'
  | 'aguardando_inicio';

export interface PontualidadeMSPPeca {
  projetoId: string;
  projetoNome: string;
  cidade: string | null;
  inicioPlanejado: string;
  fimPlanejado: string;
  primeiroApontamento: string | null;
  opsImportadas: number;
  situacao: SituacaoPontualidadeMSP;
  diferencaDias: number;
}

export interface ResumoPontualidadeMSP {
  atualizadoEm: Date | null;
  pecas: PontualidadeMSPPeca[];
  total: number;
  antecipados: number;
  noPrazo: number;
  iniciadosAtrasados: number;
  atrasadosParaIniciar: number;
  aguardandoInicio: number;
}

interface OrdemProducaoGerencial {
  id: string;
  projeto_id: string;
  projeto_nome: string;
  projeto_cidade: string | null;
  instrucoes: string | null;
  status: string;
  data_inicio_prevista: string | null;
  data_fim_prevista: string | null;
}

interface ApontamentoGerencial {
  data: string;
  status: string;
  ordem_producao_id: string | null;
  processo_id: string | null;
}

interface ProcessoGerencial {
  id: string;
  projeto_id: string;
}

const resumoInicial = (): ResumoPontualidadeMSP => ({
  atualizadoEm: null,
  pecas: [],
  total: 0,
  antecipados: 0,
  noPrazo: 0,
  iniciadosAtrasados: 0,
  atrasadosParaIniciar: 0,
  aguardandoInicio: 0,
});

const hojeISO = () => format(new Date(), 'yyyy-MM-dd');

/**
 * Compara o período planejado de cada peça com o primeiro apontamento efetivo.
 * O apontamento pode estar em uma OP anterior e continua valendo na leitura gerencial.
 */
export const usePontualidadeMSPNatal2026 = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumo, setResumo] = useState<ResumoPontualidadeMSP>(resumoInicial);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [ordensResult, apontamentosResult, processosResult] = await Promise.all([
        (supabase.rpc as any)('listar_ordens_producao_v2', {
          p_processo_id: null,
          p_status: null,
        }),
        supabase
          .from('producao_apontamentos')
          .select('data,status,ordem_producao_id,processo_id'),
        supabase
          .from('producao_processos')
          .select('id,projeto_id'),
      ]);

      if (ordensResult.error) throw ordensResult.error;
      if (apontamentosResult.error) throw apontamentosResult.error;
      if (processosResult.error) throw processosResult.error;

      const todasOrdens = (ordensResult.data ?? []) as OrdemProducaoGerencial[];
      const ordensComPrevisao = todasOrdens.filter((ordem) =>
        ordem.status !== 'cancelada' && Boolean(ordem.data_inicio_prevista),
      );
      // Nas pecas reorganizadas, o cronograma operacional vigente corresponde
      // exclusivamente as novas OPs. As OPs historicas permanecem no banco
      // e continuam disponiveis para consultas e auditoria.
      const marcadorReorganizacao = 'NATAL-OP-LISTA-20261016 | ';
      const projetosReorganizados = new Set(
        ordensComPrevisao
          .filter((ordem) => ordem.instrucoes?.startsWith(marcadorReorganizacao))
          .map((ordem) => ordem.projeto_id),
      );
      const ordensCronogramaVigente = ordensComPrevisao.filter((ordem) =>
        !projetosReorganizados.has(ordem.projeto_id)
        || ordem.instrucoes?.startsWith(marcadorReorganizacao),
      );
      const projetosComPrevisao = new Set(ordensCronogramaVigente.map((ordem) => ordem.projeto_id));
      const projetoPorOrdem = new Map(todasOrdens.map((ordem) => [ordem.id, ordem.projeto_id]));
      const projetoPorProcesso = new Map(
        ((processosResult.data ?? []) as ProcessoGerencial[]).map((processo) => [processo.id, processo.projeto_id]),
      );
      const primeiroApontamentoPorProjeto = new Map<string, string>();

      for (const apontamento of (apontamentosResult.data ?? []) as ApontamentoGerencial[]) {
        if (apontamento.status === 'cancelado') continue;
        const projetoId = apontamento.ordem_producao_id
          ? projetoPorOrdem.get(apontamento.ordem_producao_id)
          : apontamento.processo_id
            ? projetoPorProcesso.get(apontamento.processo_id)
            : undefined;
        if (!projetoId || !projetosComPrevisao.has(projetoId)) continue;

        const anterior = primeiroApontamentoPorProjeto.get(projetoId);
        if (!anterior || apontamento.data < anterior) {
          primeiroApontamentoPorProjeto.set(projetoId, apontamento.data);
        }
      }

      const hoje = parseISO(hojeISO());
      const montarPecas = (ordens: OrdemProducaoGerencial[]) => {
        const porProjeto = new Map<string, PontualidadeMSPPeca>();
        for (const ordem of ordens) {
          const existente = porProjeto.get(ordem.projeto_id);
          if (existente) {
            existente.opsImportadas += 1;
            if (ordem.data_inicio_prevista! < existente.inicioPlanejado) {
              existente.inicioPlanejado = ordem.data_inicio_prevista!;
            }
            const fimDaOrdem = ordem.data_fim_prevista && ordem.data_fim_prevista >= ordem.data_inicio_prevista!
              ? ordem.data_fim_prevista
              : ordem.data_inicio_prevista!;
            if (fimDaOrdem > existente.fimPlanejado) {
              existente.fimPlanejado = fimDaOrdem;
            }
            continue;
          }
          porProjeto.set(ordem.projeto_id, {
            projetoId: ordem.projeto_id,
            projetoNome: ordem.projeto_nome,
            cidade: ordem.projeto_cidade,
            inicioPlanejado: ordem.data_inicio_prevista!,
            fimPlanejado: ordem.data_fim_prevista && ordem.data_fim_prevista >= ordem.data_inicio_prevista!
              ? ordem.data_fim_prevista
              : ordem.data_inicio_prevista!,
            primeiroApontamento: null,
            opsImportadas: 1,
            situacao: 'aguardando_inicio',
            diferencaDias: 0,
          });
        }

        return [...porProjeto.values()].map((peca) => {
        const primeiroApontamento = primeiroApontamentoPorProjeto.get(peca.projetoId) ?? null;
        const inicioPlanejado = parseISO(peca.inicioPlanejado);
        const diferenca = primeiroApontamento
          ? differenceInCalendarDays(parseISO(primeiroApontamento), inicioPlanejado)
          : differenceInCalendarDays(hoje, inicioPlanejado);

        if (primeiroApontamento) {
          return {
            ...peca,
            primeiroApontamento,
            diferencaDias: diferenca,
            situacao: diferenca < 0
              ? 'antecipado' as const
              : diferenca > 0
                ? 'iniciado_atrasado' as const
                : 'iniciado_no_prazo' as const,
          };
        }

        return {
          ...peca,
          diferencaDias: Math.max(0, diferenca),
          situacao: diferenca > 0 ? 'atrasado_para_iniciar' as const : 'aguardando_inicio' as const,
        };
        }).sort((a, b) => {
        const prioridade: Record<SituacaoPontualidadeMSP, number> = {
          atrasado_para_iniciar: 0,
          iniciado_atrasado: 1,
          aguardando_inicio: 2,
          antecipado: 3,
          iniciado_no_prazo: 4,
        };
        return prioridade[a.situacao] - prioridade[b.situacao]
          || b.diferencaDias - a.diferencaDias
          || a.projetoNome.localeCompare(b.projetoNome, 'pt-BR');
        });
      };

      const pecas = montarPecas(ordensCronogramaVigente);

      const proximoResumo: ResumoPontualidadeMSP = {
        atualizadoEm: new Date(),
        pecas,
        total: pecas.length,
        antecipados: pecas.filter((peca) => peca.situacao === 'antecipado').length,
        noPrazo: pecas.filter((peca) => peca.situacao === 'iniciado_no_prazo').length,
        iniciadosAtrasados: pecas.filter((peca) => peca.situacao === 'iniciado_atrasado').length,
        atrasadosParaIniciar: pecas.filter((peca) => peca.situacao === 'atrasado_para_iniciar').length,
        aguardandoInicio: pecas.filter((peca) => peca.situacao === 'aguardando_inicio').length,
      };
      setResumo(proximoResumo);
      return proximoResumo;
    } catch (causa) {
      const mensagem = causa instanceof Error
        ? causa.message
        : 'Não foi possível carregar a pontualidade do MS Project.';
      setError(mensagem);
      setResumo(resumoInicial());
      throw causa;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, resumo, carregar };
};
