import { useRef, useState } from 'react';
import { AlertCircle, Download, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ProducaoMembro, ProducaoTarefa } from '@/types/producao';
import {
  baixarModeloImportacaoCadastrosProducao,
  lerCadastrosProducaoExcel,
  normalizarNomeCadastro,
  type MembroProducaoImportacao,
  type ResultadoLeituraCadastrosProducao,
  type TarefaProducaoImportacao,
} from '@/utils/producaoImportCadastros';

interface ImportacaoPreparada extends ResultadoLeituraCadastrosProducao {
  membros_novos: MembroProducaoImportacao[];
  tarefas_novas: TarefaProducaoImportacao[];
  membros_existentes: number;
  tarefas_existentes: number;
}

interface ImportacaoCadastrosProducaoProps {
  membros: ProducaoMembro[];
  tarefas: ProducaoTarefa[];
  criarMembro: (
    nome: string,
    apelido?: string | null,
    funcao?: string | null,
    valorHora?: number | null,
    jornadaDiariaMinutos?: number | null,
  ) => Promise<ProducaoMembro>;
  criarTarefa: (
    nome: string,
    categoria?: string | null,
  ) => Promise<ProducaoTarefa>;
  listarMembros: (somenteAtivos?: boolean) => Promise<ProducaoMembro[]>;
  listarTarefas: (somenteAtivas?: boolean) => Promise<ProducaoTarefa[]>;
}

const mensagemErro = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const ImportacaoCadastrosProducao = ({
  membros,
  tarefas,
  criarMembro,
  criarTarefa,
  listarMembros,
  listarTarefas,
}: ImportacaoCadastrosProducaoProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [lendoPlanilha, setLendoPlanilha] = useState(false);
  const [importando, setImportando] = useState(false);
  const [importacao, setImportacao] = useState<ImportacaoPreparada | null>(null);

  const prepararImportacao = async (arquivo: File) => {
    setLendoPlanilha(true);
    try {
      const resultado = await lerCadastrosProducaoExcel(arquivo);
      const nomesMembrosExistentes = new Set(
        membros.map((membro) => normalizarNomeCadastro(membro.nome)),
      );
      const nomesTarefasExistentes = new Set(
        tarefas.map((tarefa) => normalizarNomeCadastro(tarefa.nome)),
      );
      const membrosNovos = resultado.membros.filter(
        (membro) =>
          !nomesMembrosExistentes.has(normalizarNomeCadastro(membro.nome)),
      );
      const tarefasNovas = resultado.tarefas.filter(
        (tarefa) =>
          !nomesTarefasExistentes.has(normalizarNomeCadastro(tarefa.nome)),
      );

      setImportacao({
        ...resultado,
        membros_novos: membrosNovos,
        tarefas_novas: tarefasNovas,
        membros_existentes: resultado.membros.length - membrosNovos.length,
        tarefas_existentes: resultado.tarefas.length - tarefasNovas.length,
      });
    } catch (error) {
      toast.error(
        mensagemErro(error, 'Não foi possível ler a planilha de cadastros.'),
      );
    } finally {
      setLendoPlanilha(false);
    }
  };

  const importarCadastros = async () => {
    if (!importacao) return;

    setImportando(true);
    let membrosImportados = 0;
    let tarefasImportadas = 0;
    const falhas: string[] = [];

    for (const membro of importacao.membros_novos) {
      try {
        await criarMembro(
          membro.nome,
          membro.apelido,
          membro.funcao,
          membro.valor_hora,
          membro.jornada_diaria_minutos,
        );
        membrosImportados += 1;
      } catch (error) {
        falhas.push(
          `${membro.nome}: ${mensagemErro(error, 'erro ao cadastrar membro')}`,
        );
      }
    }

    for (const tarefa of importacao.tarefas_novas) {
      try {
        await criarTarefa(tarefa.nome, tarefa.categoria);
        tarefasImportadas += 1;
      } catch (error) {
        falhas.push(
          `${tarefa.nome}: ${mensagemErro(error, 'erro ao cadastrar tarefa')}`,
        );
      }
    }

    try {
      await Promise.all([listarMembros(false), listarTarefas(false)]);
    } catch {
      falhas.push('Não foi possível atualizar as listas após a importação.');
    }

    if (membrosImportados + tarefasImportadas > 0) {
      toast.success(
        `${membrosImportados} membro(s) e ${tarefasImportadas} tarefa(s) importados.`,
      );
    }
    if (falhas.length > 0) {
      toast.warning(
        `${falhas.length} cadastro(s) não foram importados. ${falhas
          .slice(0, 2)
          .join(' | ')}`,
      );
    }

    setImportando(false);
    setImportacao(null);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Importação de cadastros</CardTitle>
          <CardDescription>
            Importe somente equipe e tarefas da Produção. A operação não cria
            PCP, solicitações ou movimentos de estoque.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(event) => {
                const arquivo = event.target.files?.[0];
                event.target.value = '';
                if (arquivo) void prepararImportacao(arquivo);
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={baixarModeloImportacaoCadastrosProducao}
            >
              <Download className="mr-2 h-4 w-4" />
              Baixar modelo
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={lendoPlanilha || importando}
              onClick={() => inputRef.current?.click()}
            >
              {lendoPlanilha ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Importar equipe e tarefas
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(importacao)}
        onOpenChange={(aberto) => {
          if (!aberto && !importando) setImportacao(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar membros e tarefas</DialogTitle>
            <DialogDescription>
              Revise a prévia. Somente registros novos e ativos serão criados.
            </DialogDescription>
          </DialogHeader>

          {importacao && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/10 p-3 text-sm">
                <p className="font-medium">{importacao.arquivo_nome}</p>
                <p className="text-muted-foreground">
                  Jornada vazia assume 08:00. Valores e jornadas ficam sujeitos
                  às validações atuais do cadastro da equipe.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Membros novos</p>
                  <p className="text-2xl font-bold">
                    {importacao.membros_novos.length}
                  </p>
                  {importacao.membros_existentes > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {importacao.membros_existentes} já cadastrado(s) serão
                      ignorados
                    </p>
                  )}
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Tarefas novas</p>
                  <p className="text-2xl font-bold">
                    {importacao.tarefas_novas.length}
                  </p>
                  {importacao.tarefas_existentes > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {importacao.tarefas_existentes} já cadastrada(s) serão
                      ignoradas
                    </p>
                  )}
                </div>
              </div>

              {importacao.avisos.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Avisos da planilha</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      {importacao.avisos.slice(0, 6).map((aviso) => (
                        <li key={aviso}>{aviso}</li>
                      ))}
                    </ul>
                    {importacao.avisos.length > 6 && (
                      <p className="mt-2">
                        E mais {importacao.avisos.length - 6} aviso(s).
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {importacao.membros_novos.length === 0 &&
                importacao.tarefas_novas.length === 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Nenhum cadastro novo</AlertTitle>
                    <AlertDescription>
                      Todos os registros válidos da planilha já estão
                      cadastrados.
                    </AlertDescription>
                  </Alert>
                )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={importando}
                  onClick={() => setImportacao(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={
                    importando ||
                    importacao.membros_novos.length +
                      importacao.tarefas_novas.length ===
                      0
                  }
                  onClick={() => void importarCadastros()}
                >
                  {importando && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Confirmar importação
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
