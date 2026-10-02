// A sessão precisa sobreviver a reloads/hot reloads do Preview.
// Mantemos o mesmo adaptador esperado pelo cliente Supabase, mas a fonte de
// verdade é o localStorage do próprio navegador. Isso evita que uma atualização
// do editor substitua ou apague uma sessão válida do usuário.
export function brokeredPreviewStorage() {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage;
}
