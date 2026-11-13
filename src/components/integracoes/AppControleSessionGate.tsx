/* eslint-disable @typescript-eslint/no-explicit-any */
import { FormEvent, ReactNode, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";
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
  const [sendingRecovery, setSendingRecovery] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);
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
      const message = err?.message || "Não foi possível conectar ao App Controle.";
      setError(
        /invalid login credentials/i.test(message)
          ? "A senha informada não corresponde à conta do App Controle. Redefina a senha abaixo e depois conecte novamente."
          : message,
      );
    } finally {
      setConnecting(false);
    }
  };

  const sendPasswordRecovery = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Informe o e-mail da conta do App Controle.");
      return;
    }

    setError("");
    setRecoverySent(false);
    setSendingRecovery(true);
    try {
      const { error: recoveryError } = await appControleSupabase.auth.resetPasswordForEmail(
        normalizedEmail,
      );
      if (recoveryError) throw recoveryError;
      setRecoverySent(true);
    } catch (err: any) {
      const message = err?.message || "";
      setError(
        /rate limit/i.test(message)
          ? "Limite de envio de e-mails atingido. Aguarde cerca de 1 hora e tente redefinir novamente, ou use o último e-mail de redefinição já recebido."
          : message || "Não foi possível enviar a recuperação de senha do App Controle.",
      );
    } finally {
      setSendingRecovery(false);
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
            {recoverySent && (
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertTitle>E-mail enviado</AlertTitle>
                <AlertDescription>
                  Abra o e-mail de recuperação, defina a senha do App Controle e depois volte para conectar uma única vez.
                </AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={connecting}>
              {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Conectar uma vez
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void sendPasswordRecovery()}
              disabled={connecting || sendingRecovery}
            >
              {sendingRecovery ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              Redefinir senha do App Controle
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
