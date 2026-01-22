import { useAuthContext } from "@/contexts/AuthContext";

// Mantém a mesma API (user/session/loading/error/signIn/signUp/signOut)
// mas agora com um único listener global (AuthProvider), evitando estados divergentes.
export const useAuth = useAuthContext;
