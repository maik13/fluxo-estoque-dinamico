/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, FolderKanban, Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { appControleSupabase } from "@/integrations/appcontrole/client";
import { AppControleSessionGate } from "@/components/integracoes/AppControleSessionGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Planejamento2WorkspaceIntegrado } from "@/components/integracoes/Planejamento2WorkspaceIntegrado";

const ac = appControleSupabase as any;

type Project = { id: string; name: string; order: number };
type Workspace = { id: string; appProjectSettingId: string; projectName: string; status: string; updatedAt: string | null };

async function loadList() {
  const [p, w] = await Promise.all([
    ac.from("settings").select("id,valor,ordem").eq("tipo","projeto").eq("ativo",true).order("ordem"),
    ac.from("planejamento_v2_workspaces").select("*").is("archived_at",null).order("updated_at",{ascending:false}),
  ]);
  if (p.error) throw p.error;
  if (w.error) throw w.error;
  return {
    projects: (p.data || []).map((r:any)=>({id:String(r.id),name:String(r.valor||"Projeto"),order:Number(r.ordem||0)})) as Project[],
    workspaces: (w.data || []).map((r:any)=>({
      id:String(r.id),
      appProjectSettingId:String(r.app_project_setting_id),
      projectName:String(r.project_name_snapshot||"Projeto"),
      status:String(r.status||"draft"),
      updatedAt:r.updated_at||null,
    })) as Workspace[],
  };
}

function Inner() {
  const qc = useQueryClient();
  const [workspaceId,setWorkspaceId] = useState("");
  const list = useQuery({queryKey:["integracao-appcontrole-planejamento-lista"],queryFn:loadList,staleTime:15000,refetchInterval:30000});
  const workspace = useMemo(()=>list.data?.workspaces.find(w=>w.id===workspaceId)||null,[list.data?.workspaces,workspaceId]);

  const create = useMutation({
    mutationFn: async (project:Project) => {
      const {data:auth,error:authError}=await appControleSupabase.auth.getUser();
      if(authError) throw authError;
      const userId=auth.user?.id||null;
      const {data,error}=await ac.from("planejamento_v2_workspaces").insert({
        app_project_setting_id:project.id,
        project_name_snapshot:project.name,
        owner_id:userId,
        created_by:userId,
        updated_by:userId,
        status:"draft",
      }).select("*").single();
      if(error) throw error;
      return data;
    },
    onSuccess: async (row:any)=>{
      await qc.invalidateQueries({queryKey:["integracao-appcontrole-planejamento-lista"]});
      setWorkspaceId(String(row.id));
      toast.success("Planejamento 2.0 criado no App Controle.");
    },
    onError:(e:any)=>toast.error(e?.message||"Não foi possível criar o planejamento."),
  });

  if(list.isLoading) return <div className="flex min-h-64 items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Carregando Planejamento 2.0...</div>;
  if(list.error) return <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{String((list.error as any)?.message||list.error)}</div>;

  if(workspace){
    return <Planejamento2WorkspaceIntegrado workspace={workspace} onBack={()=>setWorkspaceId("")}/>;
  }

  const byProject=new Map((list.data?.workspaces||[]).map(w=>[w.appProjectSettingId,w]));

  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-xl font-semibold">Planejamento 2.0</h2><p className="text-sm text-muted-foreground">Tela do Fluxo; dados e regras oficiais permanecem no App Controle.</p></div>
      <Button variant="outline" size="sm" onClick={()=>void list.refetch()}><RefreshCw className="mr-2 h-4 w-4"/>Atualizar</Button>
    </div>
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Projeto</TableHead>
            <TableHead className="w-[190px]">Situação</TableHead>
            <TableHead className="w-[220px]">Última atualização</TableHead>
            <TableHead className="w-[230px] text-right">Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(list.data?.projects||[]).map(project=>{
            const ws=byProject.get(project.id);
            const statusLabel = !ws
              ? "Pronto para planejar"
              : ws.status === "active"
                ? "Ativo"
                : ws.status === "draft"
                  ? "Rascunho"
                  : ws.status;
            const updatedLabel = ws?.updatedAt
              ? new Date(ws.updatedAt).toLocaleString("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })
              : "—";

            return (
              <TableRow
                key={project.id}
                className={ws ? "cursor-pointer transition-colors hover:bg-muted/40" : "transition-colors hover:bg-muted/20"}
                onClick={() => {
                  if (ws) setWorkspaceId(ws.id);
                }}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-primary/10 p-2 text-primary">
                      <FolderKanban className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{project.name}</div>
                      <div className="text-xs text-muted-foreground">Projeto do App Controle</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={ws ? "default" : "outline"}>{statusLabel}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {updatedLabel}
                </TableCell>
                <TableCell className="text-right">
                  {ws ? (
                    <Button
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        setWorkspaceId(ws.id);
                      }}
                    >
                      Abrir planejamento
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={create.isPending}
                      onClick={(event) => {
                        event.stopPropagation();
                        create.mutate(project);
                      }}
                    >
                      {create.isPending
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        : <Plus className="mr-2 h-4 w-4" />}
                      Criar planejamento
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {!(list.data?.projects||[]).length && (
            <TableRow>
              <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                Nenhum projeto disponível para planejamento.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  </div>;
}

export function Planejamento2Integrado(){
  return <AppControleSessionGate moduleName="Planejamento 2.0"><Inner/></AppControleSessionGate>;
}
