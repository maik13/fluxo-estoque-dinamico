import { FormEvent, useEffect, useState } from 'react';
import {
  ClipboardPlus,
  FileDown,
  Loader2,
  Pencil,
  Plus,
  UserRoundPlus,
  UserX,
} from 'lucide-react';
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

interface ConfiguracoesProducaoProps {
  membros: ProducaoMembro[];
  tarefas: ProducaoTarefa[];
  listarMembros: (somenteAtivos?: boolean) => Promise<ProducaoMembro[]>;
  criarMembro: (
    nome: string,
    apelido?: string | null,
    funcao?: string | null,
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
  const [salvandoMembro, setSalvandoMembro] = useState(false);
  const [membroEditando, setMembroEditando] =
    useState<ProducaoMembro | null>(null);
  const [membroParaInativar, setMembroParaInativar] =
    useState<ProducaoMembro | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState('');
  const [apelidoEdicao, setApelidoEdicao] = useState('');
  const [funcaoEdicao, setFuncaoEdicao] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [inativando, setInativando] = useState(false);
  const [nomeTarefa, setNomeTarefa] = useState('');
  const [categoriaTarefa, setCategoriaTarefa] = useState('');
  const [salvandoTarefa, setSalvandoTarefa] = useState(false);

  useEffect(() => {
    void Promise.all([listarMembros(false), listarTarefas(false)]).catch(() => {
      toast.error('Não foi possível carregar as configurações da Produção.');
    });
  }, [listarMembros, listarTarefas]);

  const cadastrarMembro = async (event: FormEvent) => {
    event.preventDefault();
    setSalvandoMembro(true);
    try {
      await criarMembro(nomeMembro, apelidoMembro, funcaoMembro);
      setNomeMembro('');
      setApelidoMembro('');
      setFuncaoMembro('');
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

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <div className="flex justify-end xl:col-span-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => exportarCadastrosProducaoExcel(membros, tarefas)}
        >
          <FileDown className="mr-2 h-4 w-4" />
          Exportar cadastros
        </Button>
      </div>
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
