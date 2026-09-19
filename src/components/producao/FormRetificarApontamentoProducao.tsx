import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Camera, Loader2, RotateCcw, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useProducaoAnexos } from '@/hooks/useProducaoAnexos';
import { ordemProducaoEDePintura } from '@/hooks/useOrdensProducao';
import { supabase } from '@/integrations/supabase/client';
import type {
  ProducaoApontamento,
  ProducaoApontamentoAnexo,
  ProducaoApontamentoMembro,
  ProducaoMembro,
  ProducaoOrdemProducao,
} from '@/types/producao';
import { formatarErroSupabase } from '@/utils/supabaseError';

interface Props {
  apontamento: ProducaoApontamento | null;
  ordem: ProducaoOrdemProducao | null;
  tarefaNome: string;
  membrosDisponiveis: ProducaoMembro[];
  membrosAtuais: ProducaoApontamentoMembro[];
  onClose: () => void;
  onSuccess: () => Promise<unknown> | unknown;
}

type HorarioPersonalizado = {
  ativo: boolean;
  inicio: string;
  termino: string;
};

type ConsumoTintaForm = { cor: string; quantidadeMl: string };
const consumoTintaVazio = (): ConsumoTintaForm => ({ cor: '', quantidadeMl: '' });

const normalizarHora = (valor: string | null | undefined) =>
  valor ? valor.slice(0, 5) : '';

const numero = (valor: string) => {
  const limpo = valor.trim();
  if (!limpo) return null;
  return Number(limpo.replace(',', '.'));
};

const minutosDoHorario = (valor: string) => {
  const [h, m] = valor.split(':').map(Number);
  return h * 60 + m;
};

const formatarNumero = (valor: number | null) =>
  valor == null
    ? '—'
    : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(valor);

export const FormRetificarApontamentoProducao = ({
  apontamento,
  ordem,
  tarefaNome,
  membrosDisponiveis,
  membrosAtuais,
  onClose,
  onSuccess,
}: Props) => {
  const [data, setData] = useState('');
  const [inicio, setInicio] = useState('');
  const [termino, setTermino] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [minutosImprodutivos, setMinutosImprodutivos] = useState('0');
  const [motivoImprodutivo, setMotivoImprodutivo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [motivoRetificacao, setMotivoRetificacao] = useState('');
  const [consumosTinta, setConsumosTinta] = useState<ConsumoTintaForm[]>([
    consumoTintaVazio(),
  ]);
  const [membrosIds, setMembrosIds] = useState<string[]>([]);
  const [horarios, setHorarios] = useState<Record<string, HorarioPersonalizado>>({});
  const [anexosAtuais, setAnexosAtuais] = useState<ProducaoApontamentoAnexo[]>([]);
  const [anexosRemover, setAnexosRemover] = useState<string[]>([]);
  const [novasFotos, setNovasFotos] = useState<File[]>([]);
  const [salvando, setSalvando] = useState(false);
  const inputFotosRef = useRef<HTMLInputElement>(null);
  const { listarAnexos, anexarImagem, removerAnexo } = useProducaoAnexos();

  useEffect(() => {
    if (!apontamento) return;
    setData(apontamento.data);
    setInicio(normalizarHora(apontamento.inicio));
    setTermino(normalizarHora(apontamento.termino));
    setQuantidade(
      apontamento.quantidade_produzida == null
        ? ''
        : String(apontamento.quantidade_produzida).replace('.', ','),
    );
    setMinutosImprodutivos(String(apontamento.minutos_improdutivos ?? 0));
    setMotivoImprodutivo(apontamento.motivo_improdutivo ?? '');
    setObservacoes(apontamento.observacoes ?? '');
    setMotivoRetificacao('');
    setConsumosTinta([consumoTintaVazio()]);
    setMembrosIds(membrosAtuais.map((membro) => membro.membro_id));
    setHorarios(
      Object.fromEntries(
        membrosAtuais.map((membro) => [
          membro.membro_id,
          {
            ativo: Boolean(membro.inicio_individual && membro.termino_individual),
            inicio: normalizarHora(membro.inicio_individual),
            termino: normalizarHora(membro.termino_individual),
          },
        ]),
      ),
    );
    setAnexosRemover([]);
    setNovasFotos([]);
    void listarAnexos(apontamento.id)
      .then(setAnexosAtuais)
      .catch(() => setAnexosAtuais([]));
  }, [apontamento, listarAnexos, membrosAtuais]);

  const opEncerrada = Boolean(
    ordem && ['concluida', 'cancelada'].includes(ordem.status),
  );
  const opDePintura = ordemProducaoEDePintura(ordem);

  const opcoesMembros = useMemo(() => {
    const mapa = new Map<string, { id: string; nome: string; ativo: boolean }>();
    membrosDisponiveis.forEach((membro) => {
      mapa.set(membro.id, { id: membro.id, nome: membro.nome, ativo: membro.ativo });
    });
    membrosAtuais.forEach((membro) => {
      if (!mapa.has(membro.membro_id)) {
        mapa.set(membro.membro_id, {
          id: membro.membro_id,
          nome: membro.nome_snapshot,
          ativo: false,
        });
      }
    });
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  }, [membrosAtuais, membrosDisponiveis]);

  const alternarMembro = (id: string, marcado: boolean) => {
    setMembrosIds((atuais) =>
      marcado
        ? [...new Set([...atuais, id])]
        : atuais.filter((membroId) => membroId !== id),
    );
    if (!marcado) {
      setHorarios((atuais) => {
        const proximo = { ...atuais };
        delete proximo[id];
        return proximo;
      });
    }
  };

  const alterarHorario = (
    membroId: string,
    patch: Partial<HorarioPersonalizado>,
  ) => {
    setHorarios((atuais) => ({
      ...atuais,
      [membroId]: {
        ativo: false,
        inicio: '',
        termino: '',
        ...(atuais[membroId] ?? {}),
        ...patch,
      },
    }));
  };

  const selecionarFotos = (arquivos: FileList | null) => {
    if (!arquivos) return;
    const validas = [...arquivos].filter((arquivo) => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type)) {
        toast.error(`${arquivo.name}: use JPEG, PNG ou WebP.`);
        return false;
      }
      if (arquivo.size > 10 * 1024 * 1024) {
        toast.error(`${arquivo.name}: a imagem deve ter no máximo 10 MB.`);
        return false;
      }
      return true;
    });
    setNovasFotos((atuais) => [...atuais, ...validas]);
  };

  const salvar = async (event: FormEvent) => {
    event.preventDefault();
    if (!apontamento) return;

    if (opEncerrada) {
      toast.error('Reabra a OP antes de retificar este apontamento.');
      return;
    }
    if (!data || !inicio || !termino) {
      toast.error('Informe data, início e término.');
      return;
    }
    if (minutosDoHorario(termino) <= minutosDoHorario(inicio)) {
      toast.error('O término deve ser posterior ao início.');
      return;
    }
    if (membrosIds.length === 0) {
      toast.error('Informe pelo menos um membro da equipe.');
      return;
    }
    if (!motivoRetificacao.trim()) {
      toast.error('Informe o motivo da retificação.');
      return;
    }

    const quantidadeNormalizada = numero(quantidade);
    if (quantidadeNormalizada != null && (!Number.isFinite(quantidadeNormalizada) || quantidadeNormalizada < 0)) {
      toast.error('Quantidade produzida inválida.');
      return;
    }

    const consumosTintaNormalizados: Array<{
      cor: string | null;
      quantidade_ml: number;
    }> = [];

    if (opDePintura) {
      for (const consumo of consumosTinta) {
        const cor = consumo.cor.trim();
        const quantidadeTexto = consumo.quantidadeMl.trim();
        if (!cor && !quantidadeTexto) continue;

        const quantidadeMl = Number(quantidadeTexto.replace(',', '.'));
        if (!Number.isFinite(quantidadeMl) || quantidadeMl <= 0) {
          toast.error('Informe um consumo de tinta maior que zero em mL.');
          return;
        }

        consumosTintaNormalizados.push({
          cor: cor || null,
          quantidade_ml: quantidadeMl,
        });
      }
    }

    const improdutivos = Number(minutosImprodutivos || 0);
    if (!Number.isInteger(improdutivos) || improdutivos < 0) {
      toast.error('Minutos improdutivos inválidos.');
      return;
    }
    if (improdutivos > 0 && !motivoImprodutivo.trim()) {
      toast.error('Informe o motivo do tempo improdutivo.');
      return;
    }

    const horariosPersonalizados = membrosIds.flatMap((membroId) => {
      const item = horarios[membroId];
      if (!item?.ativo) return [];
      if (!item.inicio || !item.termino) {
        throw new Error('Preencha início e término do horário individual selecionado.');
      }
      if (minutosDoHorario(item.termino) <= minutosDoHorario(item.inicio)) {
        throw new Error('O término individual deve ser posterior ao início.');
      }
      if (
        minutosDoHorario(item.inicio) < minutosDoHorario(inicio) ||
        minutosDoHorario(item.termino) > minutosDoHorario(termino)
      ) {
        throw new Error('O horário individual deve ficar dentro do período geral do apontamento.');
      }
      return [{ membro_id: membroId, inicio: item.inicio, termino: item.termino }];
    });

    setSalvando(true);
    try {
      const { data: resultado, error } = await (supabase.rpc as any)(
        'retificar_apontamento_producao_com_consumos_tinta_v1',
        {
          p_apontamento_id: apontamento.id,
          p_data: data,
          p_quantidade_produzida: quantidadeNormalizada,
          p_inicio: inicio,
          p_termino: termino,
          p_minutos_improdutivos: improdutivos,
          p_motivo_improdutivo: improdutivos > 0 ? motivoImprodutivo.trim() : null,
          p_observacoes: observacoes.trim() || null,
          p_membros: membrosIds,
          p_horarios_membros: horariosPersonalizados,
          p_motivo_retificacao: motivoRetificacao.trim(),
          p_consumos_tinta: consumosTintaNormalizados,
        },
      );
      if (error) {
        throw new Error(
          formatarErroSupabase(error, 'Não foi possível retificar o apontamento.'),
        );
      }

      for (const anexoId of anexosRemover) {
        await removerAnexo(anexoId);
      }
      for (const foto of novasFotos) {
        await anexarImagem(apontamento.id, foto);
      }

      await onSuccess();
      onClose();
      const precisaReconferir = Boolean((resultado as any)?.reconferencia_obrigatoria);
      toast.success(
        precisaReconferir
          ? 'Apontamento retificado. Ele voltou para Pendente e precisa ser conferido novamente.'
          : 'Apontamento retificado e auditoria registrada.',
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível retificar o apontamento.',
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={Boolean(apontamento)} onOpenChange={(open) => !open && !salvando && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Retificar apontamento</DialogTitle>
          <DialogDescription>
            Corrija somente este registro histórico. A OP continua sendo a mesma e os demais apontamentos não são alterados.
          </DialogDescription>
        </DialogHeader>

        {apontamento && (
          <form onSubmit={salvar} className="space-y-5">
            <div className="rounded-lg border bg-muted/20 p-4 text-sm">
              <p><strong>OP:</strong> {ordem ? `OP ${String(ordem.numero).padStart(6, '0')} — ${ordem.tarefa_nome_snapshot ?? tarefaNome}` : 'Apontamento avulso'}</p>
              <p><strong>Atividade:</strong> {tarefaNome}</p>
              <p><strong>Status atual:</strong> {apontamento.status === 'conferido' ? 'Conferido' : 'Pendente'}</p>
              <p><strong>Quantidade atual:</strong> {formatarNumero(apontamento.quantidade_produzida == null ? null : Number(apontamento.quantidade_produzida))}</p>
            </div>

            {apontamento.status === 'conferido' && (
              <Alert className="border-amber-500/40 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription>
                  Este apontamento já foi conferido. Ao salvar uma retificação ele voltará para <strong>Pendente</strong> e deverá ser conferido novamente. Até a nova conferência, sua quantidade sai temporariamente do total confirmado da OP.
                </AlertDescription>
              </Alert>
            )}

            {opEncerrada && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Esta OP está {ordem?.status === 'concluida' ? 'concluída' : 'cancelada'}. Reabra a OP antes de retificar o apontamento para não deixar o histórico e o progresso inconsistentes.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Início *</Label>
                <Input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Término *</Label>
                <Input type="time" value={termino} onChange={(e) => setTermino(e.target.value)} required />
              </div>
            </div>

            {opDePintura && (
              <div className="space-y-4 rounded-lg border-2 border-lime-400 bg-lime-300/10 p-4 shadow-lg shadow-lime-400/20">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Label className="text-base font-bold">Consumo de tinta</Label>
                    <span className="rounded-full bg-lime-400 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-black">
                      OP de pintura
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Use este campo para regularizar ou acrescentar consumo de tinta deste apontamento.
                    Os novos valores são adicionados ao histórico; consumos anteriores não são apagados.
                  </p>
                </div>

                <div className="space-y-3">
                  {consumosTinta.map((consumo, indice) => (
                    <div
                      key={indice}
                      className="grid gap-3 rounded-md border border-lime-400/50 bg-background/70 p-3 sm:grid-cols-[1fr_180px_auto] sm:items-end"
                    >
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tinta / cor</Label>
                        <Input
                          value={consumo.cor}
                          onChange={(event) =>
                            setConsumosTinta((atuais) =>
                              atuais.map((item, i) =>
                                i === indice ? { ...item, cor: event.target.value } : item,
                              ),
                            )
                          }
                          placeholder="Ex.: Verniz / Stain"
                          maxLength={120}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Quantidade (mL)</Label>
                        <Input
                          inputMode="decimal"
                          value={consumo.quantidadeMl}
                          onChange={(event) =>
                            setConsumosTinta((atuais) =>
                              atuais.map((item, i) =>
                                i === indice
                                  ? { ...item, quantidadeMl: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="350"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Remover consumo"
                        disabled={consumosTinta.length === 1}
                        onClick={() =>
                          setConsumosTinta((atuais) =>
                            atuais.filter((_, i) => i !== indice),
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setConsumosTinta((atuais) => [...atuais, consumoTintaVazio()])
                  }
                >
                  + Adicionar outro consumo
                </Button>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Quantidade produzida</Label>
                <Input inputMode="decimal" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Minutos improdutivos</Label>
                <Input type="number" min="0" step="1" value={minutosImprodutivos} onChange={(e) => setMinutosImprodutivos(e.target.value)} />
              </div>
            </div>

            {Number(minutosImprodutivos || 0) > 0 && (
              <div className="space-y-2">
                <Label>Motivo do tempo improdutivo *</Label>
                <Input value={motivoImprodutivo} onChange={(e) => setMotivoImprodutivo(e.target.value)} />
              </div>
            )}

            <div className="space-y-3">
              <div>
                <Label>Equipe deste apontamento *</Label>
                <p className="text-xs text-muted-foreground">A alteração vale somente para este apontamento histórico.</p>
              </div>
              <div className="space-y-2 rounded-lg border p-3">
                {opcoesMembros.map((membro) => {
                  const marcado = membrosIds.includes(membro.id);
                  const horario = horarios[membro.id];
                  return (
                    <div key={membro.id} className="rounded-md border p-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={marcado}
                          onCheckedChange={(checked) => alternarMembro(membro.id, checked === true)}
                        />
                        <span className="font-medium">{membro.nome}</span>
                        {!membro.ativo && <span className="text-xs text-muted-foreground">(cadastro inativo)</span>}
                      </div>
                      {marcado && (
                        <div className="mt-3 space-y-2 pl-6">
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={Boolean(horario?.ativo)}
                              onCheckedChange={(checked) =>
                                alterarHorario(membro.id, {
                                  ativo: checked === true,
                                  inicio: checked === true ? horario?.inicio || inicio : '',
                                  termino: checked === true ? horario?.termino || termino : '',
                                })
                              }
                            />
                            Usar horário individual para este membro
                          </label>
                          {horario?.ativo && (
                            <div className="grid gap-2 sm:grid-cols-2">
                              <Input type="time" value={horario.inicio} onChange={(e) => alterarHorario(membro.id, { inicio: e.target.value })} />
                              <Input type="time" value={horario.termino} onChange={(e) => alterarHorario(membro.id, { termino: e.target.value })} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label>Fotos do apontamento</Label>
                  <p className="text-xs text-muted-foreground">Você pode manter, remover ou acrescentar evidências deste registro.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => inputFotosRef.current?.click()}>
                  <Camera className="mr-2 h-4 w-4" /> Adicionar fotos
                </Button>
                <input
                  ref={inputFotosRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    selecionarFotos(e.target.files);
                    e.currentTarget.value = '';
                  }}
                />
              </div>

              {(anexosAtuais.length > 0 || novasFotos.length > 0) && (
                <div className="space-y-2 rounded-lg border p-3">
                  {anexosAtuais.map((anexo) => {
                    const remover = anexosRemover.includes(anexo.id);
                    return (
                      <div key={anexo.id} className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm ${remover ? 'bg-destructive/5 text-muted-foreground line-through' : ''}`}>
                        <span className="truncate">{anexo.file_name}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title={remover ? 'Manter foto' : 'Remover foto ao salvar'}
                          onClick={() => setAnexosRemover((atuais) => remover ? atuais.filter((id) => id !== anexo.id) : [...atuais, anexo.id])}
                        >
                          {remover ? <RotateCcw className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    );
                  })}
                  {novasFotos.map((foto, index) => (
                    <div key={`${foto.name}-${index}`} className="flex items-center justify-between gap-2 rounded-md bg-primary/5 px-2 py-1.5 text-sm">
                      <span className="truncate"><Upload className="mr-1 inline h-3.5 w-3.5" />{foto.name}</span>
                      <Button type="button" size="icon" variant="ghost" onClick={() => setNovasFotos((atuais) => atuais.filter((_, i) => i !== index))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <Label>Motivo da retificação *</Label>
              <Textarea
                value={motivoRetificacao}
                onChange={(e) => setMotivoRetificacao(e.target.value)}
                placeholder="Ex.: quantidade corrigida após conferência física; horário informado incorretamente no dia anterior."
                rows={3}
                required
              />
              <p className="text-xs text-muted-foreground">O sistema preserva os valores anteriores, quem alterou, quando e esta justificativa.</p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" disabled={salvando} onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={salvando || opEncerrada || !motivoRetificacao.trim()}>
                {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar retificação
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
