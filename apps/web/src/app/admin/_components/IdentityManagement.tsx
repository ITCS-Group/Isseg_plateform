"use client";

/**
 * Gestion Utilisateurs/Rôles/Permissions — code de l'ancien contenu de
 * /admin (chantier Étape 2), préservé tel quel dans l'attente de l'Étape 5
 * ("Déplacement du RBAC") qui le montera sous /admin/parametres/*. Pas encore
 * importé/routé nulle part à ce stade (Étape 3 = Dashboard visuel uniquement)
 * — composant intentionnellement inutilisé pour l'instant, pas du code mort
 * à supprimer.
 */

import { useEffect, useState, useCallback } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth";

interface RoleBasic {
  id: string;
  nomRole: string;
}

interface UtilisateurItem {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  estActif: boolean;
  roles: RoleBasic[];
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PaginatedUtilisateurs {
  data: UtilisateurItem[];
  meta: PaginationMeta;
}

interface PermissionBasic {
  id: string;
  nomPermission: string;
  description?: string;
}

interface RoleItem {
  id: string;
  nomRole: string;
  permissions: PermissionBasic[];
}

interface PermissionItem {
  id: string;
  nomPermission: string;
  description?: string;
}

type Tab = "utilisateurs" | "roles" | "permissions";

export function IdentityManagement() {
  const { user, accessToken, status } = useAuthStore();
  const [tab, setTab] = useState<Tab>("utilisateurs");

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [utilisateurs, setUtilisateurs] = useState<PaginatedUtilisateurs | null>(null);
  const [utilisateursError, setUtilisateursError] = useState("");

  const [roles, setRoles] = useState<RoleItem[] | null>(null);
  const [rolesError, setRolesError] = useState("");

  const [permissions, setPermissions] = useState<PermissionItem[] | null>(null);
  const [permissionsError, setPermissionsError] = useState("");

  const fetchUtilisateurs = useCallback(async () => {
    if (!accessToken) return;
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("nom", search);
      const data = await apiFetch<PaginatedUtilisateurs>(`/utilisateurs?${params.toString()}`, {
        token: accessToken,
      });
      setUtilisateurs(data);
    } catch (e) {
      setUtilisateursError(e instanceof ApiError ? e.message : "Erreur réseau");
    }
  }, [accessToken, page, search]);

  const fetchRoles = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await apiFetch<RoleItem[]>("/roles", { token: accessToken });
      setRoles(data);
    } catch (e) {
      setRolesError(e instanceof ApiError ? e.message : "Erreur réseau");
    }
  }, [accessToken]);

  const fetchPermissions = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await apiFetch<PermissionItem[]>("/permissions", { token: accessToken });
      setPermissions(data);
    } catch (e) {
      setPermissionsError(e instanceof ApiError ? e.message : "Erreur réseau");
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) {
      fetchUtilisateurs();
    }
  }, [accessToken, fetchUtilisateurs]);

  useEffect(() => {
    if (accessToken) {
      fetchRoles();
      fetchPermissions();
    }
  }, [accessToken, fetchRoles, fetchPermissions]);

  if (status !== "ready" || !user) {
    return <div className="flex min-h-screen items-center justify-center text-navy/50">Chargement…</div>;
  }

  const TABS: { key: Tab; label: string; badge?: number }[] = [
    { key: "utilisateurs", label: "Utilisateurs", badge: utilisateurs?.meta.total },
    { key: "roles", label: "Rôles", badge: roles?.length },
    { key: "permissions", label: "Permissions", badge: permissions?.length },
  ];

  return (
    <div className="p-6">
      <div className="mb-6 flex gap-1 border-b border-navy/10">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-gold text-navy"
                : "border-transparent text-navy/50 hover:text-navy"
            }`}
          >
            {t.label}
            {typeof t.badge === "number" && t.badge > 0 && (
              <span className="rounded-full bg-navy/10 px-2 py-0.5 text-xs font-semibold text-navy">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "utilisateurs" && (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-navy">Utilisateurs</h2>

              <input
                type="text"
                placeholder="Rechercher par nom…"
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
                className="mb-4 w-full max-w-xs rounded border border-navy/20 px-3 py-2 text-sm"
              />

              {utilisateursError && <p className="text-sm text-status-red">{utilisateursError}</p>}
              {utilisateurs === null && !utilisateursError && (
                <p className="text-sm text-navy/50">Chargement…</p>
              )}
              {utilisateurs?.data.length === 0 && (
                <p className="text-sm text-navy/50">Aucun utilisateur pour le moment.</p>
              )}

              {utilisateurs && utilisateurs.data.length > 0 && (
                <>
                  <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-navy/10 text-navy/50">
                        <tr>
                          <th className="px-4 py-3 font-medium">Nom</th>
                          <th className="px-4 py-3 font-medium">Email</th>
                          <th className="px-4 py-3 font-medium">Statut</th>
                          <th className="px-4 py-3 font-medium">Rôles</th>
                        </tr>
                      </thead>
                      <tbody>
                        {utilisateurs.data.map((u) => (
                          <tr key={u.id} className="border-b border-navy/5 last:border-0">
                            <td className="px-4 py-3">
                              {u.prenom} {u.nom}
                            </td>
                            <td className="px-4 py-3 text-navy/60">{u.email}</td>
                            <td className="px-4 py-3">
                              {u.estActif ? (
                                <span className="rounded-full bg-status-green/10 px-2 py-0.5 text-xs font-medium text-status-green">
                                  Actif
                                </span>
                              ) : (
                                <span className="rounded-full bg-status-neutral/10 px-2 py-0.5 text-xs font-medium text-status-neutral">
                                  Inactif
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-navy/60">
                              {u.roles.map((r) => r.nomRole).join(", ") || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-sm text-navy/50">
                    <span>
                      Page {utilisateurs.meta.page} / {utilisateurs.meta.totalPages} ·{" "}
                      {utilisateurs.meta.total} utilisateur(s)
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={utilisateurs.meta.page <= 1}
                        className="rounded border border-navy/20 px-3 py-1 disabled:opacity-40"
                      >
                        Précédent
                      </button>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(utilisateurs.meta.totalPages, p + 1))}
                        disabled={utilisateurs.meta.page >= utilisateurs.meta.totalPages}
                        className="rounded border border-navy/20 px-3 py-1 disabled:opacity-40"
                      >
                        Suivant
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          {tab === "roles" && (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-navy">Rôles</h2>
              {rolesError && <p className="text-sm text-status-red">{rolesError}</p>}
              {roles === null && !rolesError && <p className="text-sm text-navy/50">Chargement…</p>}
              {roles?.length === 0 && <p className="text-sm text-navy/50">Aucun rôle pour le moment.</p>}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {roles?.map((r) => (
                  <div key={r.id} className="rounded-xl bg-white p-4 shadow-sm">
                    <p className="font-semibold text-navy">{r.nomRole}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.permissions.length === 0 && (
                        <span className="text-xs text-navy/40">Aucune permission</span>
                      )}
                      {r.permissions.map((p) => (
                        <span
                          key={p.id}
                          className="rounded-full bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold"
                        >
                          {p.nomPermission}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === "permissions" && (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-navy">Permissions</h2>
              {permissionsError && <p className="text-sm text-status-red">{permissionsError}</p>}
              {permissions === null && !permissionsError && (
                <p className="text-sm text-navy/50">Chargement…</p>
              )}
              {permissions?.length === 0 && (
                <p className="text-sm text-navy/50">Aucune permission pour le moment.</p>
              )}
              {permissions && permissions.length > 0 && (
                <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-navy/10 text-navy/50">
                      <tr>
                        <th className="px-4 py-3 font-medium">Nom</th>
                        <th className="px-4 py-3 font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {permissions.map((p) => (
                        <tr key={p.id} className="border-b border-navy/5 last:border-0">
                          <td className="px-4 py-3 font-medium text-navy">{p.nomPermission}</td>
                          <td className="px-4 py-3 text-navy/60">{p.description ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
    </div>
  );
}
