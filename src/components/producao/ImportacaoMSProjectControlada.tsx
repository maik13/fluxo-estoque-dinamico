import { useEffect, useRef, useState } from 'react';
import { AlertCircle, FileJson, Loader2, ShieldCheck, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import {
  calcularHashSha256,
  lerArquivoMSProjectNormalizado,
  type ArquivoMSProjectNormalizado,
} from '@/utils/msprojectImportacao';

type ImportacaoResumo = {
  id: string;
  arquivo_nome: string;
  total_tarefas: number;
  status: string;
  criado_em: string;
};

type ClienteMSProject = {
  from: (tabela: string) => {
    select: (colunas: string) => {
      order: (coluna: string, opcoes: { ascending: boolean }) => {
        limit: (quantidade: number) => Promise<{
          data: ImportacaoResumo[] | null;
          error: Error | null;
        }>;
      };
    };
  };
  rpc: (
    funcao: string,
    parametros: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: Error | null }>;
};

const clienteMSProject = supabase as unknown as ClienteMSProject;

const formatarData = (valor: string | null) =>
  valor ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor)) : 'não definida';

export const ImportacaoMSProjectControlada = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [lendo, setLendo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [arquivoPreparado, setArquivoPreparado] = useState<ArquivoMSProjectNormalizado | null>(null);
  const [hashPreparado, setHashPreparado] = useState<string | null>(null);
  const [historico, setHistorico] = useState<ImportacaoResumo[]>([]);

  const carregarHistorico = async () => {
    const { data, error } = await clienteMSProject.from('producao_msproject_importacoes')
      .select('id,arquivo_nome,total_tarefas,status,criado_em')
      .order('criado_em', { ascending: false })
      .limit(5);
    if (error) throw error;
    setHistorico(data ?? []);
  };

  useEffect(() => {
    void carregarHistorico().catch(() => {
      // A tabela pode ainda não existir enquanto a migration não foi aplicada.
    });
  }, []);

  const preparar = async (arquivo: File) => {
    setLendo(true);
    try {
      const [dados, hash] = await Promise.all([
        lerArquivoMSProjectNormalizado(arquivo),
        calcularHashSha256(arquivo),
      ]);
      setArquivoPreparado(dados);
      setHashPreparado(hash);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível preparar a pré-importação.');
    } finally {
      setLendo(false);
    }
  };

  const confirmarImportacao = async () => {
    if (!arquivoPreparado || !hashPreparado) return;
    setImportando(true);
    try {
      const { data, error } = await clienteMSProject.rpc('registrar_importacao_msproject', {
        p_arquivo_nome: arquivoPreparado.arquivo_nome,
        p_arquivo_hash_sha256: hashPreparado,
        p_versao_origem: arquivoPreparado.versao_origem ?? null,
        p_fuso_horario_origem: arquivoPreparado.fuso_horario_origem ?? 'America/Sao_Paulo',
        p_inicio_planejado_original: arquivoPreparado.inicio_planejado_original,
        p_fim_planejado_original: arquivoPreparado.fim_planejado_original,
        p_tarefas: arquivoPreparado.tarefas,
      });
      if (error) throw error;
      toast.success(`Pré-importação registrada (${arquivoPreparado.tarefas.length} tarefas).`);
      setArquivoPreparado(null);
      setHashPreparado(null);
      await carregarHistorico();
      void data;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível registrar a pré-importação.');
    } finally {
      setImportando(false);
    }
  };

  const semReferenciaOuCidade = arquivoPreparado?.tarefas.filter(
    (tarefa) => !tarefa.referencia_msproject || !tarefa.cidade_msproject,
  ).length ?? 0;

  return (
    <>
      <Card className="border-primary/30">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2"><FileJson className="h-5 w-5 text-primary" /></div>
            <div>
              <CardTitle>Integração controlada — Microsoft Project</CardTitle>
              <CardDescription>
                Registra o plano original do Project para conciliação. Esta etapa não gera OP, não muda datas reais e não movimenta estoque.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>Primeira carga protegida</AlertTitle>
            <AlertDescription>
              O arquivo entra primeiro como proposta auditável por referência e cidade. Somente tarefas aprovadas em uma etapa posterior poderão virar OPs.
            </AlertDescription>
          </Alert>

          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const arquivo = event.target.files?.[0];
              event.target.value = '';
              if (arquivo) void preparar(arquivo);
            }}
          />
          <Button type="button" variant="outline" disabled={lendo || importando} onClick={() => inputRef.current?.click()}>
            {lendo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Selecionar pré-importação do Project
          </Button>
          <p className="text-xs text-muted-foreground">
            Use o arquivo JSON gerado pelo extrator a partir do .MPP original. O sistema valida UID, datas, referência, cidade e dependências antes de gravar.
          </p>

          {historico.length > 0 && (
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium">Últimas pré-importações</p>
              <div className="space-y-2 text-sm">
                {historico.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{item.arquivo_nome} · {item.total_tarefas} tarefas · {formatarData(item.criado_em)}</span>
                    <Badge variant="outline">{item.status.replaceAll('_', ' ')}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(arquivoPreparado)} onOpenChange={(aberto) => !aberto && !importando && setArquivoPreparado(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Revisar pré-importação do Microsoft Project</DialogTitle>
            <DialogDescription>Confira os dados de origem antes de registrar somente o planejamento original.</DialogDescription>
          </DialogHeader>
          {arquivoPreparado && (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="font-medium">{arquivoPreparado.arquivo_nome}</p>
                <p className="text-muted-foreground">Período: {formatarData(arquivoPreparado.inicio_planejado_original)} até {formatarData(arquivoPreparado.fim_planejado_original)}</p>
                <p className="text-muted-foreground">{arquivoPreparado.tarefas.length} tarefas de folha · fuso {arquivoPreparado.fuso_horario_origem}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3"><p className="text-muted-foreground">Com referência e cidade</p><p className="text-2xl font-bold">{arquivoPreparado.tarefas.length - semReferenciaOuCidade}</p></div>
                <div className="rounded-lg border p-3"><p className="text-muted-foreground">Exigem revisão manual</p><p className="text-2xl font-bold">{semReferenciaOuCidade}</p></div>
              </div>
              <Alert variant="default">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  As datas reais e o percentual recebidos do Project serão guardados somente como referência da origem. A execução oficial continua sendo a dos apontamentos existentes no sistema.
                </AlertDescription>
              </Alert>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={importando} onClick={() => setArquivoPreparado(null)}>Cancelar</Button>
            <Button type="button" disabled={importando} onClick={() => void confirmarImportacao()}>
              {importando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Registrar para conciliação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
