interface SupabaseErrorLike {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}

export const formatarErroSupabase = (
  error: unknown,
  fallback = 'Não foi possível concluir a operação.',
) => {
  if (error instanceof Error && error.message.trim()) return error.message;

  if (error && typeof error === 'object') {
    const supabaseError = error as SupabaseErrorLike;
    const partes = [supabaseError.message, supabaseError.details, supabaseError.hint]
      .filter((parte): parte is string => Boolean(parte?.trim()));

    if (partes.length > 0) {
      const mensagem = [...new Set(partes)].join(' — ');
      if (supabaseError.code === '42883' || /function .* does not exist/i.test(mensagem)) {
        return `Função necessária ausente no Supabase: ${mensagem}`;
      }
      if (supabaseError.code === '42501' || /row-level security|permission denied/i.test(mensagem)) {
        return `A operação foi bloqueada pelas permissões do banco: ${mensagem}`;
      }
      return mensagem;
    }
  }

  return fallback;
};
