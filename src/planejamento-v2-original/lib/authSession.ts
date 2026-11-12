// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/planejamento-v2-original/supabaseClient";

const DEFAULT_SESSION_TIMEOUT_MS = 6_000;

/** Erros de sessão persistida irrecuperável (refresh token inexistente/revogado). */
export function isInvalidSessionError(error: unknown): boolean {
  if (!error) return false;
  const err = error as { message?: string; code?: string; name?: string };
  const text = `${err.code || ""} ${err.message || ""}`.toLowerCase();
  return (
    text.includes("refresh token not found") ||
    text.includes("invalid refresh token") ||
    text.includes("refresh_token_not_found") ||
    text.includes("refresh_token_already_used") ||
    text.includes("session_not_found")
  );
}

let clearingSession = false;

/** Preview embutido do editor: a sessão pertence ao auth broker do editor. */
function isEmbeddedPreview(): boolean {
  try {
    return typeof window !== "undefined" && window.parent !== window;
  } catch {
    return true;
  }
}

/** Logout apenas local (não revoga outras sessões) e redireciona para /auth. */
export async function clearInvalidLocalSession(reason?: unknown): Promise<void> {
  // Executa no máximo uma vez por carregamento de página: evita loop de logout/redirect.
  if (clearingSession) return;
  clearingSession = true;
  console.warn("Sessão persistida inválida; encerrando localmente.", reason);

  if (isEmbeddedPreview()) {
    // No iframe do editor, não recarrega a página nem apaga storage: isso
    // disputaria a sessão do broker e causava tela preta/loop. O signOut local
    // dispara SIGNED_OUT e o roteador leva para /auth sem recarregar.
    void supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    return;
  }

  try {
    await Promise.race([
      supabase.auth.signOut({ scope: "local" }),
      new Promise((resolve) => setTimeout(resolve, 3_000)),
    ]);
  } catch (error) {
    console.warn("Falha no logout local:", error);
  }
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("sb-") && key.endsWith("-auth-token")) window.localStorage.removeItem(key);
    }
  } catch {
    /* storage indisponível */
  }
  if (!window.location.pathname.startsWith("/auth")) {
    window.location.replace("/auth");
  }
}

let guardInstalled = false;

/** Captura erros de refresh disparados pelo auto-refresh em segundo plano. */
export function installInvalidSessionGuard(): void {
  if (guardInstalled || typeof window === "undefined") return;
  guardInstalled = true;
  window.addEventListener("unhandledrejection", (event) => {
    if (isInvalidSessionError(event.reason)) {
      event.preventDefault();
      void clearInvalidLocalSession(event.reason);
    }
  });
}

export async function getSessionWithTimeout(timeoutMs = DEFAULT_SESSION_TIMEOUT_MS): Promise<Session | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<null>((resolve) => {
    timeoutId = setTimeout(() => resolve(null), timeoutMs);
  });

  try {
    const sessionPromise = supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.warn("Falha ao validar sessão:", error.message);
        if (isInvalidSessionError(error)) void clearInvalidLocalSession(error);
        return null;
      }

      return data.session;
    });

    return await Promise.race([sessionPromise, timeoutPromise]);
  } catch (error) {
    console.error("Erro ao validar sessão:", error);
    if (isInvalidSessionError(error)) void clearInvalidLocalSession(error);
    return null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/** Envolve uma promessa com timeout que rejeita (saída de erro explícita). */
export function withTimeout<T>(promise: PromiseLike<T>, ms: number, label = "operação"): Promise<T> {
  let id: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => {
      id = setTimeout(() => reject(new Error(`Tempo esgotado: ${label}`)), ms);
    }),
  ]).finally(() => id && clearTimeout(id));
}
