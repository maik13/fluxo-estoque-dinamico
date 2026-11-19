import { supabase } from "@/integrations/supabase/client";
import { appControleSupabase } from "@/integrations/appcontrole/client";

/**
 * Conecta o App Controle usando a senha do Fluxo.
 * Se a senha do App Controle estiver diferente, pede ao servidor para
 * igualá-la à senha do Fluxo (validada lá) e tenta de novo.
 */
export async function conectarAppControleComSenhaFluxo(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const { data: atual } = await appControleSupabase.auth.getSession();
  if (atual.session?.user?.email?.toLowerCase() === normalizedEmail) return;
  if (atual.session) await appControleSupabase.auth.signOut({ scope: "local" });

  const first = await appControleSupabase.auth.signInWithPassword({ email: normalizedEmail, password });
  if (!first.error) return;
  if (!/invalid login credentials/i.test(first.error.message)) throw first.error;

  const { data, error } = await supabase.functions.invoke("appcontrole-sync-senha", {
    body: { password },
  });
  if (error || (data as { error?: string } | null)?.error) {
    let msg = (data as { error?: string } | null)?.error || "";
    if (!msg && error && "context" in error) {
      try {
        msg = (await (error as { context: Response }).context.json())?.error || "";
      } catch {
        /* ignore */
      }
    }
    if (/não configurada/i.test(msg)) {
      throw new Error("A senha do ponto (App Controle) está diferente da senha do Fluxo.");
    }
    throw new Error(msg || error?.message || "Não foi possível sincronizar a senha do App Controle.");
  }

  const second = await appControleSupabase.auth.signInWithPassword({ email: normalizedEmail, password });
  if (second.error) throw second.error;
}
