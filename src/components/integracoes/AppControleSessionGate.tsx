import { FormEvent, ReactNode, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { appControleSupabase } from "@/integrations/appcontrole/client";
import { useAuth } from "@/hooks/useAuth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  children: ReactNode;
  moduleName: string;
};

export function AppControleSessionGate({ children, moduleName }: Props) {
  const { session: fluxoSession } = useAuth();
  const [appSession, setAppSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [email, setEmail] = useState(fluxoSession?.user?.email || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    appControleSupabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setAppSession(data.session);
      setLoading(false);
    });

    const { data: listener } = appControleSupabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setAppSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!email && fluxoSession?.user?.email) setEmail(fluxoSession.user.email);
  }, [email, fluxoSession?.user?.email]);

  useEffect(() => {
    const fluxoEmail = fluxoSession?.user?.email?.trim().toLowerCase();
    const appEmail = appSession?.user?.email?.trim().toLowerCase();
    if (!fluxoEmail || !appEmail || fluxoEmail === appEmail) return;

    void appControleSupabase.auth.signOut().finally(() => {
      setAppSession(null);
      setPassword("");
      setError("Conecte a conta do App Controle correspondente ao usuário atual do Fluxo.");
      setEmail(fluxoSession?.user?.email || "");
    });
  }, [appSession?.user?.email, fluxoSession?.user?.email]);

  const connect = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setConnecting(true);
    try {
      const { error: signInError } = await appControleSupabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      setPassword("");
    } catch (err: any) {
      setError(err?.message || "Não foi possível conectar ao App Controle.");
    } finally {
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[260px] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Preparando {moduleName}...
      </div>
    );
  }

  if (appSession) return <>{children}</>;

  return (
    <div className="mx-auto max-w-xl py-8">
      <Card>
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <CardTitle>Conectar {moduleName}</CardTitle>
          <CardDescription>
            Esta tela roda dentro do Fluxo de Estoque, mas usa as permissões e os dados oficiais do App Controle.
            A conexão fica salva neste navegador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={connect}>
            <div className="space-y-2">
              <Label htmlFor="appcontrole-email">E-mail</Label>
              <Input
                id="appcontrole-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appcontrole-password">Senha do App Controle</Label>
              <Input
                id="appcontrole-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Não foi possível conectar</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={connecting}>
              {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Conectar uma vez
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
