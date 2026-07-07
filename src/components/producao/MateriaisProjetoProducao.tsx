import { useMemo, useState } from 'react';
import {
  FileDown,
  Link2,
  Loader2,
  PackageSearch,
  Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import type { LocalUtilizacaoConfig } from '@/hooks/useConfiguracoes';
import {
  type MovimentoOficialProducao,
  useProducaoMateriais,
} from '@/hooks/useProducaoMateriais';
import type { Json } from '@/integrations/supabase/types';
import {
  exportarMateriaisProducaoExcel,
  imprimirSecaoProducao,
} from '@/utils/producaoExport';

interface MateriaisProjetoProducaoProps {
  locais: LocalUtilizacaoConfig[];
  podeRegistrar: boolean;
}

const snapshotComoObjeto = (snapshot: Json) => {
  if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
    return snapshot as Record<string, Json | undefined>;
  }
  return {};
};

export const MateriaisProjetoProducao = ({
  locais,
  podeRegistrar,
}: MateriaisProjetoProducaoProps) => {
  const {
    movimentacoes,
    materiaisVinculados,
    loading,
    listarMovimentacoesPorProjeto,
    listarMateriaisVinculados,
    criarVinculoMaterial,
  } = useProducaoMateriais();
  const [projetoId, setProjetoId] = useState('');
  const [movimentacaoSelecionada, setMovimentacaoSelecionada] =
    useState<MovimentoOficialProducao | null>(null);
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);

  const movementIdsVinculados = useMemo(
    () => new Set(materiaisVinculados.map((item) => item.movement_id)),
    [materiaisVinculados],
  );
  const projetoNome =
    locais.find((local) => local.id === projetoId)?.nome ?? projetoId;
  const materiaisParaExportar = useMemo(
    () =>
      materiaisVinculados.map((material) => ({
        ...material,
        projeto_nome:
          locais.find((local) => local.id === material.projeto_local_id)?.nome ??
          material.projeto_local_id,
      })),
    [locais, materiaisVinculados],
  );

  const carregarProjeto = async (novoProjetoId: string) => {
    setProjetoId(novoProjetoId);
    try {
      await Promise.all([
        listarMovimentacoesPorProjeto(novoProjetoId),
        listarMateriaisVinculados(novoProjetoId),
      ]);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar os materiais do projeto.',
      );
    }
  };

  const registrarVinculo = async () => {
    if (!movimentacaoSelecionada || !projetoId || !podeRegistrar) return;

    setSalvando(true);
    try {
      await criarVinculoMaterial({
        movement_id: movimentacaoSelecionada.id,
        projeto_local_id: projetoId,
        observacoes_producao: observacao,
      });
      toast.success('Movimentação registrada como referência da Produção.');
      setMovimentacaoSelecionada(null);
      setObservacao('');
      await listarMateriaisVinculados(projetoId);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível criar o vínculo.',
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card id="materiais-producao-impressao">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Materiais do Projeto</CardTitle>
          <CardDescription>
            Consulte movimentações oficiais e registre apenas uma referência
            operacional na Produção.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button
            type="button"
            variant="outline"
            disabled={materiaisParaExportar.length === 0}
            onClick={() =>
              exportarMateriaisProducaoExcel(
                materiaisParaExportar,
                projetoId ? `Projeto/local: ${projetoNome}` : 'Sem filtros',
              )
            }
          >
            <FileDown className="mr-2 h-4 w-4" />
            Exportar Excel
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={materiaisParaExportar.length === 0}
            onClick={() =>
              imprimirSecaoProducao('materiais-producao-impressao')
            }
          >
            <Printer className="mr-2 h-4 w-4" />
            Imprimir / PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="max-w-xl space-y-2 print:hidden">
          <Label>Projeto/local</Label>
          <Select value={projetoId} onValueChange={(valor) => void carregarProjeto(valor)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o projeto" />
            </SelectTrigger>
            <SelectContent>
              {locais.filter((local) => local.ativo).map((local) => (
                <SelectItem key={local.id} value={local.id}>
                  {local.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!projetoId ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground print:hidden">
            <PackageSearch className="mx-auto mb-3 h-8 w-8" />
            Selecione um projeto para visualizar suas movimentações oficiais.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border print:hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Observação</TableHead>
                  <TableHead>Solicitação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-28 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : movimentacoes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-28 text-center text-muted-foreground">
                      Nenhuma movimentação oficial encontrada para este projeto.
                    </TableCell>
                  </TableRow>
                ) : (
                  movimentacoes.map((movimentacao) => {
                    const snapshot = snapshotComoObjeto(movimentacao.item_snapshot);
                    const vinculado = movementIdsVinculados.has(movimentacao.id);
                    const nomeItem =
                      String(snapshot.nome ?? snapshot.name ?? movimentacao.item_id);
                    const unidade = String(snapshot.unidade ?? snapshot.unit ?? '—');

                    return (
                      <TableRow key={movimentacao.id}>
                        <TableCell>{new Date(movimentacao.data_hora).toLocaleString('pt-BR')}</TableCell>
                        <TableCell>{movimentacao.tipo}</TableCell>
                        <TableCell>{nomeItem}</TableCell>
                        <TableCell>{movimentacao.quantidade}</TableCell>
                        <TableCell>{unidade}</TableCell>
                        <TableCell className="max-w-64 truncate">{movimentacao.observacoes || '—'}</TableCell>
                        <TableCell>{movimentacao.solicitacao_id || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={vinculado
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                            : 'border-muted-foreground/30 text-muted-foreground'}
                          >
                            {vinculado ? 'Já registrado' : 'Não registrado'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {podeRegistrar && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={vinculado}
                              onClick={() => setMovimentacaoSelecionada(movimentacao)}
                            >
                              <Link2 className="mr-2 h-4 w-4" />
                              Registrar na Produção
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="producao-print-only space-y-3">
          <div className="text-sm">
            <p>Gerado em: {new Date().toLocaleString('pt-BR')}</p>
            <p>
              Filtros aplicados:{' '}
              {projetoId ? `Projeto/local: ${projetoNome}` : 'Sem filtros'}
            </p>
            <p>
              Materiais exibidos aqui são referências a movimentações oficiais
              já existentes.
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projeto/local</TableHead>
                <TableHead>Movimento oficial</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead>Data do vínculo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materiaisParaExportar.map((material) => {
                const snapshot = snapshotComoObjeto(material.item_snapshot);
                return (
                  <TableRow key={material.id}>
                    <TableCell>{material.projeto_nome}</TableCell>
                    <TableCell>{material.movement_id}</TableCell>
                    <TableCell>{material.tipo}</TableCell>
                    <TableCell>
                      {String(
                        snapshot.nome ?? snapshot.name ?? material.item_id,
                      )}
                    </TableCell>
                    <TableCell>{material.quantidade}</TableCell>
                    <TableCell>
                      {material.observacoes_producao ?? '—'}
                    </TableCell>
                    <TableCell>
                      {new Date(material.created_at).toLocaleString('pt-BR')}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog
        open={Boolean(movimentacaoSelecionada)}
        onOpenChange={(aberto) => {
          if (!aberto) {
            setMovimentacaoSelecionada(null);
            setObservacao('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar referência na Produção</DialogTitle>
            <DialogDescription>
              A movimentação original e o saldo do estoque não serão alterados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="observacao-producao">Observação interna</Label>
            <Textarea
              id="observacao-producao"
              value={observacao}
              onChange={(event) => setObservacao(event.target.value)}
              placeholder="Opcional"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovimentacaoSelecionada(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void registrarVinculo()} disabled={salvando}>
              {salvando ? 'Registrando...' : 'Registrar vínculo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
