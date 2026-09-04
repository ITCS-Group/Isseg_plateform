"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { Power, KeyRound, Shield, UserPlus } from "lucide-react";
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
      const params = new URLSearchParams({ page: String(page), limit: "10" });
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

  const [actionError, setActionError] = useState<Record<string, string>>({});
  const [pendingToggle, setPendingToggle] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<{ userId: string; mode: "password" | "roles" } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [roleActionPending, setRoleActionPending] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ nom: "", prenom: "", email: "", motDePasse: "" });
  const [createError, setCreateError] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const handleCreateUser = useCallback(async () => {
    if (!accessToken) return;
    setCreateSubmitting(true);
    setCreateError("");
    try {
      await apiFetch("/utilisateurs", {
        method: "POST",
        token: accessToken,
        body: createForm,
      });
      setCreateForm({ nom: "", prenom: "", email: "", motDePasse: "" });
      setShowCreateForm(false);
      await fetchUtilisateurs();
    } catch (e) {
      setCreateError(e instanceof ApiError ? e.message : "Erreur réseau");
    } finally {
      setCreateSubmitting(false);
    }
  }, [accessToken, createForm, fetchUtilisateurs]);

  const handleToggleActif = useCallback(
    async (u: UtilisateurItem) => {
      if (!accessToken) return;
      setPendingToggle(u.id);
      setActionError((prev) => ({ ...prev, [u.id]: "" }));
      try {
        await apiFetch(`/utilisateurs/${u.id}`, {
          method: "PATCH",
          token: accessToken,
          body: { estActif: !u.estActif },
        });
        await fetchUtilisateurs();
      } catch (e) {
        setActionError((prev) => ({ ...prev, [u.id]: e instanceof ApiError ? e.message : "Erreur réseau" }));
      } finally {
        setPendingToggle(null);
      }
    },
    [accessToken, fetchUtilisateurs],
  );

  const handleSubmitPassword = useCallback(
    async (userId: string) => {
      if (!accessToken || newPassword.length < 8) return;
      setPasswordSubmitting(true);
      setActionError((prev) => ({ ...prev, [userId]: "" }));
      try {
        await apiFetch(`/utilisateurs/${userId}/password`, {
          method: "PATCH",
          token: accessToken,
          body: { nouveauMotDePasse: newPassword },
        });
        setNewPassword("");
        setExpandedRow(null);
      } catch (e) {
        setActionError((prev) => ({ ...prev, [userId]: e instanceof ApiError ? e.message : "Erreur réseau" }));
      } finally {
        setPasswordSubmitting(false);
      }
    },
    [accessToken, newPassword],
  );

  const handleToggleRole = useCallback(
    async (u: UtilisateurItem, role: RoleItem) => {
      if (!accessToken) return;
      const hasRole = u.roles.some((r) => r.id === role.id);
      setRoleActionPending(role.id);
      setActionError((prev) => ({ ...prev, [u.id]: "" }));
      try {
        await apiFetch(`/utilisateurs/${u.id}/roles/${role.id}`, {
          method: hasRole ? "DELETE" : "POST",
          token: accessToken,
        });
        await fetchUtilisateurs();
      } catch (e) {
        setActionError((prev) => ({ ...prev, [u.id]: e instanceof ApiError ? e.message : "Erreur réseau" }));
      } finally {
        setRoleActionPending(null);
      }
    },
    [accessToken, fetchUtilisateurs],
  );

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

              <div className="mb-4 flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Rechercher un utilisateur…"
                  value={search}
                  onChange={(e) => {
                    setPage(1);
                    setSearch(e.target.value);
                  }}
                  className="w-full max-w-xs rounded border border-navy/20 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowCreateForm((v) => !v)}
                  className="flex flex-shrink-0 items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-navy transition-opacity hover:opacity-90"
                >
                  <UserPlus size={16} strokeWidth={1.75} />
                  Créer un compte
                </button>
              </div>

              {showCreateForm && (
                <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <input
                      type="text"
                      placeholder="Prénom"
                      value={createForm.prenom}
                      onChange={(e) => setCreateForm((f) => ({ ...f, prenom: e.target.value }))}
                      className="rounded border border-navy/20 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Nom"
                      value={createForm.nom}
                      onChange={(e) => setCreateForm((f) => ({ ...f, nom: e.target.value }))}
                      className="rounded border border-navy/20 px-3 py-2 text-sm"
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={createForm.email}
                      onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                      className="rounded border border-navy/20 px-3 py-2 text-sm"
                    />
                    <input
                      type="password"
                      placeholder="Mot de passe (min. 8, majuscule, minuscule, chiffre)"
                      value={createForm.motDePasse}
                      onChange={(e) => setCreateForm((f) => ({ ...f, motDePasse: e.target.value }))}
                      className="rounded border border-navy/20 px-3 py-2 text-sm"
                    />
                  </div>
                  {createError && <p className="mt-2 text-xs text-status-red">{createError}</p>}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={handleCreateUser}
                      disabled={
                        createSubmitting ||
                        !createForm.nom ||
                        !createForm.prenom ||
                        !createForm.email ||
                        createForm.motDePasse.length < 8
                      }
                      className="rounded bg-gold px-3 py-2 text-xs font-semibold text-navy disabled:opacity-40"
                    >
                      Créer
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false);
                        setCreateError("");
                      }}
                      className="rounded border border-navy/20 px-3 py-2 text-xs text-navy"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}

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
                    <table className="w-full table-fixed text-left text-sm">
                      <thead className="border-b border-navy/10 text-navy/50">
                        <tr>
                          <th className="w-2/5 px-4 py-3 font-medium">Utilisateur</th>
                          <th className="w-1/4 px-4 py-3 font-medium">Rôles</th>
                          <th className="w-[15%] px-4 py-3 font-medium">Statut</th>
                          <th className="w-1/5 px-4 py-3 text-right font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {utilisateurs.data.map((u) => (
                          <Fragment key={u.id}>
                            <tr className="border-b border-navy/5 last:border-0">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-navy">
                                    {(u.prenom[0] ?? "").toUpperCase()}
                                    {(u.nom[0] ?? "").toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-semibold text-navy">
                                      {u.prenom} {u.nom}
                                    </p>
                                    <p className="truncate text-[10px] text-navy/50">{u.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {u.roles.length === 0 && <span className="text-xs text-navy/40">—</span>}
                                  {u.roles.map((r) => (
                                    <span
                                      key={r.id}
                                      className="inline-flex items-center rounded-full bg-navy/5 px-2 py-0.5 text-xs font-medium text-navy"
                                    >
                                      {r.nomRole}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                                    u.estActif ? "text-status-green" : "text-navy/50"
                                  }`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${
                                      u.estActif ? "bg-status-green" : "bg-navy/30"
                                    }`}
                                  />
                                  {u.estActif ? "Actif" : "Inactif"}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    title={u.estActif ? "Désactiver" : "Activer"}
                                    onClick={() => handleToggleActif(u)}
                                    disabled={pendingToggle === u.id}
                                    className="rounded p-1.5 text-navy/50 hover:bg-navy/5 hover:text-navy disabled:opacity-40"
                                  >
                                    <Power size={16} strokeWidth={1.75} />
                                  </button>
                                  <button
                                    type="button"
                                    title="Réinitialiser le mot de passe"
                                    onClick={() =>
                                      setExpandedRow(
                                        expandedRow?.userId === u.id && expandedRow.mode === "password"
                                          ? null
                                          : { userId: u.id, mode: "password" },
                                      )
                                    }
                                    className="rounded p-1.5 text-navy/50 hover:bg-navy/5 hover:text-navy"
                                  >
                                    <KeyRound size={16} strokeWidth={1.75} />
                                  </button>
                                  <button
                                    type="button"
                                    title="Gérer les rôles"
                                    onClick={() =>
                                      setExpandedRow(
                                        expandedRow?.userId === u.id && expandedRow.mode === "roles"
                                          ? null
                                          : { userId: u.id, mode: "roles" },
                                      )
                                    }
                                    className="rounded p-1.5 text-navy/50 hover:bg-navy/5 hover:text-navy"
                                  >
                                    <Shield size={16} strokeWidth={1.75} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {actionError[u.id] && (
                              <tr>
                                <td colSpan={4} className="px-4 pb-2 text-xs text-status-red">
                                  {actionError[u.id]}
                                </td>
                              </tr>
                            )}
                            {expandedRow?.userId === u.id && expandedRow.mode === "password" && (
                              <tr className="border-b border-navy/5 bg-page">
                                <td colSpan={4} className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="password"
                                      placeholder="Nouveau mot de passe (min. 8, majuscule, minuscule, chiffre)"
                                      value={newPassword}
                                      onChange={(e) => setNewPassword(e.target.value)}
                                      className="w-full max-w-sm rounded border border-navy/20 px-3 py-2 text-sm"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSubmitPassword(u.id)}
                                      disabled={passwordSubmitting || newPassword.length < 8}
                                      className="rounded bg-gold px-3 py-2 text-xs font-semibold text-navy disabled:opacity-40"
                                    >
                                      Confirmer
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setExpandedRow(null);
                                        setNewPassword("");
                                      }}
                                      className="rounded border border-navy/20 px-3 py-2 text-xs text-navy"
                                    >
                                      Annuler
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )}
                            {expandedRow?.userId === u.id && expandedRow.mode === "roles" && (
                              <tr className="border-b border-navy/5 bg-page">
                                <td colSpan={4} className="px-4 py-3">
                                  <div className="flex flex-wrap gap-2">
                                    {roles?.map((role) => {
                                      const active = u.roles.some((r) => r.id === role.id);
                                      return (
                                        <button
                                          key={role.id}
                                          type="button"
                                          onClick={() => handleToggleRole(u, role)}
                                          disabled={roleActionPending === role.id}
                                          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
                                            active ? "bg-gold/10 text-gold" : "bg-navy/5 text-navy/50 hover:bg-navy/10"
                                          }`}
                                        >
                                          {role.nomRole}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
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
