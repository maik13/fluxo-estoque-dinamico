import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ClipboardPlus,
  Download,
  FileDown,
  Loader2,
  Pencil,
  Plus,
  Upload,
  UserRoundPlus,
  UserX,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type {
  NovoMembroProducao,
  ProducaoMembro,
  ProducaoTarefa,
} from '@/types/producao';
import { exportarCadastrosProducaoExcel } from '@/utils/producaoExport';
import {
  baixarModeloImportacaoCadastrosProducao,
  lerCadastrosProducaoExcel,
  normalizarNomeCadastro,
  parseValorHoraProducao,
  type MembroProducaoImportacao,
  type ResultadoLeituraCadastrosProducao,
  type TarefaProducaoImportacao,
} from '@/utils/producaoImport';

interface ConfiguracoesProducaoProps {
  membros: ProducaoMembro[];
  tarefas: ProducaoTarefa[];
  listarMembros: (somenteAtivos?: boolean) => Promise<ProducaoMembro[]>;
  criarMembro: (
    nome: string,
    apelido?: string | null,
    funcao?: string | null,
    valorHora?: number | null,
  ) => Promise<ProducaoMembro>;
  editarMembro: (
    id: string,
    dados: Partial<NovoMembroProducao>,
  ) => Promise<ProducaoMembro>;
  inativarMembro: (id: string) => Promise<ProducaoMembro>;
  listarTarefas: (somenteAtivas?: boolean) => Promise<ProducaoTarefa[]>;
  criarTarefa: (
    nome: string,
    categoria?: string | null,
  ) => Promise<ProducaoTarefa>;
}

const mensagemErro = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const formatarMoedaHora = (valor: number | null | undefined) =>
  valor === null || valor === undefined
    ? 'Valor/hora não informado'
    : `${valor.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })}/h`;

interface ImportacaoPreparada extends ResultadoLeituraCadastrosProducao {
  membros_novos: MembroProducaoImportacao[];
  tarefas_novas: TarefaProducaoImportacao[];
  membros_existentes: number;
  tarefas_existentes: number;
}

export const ConfiguracoesProducao = ({
  membros,
  tarefas,
  listarMembros,
  criarMembro,
  editarMembro,
  inativarMembro,
  listarTarefas,
  criarTarefa,
}: ConfiguracoesProducaoProps) => {
  const [nomeMembro, setNomeMembro] = useState('');
  const [apelidoMembro, setApelidoMembro] = useState('');
  const [funcaoMembro, setFuncaoMembro] = useState('');
  const [valorHoraMembro, setValorHoraMembro] = useState('');
  const [salvandoMembro, setSalvandoMembro] = useState(false);
  const [membroEditando, setMembroEditando] =
    useState<ProducaoMembro | null>(null);
  const [membroParaInativar, setMembroParaInativar] =
    useState<ProducaoMembro | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState('');
  const [apelidoEdicao, setApelidoEdicao] = useState('');
  const [funcaoEdicao, setFuncaoEdicao] = useState('');
  const [valorHoraEdicao, setValorHoraEdicao] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [inativando, setInativando] = useState(false);
  const [nomeTarefa, setNomeTarefa] = useState('');
  const [categoriaTarefa, setCategoriaTarefa] = useState('');
  const [salvandoTarefa, setSalvandoTarefa] = useState(false);
  const [lendoPlanilha, setLendoPlanilha] = useState(false);
  const [importandoCadastros, setImportandoCadastros] = useState(false);
  const [importacao, setImportacao] = useState<ImportacaoPreparada | null>(
    null,
  );
  const inputImportacaoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void Promise.all([listarMembros(false), listarTarefas(false)]).catch(() => {
      toast.error('Não foi possível carregar as configurações da Produção.');
    });
  }, [listarMembros, listarTarefas]);

  const cadastrarMembro = async (event: FormEvent) => {
    event.preventDefault();
    setSalvandoMembro(true);
    try {
      await criarMembro(
        nomeMembro,
        apelidoMembro,
        funcaoMembro,
        parseValorHoraProducao(valorHoraMembro),
      );
      setNomeMembro('');
      setApelidoMembro('');
      setFuncaoMembro('');
      setValorHoraMembro('');
      toast.success('Membro cadastrado.');
    } catch (error) {
      toast.error(mensagemErro(error, 'Não foi possível cadastrar o membro.'));
    } finally {
      setSalvandoMembro(false);
    }
  };

  const abrirEdicao = (membro: ProducaoMembro) => {
    setMembroEditando(membro);
    setNomeEdicao(membro.nome);
    setApelidoEdicao(membro.apelido ?? '');
    setFuncaoEdicao(membro.funcao ?? '');
    setValorHoraEdicao(
      membro.valor_hora === null || membro.valor_hora === undefined
        ? ''
        : String(membro.valor_hora).replace('.', ','),
    );
  };

  const salvarEdicao = async (event: FormEvent) => {
    event.preventDefault();
    if (!membroEditando) return;

    setSalvandoEdicao(true);
    try {
      await editarMembro(membroEditando.id, {
        nome: nomeEdicao,
        apelido: apelidoEdicao,
        funcao: funcaoEdicao,
        valor_hora: parseValorHoraProducao(valorHoraEdicao),
      });
      setMembroEditando(null);
      toast.success('Membro atualizado.');
    } catch (error) {
      toast.error(mensagemErro(error, 'Não foi possível editar o membro.'));
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const confirmarInativacao = async () => {
    if (!membroParaInativar) return;

    setInativando(true);
    try {
      await inativarMembro(membroParaInativar.id);
      await listarMembros(false);
      setMembroParaInativar(null);
      toast.success('Membro inativado.');
    } catch (error) {
      toast.error(mensagemErro(error, 'Não foi possível inativar o membro.'));
    } finally {
      setInativando(false);
    }
  };

  const cadastrarTarefa = async (event: FormEvent) => {
    event.preventDefault();
    setSalvandoTarefa(true);
    try {
      await criarTarefa(nomeTarefa, categoriaTarefa);
      setNomeTarefa('');
      setCategoriaTarefa('');
      toast.success('Tarefa cadastrada.');
    } catch (error) {
      toast.error(mensagemErro(error, 'Não foi possível cadastrar a tarefa.'));
    } finally {
      setSalvandoTarefa(false);
    }
  };

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

    setImportandoCadastros(true);
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

    setImportandoCadastros(false);
    setImportacao(null);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <div className="flex flex-wrap justify-end gap-2 xl:col-span-2">
        <input
          ref={inputImportacaoRef}
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
          disabled={lendoPlanilha || importandoCadastros}
          onClick={() => inputImportacaoRef.current?.click()}
        >
          {lendoPlanilha ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          Importar equipe e tarefas
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => exportarCadastrosProducaoExcel(membros, tarefas)}
        >
          <FileDown className="mr-2 h-4 w-4" />
          Exportar cadastros
        </Button>
      </div>
      <p className="-mt-2 text-sm text-muted-foreground xl:col-span-2">
        A planilha pode importar membros da equipe e tarefas de Produção.
      </p>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <UserRoundPlus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Equipe de Produção</CardTitle>
              <CardDescription>
                Cadastre as pessoas que executam os serviços de produção.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <form
            onSubmit={cadastrarMembro}
            className="space-y-3 rounded-lg border bg-muted/10 p-4"
          >
            <p className="text-sm font-medium">Novo membro</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="novo-membro-nome">Nome *</Label>
                <Input
                  id="novo-membro-nome"
                  value={nomeMembro}
                  onChange={(event) => setNomeMembro(event.target.value)}
                  placeholder="Nome completo"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="novo-membro-apelido">Apelido</Label>
                <Input
                  id="novo-membro-apelido"
                  value={apelidoMembro}
                  onChange={(event) => setApelidoMembro(event.target.value)}
                  placeholder="Como é conhecido"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="novo-membro-funcao">Função</Label>
                <Input
                  id="novo-membro-funcao"
                  value={funcaoMembro}
                  onChange={(event) => setFuncaoMembro(event.target.value)}
                  placeholder="Ex.: Montador"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="novo-membro-valor-hora">Valor da hora</Label>
                <Input
                  id="novo-membro-valor-hora"
                  inputMode="decimal"
                  value={valorHoraMembro}
                  onChange={(event) => setValorHoraMembro(event.target.value)}
                  placeholder="Ex.: 14,21"
                />
              </div>
            </div>
            <Button type="submit" disabled={salvandoMembro || !nomeMembro.trim()}>
              {salvandoMembro ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Cadastrar membro
            </Button>
          </form>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              Membros cadastrados ({membros.length})
            </p>
            {membros.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhum membro cadastrado.
              </p>
            ) : (
              membros.map((membro) => (
                <div
                  key={membro.id}
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{membro.nome}</p>
                      <Badge variant={membro.ativo ? 'secondary' : 'outline'}>
                        {membro.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {[membro.apelido, membro.funcao].filter(Boolean).join(' · ') ||
                        'Sem apelido ou função informados'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatarMoedaHora(membro.valor_hora)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => abrirEdicao(membro)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                    {membro.ativo && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setMembroParaInativar(membro)}
                      >
                        <UserX className="mr-2 h-4 w-4" />
                        Inativar
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <ClipboardPlus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Tarefas de Produção</CardTitle>
              <CardDescription>
                Defina as atividades disponíveis nos apontamentos.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <form
            onSubmit={cadastrarTarefa}
            className="space-y-3 rounded-lg border bg-muted/10 p-4"
          >
            <p className="text-sm font-medium">Nova tarefa</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="nova-tarefa-nome">Nome *</Label>
                <Input
                  id="nova-tarefa-nome"
                  value={nomeTarefa}
                  onChange={(event) => setNomeTarefa(event.target.value)}
                  placeholder="Ex.: Montagem de estrutura"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nova-tarefa-categoria">Categoria</Label>
                <Input
                  id="nova-tarefa-categoria"
                  value={categoriaTarefa}
                  onChange={(event) => setCategoriaTarefa(event.target.value)}
                  placeholder="Ex.: Fabricação"
                />
              </div>
            </div>
            <Button type="submit" disabled={salvandoTarefa || !nomeTarefa.trim()}>
              {salvandoTarefa ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Cadastrar tarefa
            </Button>
          </form>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              Tarefas cadastradas ({tarefas.length})
            </p>
            {tarefas.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhuma tarefa cadastrada.
              </p>
            ) : (
              tarefas.map((tarefa) => (
                <div
                  key={tarefa.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{tarefa.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      {tarefa.categoria || 'Sem categoria'}
                    </p>
                  </div>
                  <Badge variant={tarefa.ativo ? 'secondary' : 'outline'}>
                    {tarefa.ativo ? 'Ativa' : 'Inativa'}
                  </Badge>
                </div>
              ))
            )}
            <p className="pt-1 text-xs text-muted-foreground">
              O estado da tarefa já é exibido; a ação de inativar dependerá de
              uma operação própria no hook em uma etapa futura.
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(membroEditando)}
        onOpenChange={(aberto) => !aberto && setMembroEditando(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar membro</DialogTitle>
            <DialogDescription>
              Atualize os dados usados nos próximos apontamentos.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={salvarEdicao} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="editar-membro-nome">Nome *</Label>
              <Input
                id="editar-membro-nome"
                value={nomeEdicao}
                onChange={(event) => setNomeEdicao(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="editar-membro-apelido">Apelido</Label>
                <Input
                  id="editar-membro-apelido"
                  value={apelidoEdicao}
                  onChange={(event) => setApelidoEdicao(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="editar-membro-funcao">Função</Label>
                <Input
                  id="editar-membro-funcao"
                  value={funcaoEdicao}
                  onChange={(event) => setFuncaoEdicao(event.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="editar-membro-valor-hora">
                  Valor da hora
                </Label>
                <Input
                  id="editar-membro-valor-hora"
                  inputMode="decimal"
                  value={valorHoraEdicao}
                  onChange={(event) => setValorHoraEdicao(event.target.value)}
                  placeholder="Ex.: 14,21"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMembroEditando(null)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvandoEdicao || !nomeEdicao.trim()}
              >
                {salvandoEdicao && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Salvar alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(importacao)}
        onOpenChange={(aberto) => {
          if (!aberto && !importandoCadastros) setImportacao(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar membros e tarefas</DialogTitle>
            <DialogDescription>
              Revise a prévia antes de criar os cadastros. A planilha exportada
              pelo sistema pode ser usada como modelo.
            </DialogDescription>
          </DialogHeader>

          {importacao && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/10 p-3 text-sm">
                <p className="font-medium">{importacao.arquivo_nome}</p>
                <p className="text-muted-foreground">
                  Somente registros novos e ativos serão importados.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">
                    Membros novos
                  </p>
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
                  <p className="text-sm text-muted-foreground">
                    Tarefas novas
                  </p>
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
                  disabled={importandoCadastros}
                  onClick={() => setImportacao(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={
                    importandoCadastros ||
                    importacao.membros_novos.length +
                      importacao.tarefas_novas.length ===
                      0
                  }
                  onClick={() => void importarCadastros()}
                >
                  {importandoCadastros && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Confirmar importação
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(membroParaInativar)}
        onOpenChange={(aberto) => !aberto && setMembroParaInativar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Inativar membro?</AlertDialogTitle>
            <AlertDialogDescription>
              {membroParaInativar?.nome} deixará de aparecer na seleção de
              equipe dos novos apontamentos. Registros anteriores serão
              preservados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={inativando}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={inativando}
              onClick={(event) => {
                event.preventDefault();
                void confirmarInativacao();
              }}
            >
              {inativando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Inativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
