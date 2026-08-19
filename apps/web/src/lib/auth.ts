import { create } from "zustand";
import { apiFetch, ApiError } from "./api";

export interface AuthUser {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  estActif: boolean;
  roles: string[];
  permissions: string[];
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  status: "idle" | "loading" | "ready";
  setSession: (accessToken: string, user: AuthUser) => void;
  clearSession: () => void;
  setStatus: (status: AuthState["status"]) => void;
}

// Volontairement en mémoire uniquement (pas de persist/localStorage) : l'access
// token est un secret de courte durée, le refresh token (httpOnly cookie) est
// la seule chose qui doit survivre à un rechargement de page — cf. ensureSession().
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  status: "idle",
  setSession: (accessToken, user) => set({ accessToken, user, status: "ready" }),
  clearSession: () => set({ accessToken: null, user: null, status: "ready" }),
  setStatus: (status) => set({ status }),
}));

export async function login(email: string, motDePasse: string): Promise<AuthUser> {
  const { accessToken } = await apiFetch<{ accessToken: string }>("/auth/login", {
    method: "POST",
    body: { email, motDePasse },
  });
  const user = await apiFetch<AuthUser>("/auth/me", { token: accessToken });
  useAuthStore.getState().setSession(accessToken, user);
  return user;
}

export async function logout(): Promise<void> {
  const { accessToken } = useAuthStore.getState();
  try {
    await apiFetch("/auth/logout", { method: "POST", token: accessToken });
  } finally {
    useAuthStore.getState().clearSession();
  }
}

// Le refresh token est à usage unique côté backend (rotation) : deux appels
// concurrents à ensureSession() (ex. React StrictMode double-invoquant les
// effects en dev) feraient échouer l'un des deux avec un 401 "déjà utilisé".
// On déduplique donc les appels concurrents sur une seule promesse partagée.
let inFlightRefresh: Promise<AuthUser | null> | null = null;

/**
 * Tente de restaurer la session au chargement de l'app via le refresh token
 * (cookie httpOnly, envoyé automatiquement par le navigateur). Échoue
 * silencieusement si aucune session valide n'existe (utilisateur non connecté).
 */
export async function ensureSession(): Promise<AuthUser | null> {
  const store = useAuthStore.getState();
  if (store.user) return store.user;
  if (inFlightRefresh) return inFlightRefresh;

  store.setStatus("loading");
  inFlightRefresh = (async () => {
    try {
      const { accessToken } = await apiFetch<{ accessToken: string }>("/auth/refresh", {
        method: "POST",
      });
      const user = await apiFetch<AuthUser>("/auth/me", { token: accessToken });
      store.setSession(accessToken, user);
      return user;
    } catch (e) {
      if (e instanceof ApiError) {
        store.setStatus("ready");
        return null;
      }
      throw e;
    } finally {
      inFlightRefresh = null;
    }
  })();

  return inFlightRefresh;
}
