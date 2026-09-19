import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { ProducaoMembro, ProducaoOrdemProducao } from '@/types/producao';
import { formatarIdentificacaoOrdemProducao } from '@/hooks/useOrdensProducao';

export interface OcupacaoMembroProducao {
  ordemNumero: number;
  atividade: string;
}

interface Props {
  ordem: ProducaoOrdemProducao | null;
  membros: ProducaoMembro[];
  ocupacoes: Record<string, OcupacaoMembroProducao>;
  iniciando: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmar: (membrosIds: string[]) => void;
}

export const ModalIniciarOpComEquipe = ({
  ordem,
  membros,
  ocupacoes,
  iniciando,
  onOpenChange,
  onConfirmar,
}: Props) => {
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    if (!ordem) {
      setSelecionados([]);
      setBusca('');
      return;
    }
    setSelecionados([]);
    setBusca('');
  }, [ordem]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    if (!termo) return membros;
    return membros.filter((membro) =>
      [membro.nome, membro.apelido, membro.funcao]
        .filter(Boolean)
        .some((valor) =>
          String(valor).toLocaleLowerCase('pt-BR').includes(termo),
        ),
    );
  }, [busca, membros]);

  const alternar = (id: string, checked: boolean) => {
    if (ocupacoes[id]) return;
    setSelecionados((atuais) =>
      checked
        ? [...new Set([...atuais, id])]
        : atuais.filter((item) => item !== id),
    );
  };

  return (
    <Dialog open={Boolean(ordem)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Iniciar OP e reservar equipe</DialogTitle>
          <DialogDescription>
            {ordem
              ? `${formatarIdentificacaoOrdemProducao(ordem)} · selecione quem participará desta execução.`
              : 'Selecione a equipe da OP.'}
          </DialogDescription>
        </DialogHeader>

        {ordem && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Equipe prevista</span>
                <strong>{ordem.equipe_prevista ?? '—'} pessoa(s)</strong>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Enquanto este apontamento estiver aberto, os membros selecionados
                ficam indisponíveis para iniciar outra OP.
              </p>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar membro da equipe"
                className="pl-9"
              />
            </div>

            <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {filtrados.map((membro) => {
                const ocupacao = ocupacoes[membro.id];
                const marcado = selecionados.includes(membro.id);
                return (
                  <label
                    key={membro.id}
                    className={
                      ocupacao
                        ? 'flex cursor-not-allowed items-start gap-3 rounded-lg border bg-muted/40 p-3 opacity-70'
                        : 'flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/30'
                    }
                  >
                    <Checkbox
                      checked={marcado}
                      disabled={Boolean(ocupacao) || iniciando}
                      onCheckedChange={(checked) =>
                        alternar(membro.id, checked === true)
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{membro.nome}</span>
                        {membro.apelido && (
                          <span className="text-xs text-muted-foreground">
                            ({membro.apelido})
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {membro.funcao || 'Função não informada'}
                      </p>
                      {ocupacao && (
                        <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                          Indisponível · OP {String(ocupacao.ordemNumero).padStart(5, '0')} · {ocupacao.atividade}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}

              {filtrados.length === 0 && (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nenhum membro encontrado.
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 rounded-lg border bg-muted/10 p-3 text-sm">
              <Users className="h-4 w-4 text-primary" />
              <span>
                <strong>{selecionados.length}</strong> membro(s) selecionado(s)
              </span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={iniciando}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={iniciando || selecionados.length === 0}
            onClick={() => onConfirmar(selecionados)}
          >
            {iniciando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Iniciar OP
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
