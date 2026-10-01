import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, CheckCircle2, Clock, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { MonthYearPicker } from "@/components/ponto/MonthYearPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

type PointEntry = {
  id: string;
  data: string;
  hora_entrada_1: string | null;
  hora_saida_1: string | null;
  hora_entrada_2: string | null;
  hora_saida_2: string | null;
  hora_entrada_3: string | null;
  hora_saida_3: string | null;
  status: string;
};

type PointSnapshot = {
  colaborador: {
    id: string;
    nome: string;
  };
  entries: PointEntry[];
};

type RegisterPointResult = {
  entry_id: string;
  colaborador_id: string;
  colaborador_nome: string;
  data: string;
  hora: string;
  campo: string;
  rotulo: string;
};

function timeLabel(value: string | null) {
  return value?.slice(0, 5) || "—";
}

function statusBadge(status: string) {
  if (status === "aprovado") {
    return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">Aprovado</Badge>;
  }
  if (status === "rejeitado") {
    return <Badge variant="destructive">Rejeitado</Badge>;
  }
  return <Badge variant="secondary">Pendente</Badge>;
}

export default function MeuPonto() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [snapshot, setSnapshot] = useState<PointSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [now, setNow] = useState(new Date());

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    // Falhas de rede/refresh de sessão são comuns em tablets de fábrica: tentamos novamente
    // antes de bloquear a tela, para não impedir a batida do ponto.
    let lastError: { message?: string } | null = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { data, error } = await sb.rpc("rh_get_meu_ponto_snapshot", {
        p_mes: `${selectedMonth}-01`,
      });

      if (!error) {
        setSnapshot((data || null) as PointSnapshot | null);
        setErrorMessage("");
        setLoading(false);
        return;
      }

      lastError = error;
      console.error(`Erro ao carregar o próprio ponto (tentativa ${attempt + 1}):`, error);
      await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
    }

    setSnapshot(null);
    setErrorMessage(lastError?.message || "Não foi possível carregar seu cadastro de ponto.");
    setLoading(false);
  }, [selectedMonth]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const todayEntry = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return snapshot?.entries.find((entry) => entry.data === today) || null;
  }, [snapshot]);

  const handleRegisterNow = async () => {
    setSaving(true);
    setErrorMessage("");

    let data: unknown = null;
    let error: { message?: string } | null = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await sb.rpc("rh_registrar_meu_ponto_agora");
      data = response.data;
      error = response.error;

      if (!error) break;

      // Só faz sentido repetir quando a falha é de rede/sessão, nunca em regra de negócio.
      const isNetworkError = /failed to fetch|network|timeout|jwt|token/i.test(error.message || "");
      if (!isNetworkError) break;

      await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
    }

    if (error) {
      console.error("Erro ao registrar o próprio ponto:", error);
      const message = error.message || "Não foi possível registrar o ponto.";
      setErrorMessage(message);
      toast.error(message);
      setSaving(false);
      return;
    }

    const result = data as RegisterPointResult;
    toast.success(`${result.rotulo} registrada às ${result.hora}`);
    await loadSnapshot();
    setSaving(false);
  };

  return (
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <Card className="border-primary/30">
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Clock className="h-5 w-5 text-primary" />
                  Registrar ponto agora
                </CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  O registro usa o horário oficial do servidor, não o relógio do computador.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-right">
                <div className="text-xs text-muted-foreground">Horário exibido</div>
                <div className="font-mono text-lg font-semibold">
                  {format(now, "dd/MM/yyyy HH:mm:ss")}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {snapshot?.colaborador && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>
                  Colaborador identificado: <strong>{snapshot.colaborador.nome}</strong>
                </span>
              </div>
            )}

            {errorMessage && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-semibold">Não foi possível concluir o acesso ao ponto</div>
                    <div className="mt-1 break-words">{errorMessage}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                onClick={handleRegisterNow}
                disabled={saving || loading}
                className="min-w-56"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Clock className="mr-2 h-4 w-4" />
                )}
                Registrar agora
              </Button>
              <Button variant="outline" size="lg" onClick={loadSnapshot} disabled={loading || saving}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>

            {todayEntry && (
              <div className="grid gap-2 rounded-lg border border-border p-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
                <div><span className="text-muted-foreground">Entrada 1:</span> {timeLabel(todayEntry.hora_entrada_1)}</div>
                <div><span className="text-muted-foreground">Saída 1:</span> {timeLabel(todayEntry.hora_saida_1)}</div>
                <div><span className="text-muted-foreground">Entrada 2:</span> {timeLabel(todayEntry.hora_entrada_2)}</div>
                <div><span className="text-muted-foreground">Saída 2:</span> {timeLabel(todayEntry.hora_saida_2)}</div>
                <div><span className="text-muted-foreground">Entrada 3:</span> {timeLabel(todayEntry.hora_entrada_3)}</div>
                <div><span className="text-muted-foreground">Saída 3:</span> {timeLabel(todayEntry.hora_saida_3)}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-lg">Meus registros</CardTitle>
              <MonthYearPicker value={selectedMonth} onChange={setSelectedMonth} />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Entrada 1</TableHead>
                      <TableHead>Saída 1</TableHead>
                      <TableHead>Entrada 2</TableHead>
                      <TableHead>Saída 2</TableHead>
                      <TableHead>Entrada 3</TableHead>
                      <TableHead>Saída 3</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!snapshot?.entries.length ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                          Nenhum registro encontrado neste mês.
                        </TableCell>
                      </TableRow>
                    ) : (
                      snapshot.entries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">
                            {format(new Date(`${entry.data}T12:00:00`), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>{timeLabel(entry.hora_entrada_1)}</TableCell>
                          <TableCell>{timeLabel(entry.hora_saida_1)}</TableCell>
                          <TableCell>{timeLabel(entry.hora_entrada_2)}</TableCell>
                          <TableCell>{timeLabel(entry.hora_saida_2)}</TableCell>
                          <TableCell>{timeLabel(entry.hora_entrada_3)}</TableCell>
                          <TableCell>{timeLabel(entry.hora_saida_3)}</TableCell>
                          <TableCell>{statusBadge(entry.status)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  );
}
