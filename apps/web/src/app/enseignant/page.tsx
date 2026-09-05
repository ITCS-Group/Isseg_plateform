"use client";

import { useEffect, useState, useCallback } from "react";
import { BookOpen, ClipboardList, Calendar, MessageSquare, Pencil, Check, X } from "lucide-react";
import { AppSidebar, AppHeader, type AppSidebarItem } from "@isseg/ui";
import { apiFetch, ApiError } from "@/lib/api";
import { useProtectedRoute } from "@/lib/useProtectedRoute";

interface CoursClasse {
  id: string;
  coursCode: string;
  coursTitre: string;
  classeCode: string;
  classeLibelle: string;
  classeNiveau: string;
}

interface NoteEtudiant {
  id: string;
  noteBrute: number;
  epreuveType: string;
  coursCode: string;
  coursTitre: string;
  classeLibelle: string;
  etudiantNom: string;
  etudiantPrenom: string;
  etudiantMatricule: string | null;
}

type Tab = "cours" | "notes" | "emploi" | "messages";

export default function TeacherDashboardPage() {
  const { user, accessToken, status, logout } = useProtectedRoute("/enseignant");
  const [tab, setTab] = useState<Tab>("cours");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [cours, setCours] = useState<CoursClasse[] | null>(null);
  const [coursError, setCoursError] = useState("");
  const [notes, setNotes] = useState<NoteEtudiant[] | null>(null);
  const [notesError, setNotesError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchCours = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await apiFetch<CoursClasse[]>("/cours-classes", { token: accessToken });
      setCours(data);
    } catch (e) {
      setCoursError(e instanceof ApiError ? e.message : "Erreur réseau");
    }
  }, [accessToken]);

  const fetchNotes = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await apiFetch<NoteEtudiant[]>("/notes-etudiant", { token: accessToken });
      setNotes(data);
    } catch (e) {
      setNotesError(e instanceof ApiError ? e.message : "Erreur réseau");
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) {
      fetchCours();
      fetchNotes();
    }
  }, [accessToken, fetchCours, fetchNotes]);

  async function handleSaveNote(noteId: string) {
    const noteBrute = Number(editValue);
    if (Number.isNaN(noteBrute) || noteBrute < 0 || noteBrute > 20) {
      return;
    }
    setSavingId(noteId);
    try {
      await apiFetch(`/notes-etudiant/${noteId}`, {
        method: "PATCH",
        token: accessToken,
        body: { noteBrute, motif: "Modification via portail" },
      });
      await fetchNotes();
      setEditingId(null);
    } catch {
      // l'erreur reste affichée via notesError au prochain fetch si besoin
    } finally {
      setSavingId(null);
    }
  }

  if (status !== "ready" || !user) {
    return <div className="flex min-h-screen items-center justify-center text-navy/50">Chargement…</div>;
  }

  const items: AppSidebarItem[] = [
    { key: "cours", label: "Mes cours", icon: BookOpen },
    { key: "notes", label: "Notes", icon: ClipboardList, badge: notes?.length },
    { key: "emploi", label: "Emploi du temps", icon: Calendar },
    { key: "messages", label: "Messages", icon: MessageSquare },
  ];

  return (
    <div className="flex min-h-screen">
      <AppSidebar
        banner="Espace enseignant"
        items={items}
        activeKey={tab}
        onSelect={(key) => setTab(key as Tab)}
        userName={`${user.prenom} ${user.nom}`}
        userRole={user.roles.join(", ")}
        onLogout={logout}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      <div className="flex flex-1 flex-col">
        <AppHeader
          userName={`${user.prenom} ${user.nom}`}
          userRole={user.roles.join(", ")}
          onMenuClick={() => setMobileNavOpen(true)}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {tab === "cours" && (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-navy">Mes cours</h2>
              {coursError && <p className="text-sm text-status-red">{coursError}</p>}
              {cours === null && !coursError && <p className="text-sm text-navy/50">Chargement…</p>}
              {cours?.length === 0 && <p className="text-sm text-navy/50">Aucun cours pour le moment.</p>}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cours?.map((c) => (
                  <div key={c.id} className="rounded-xl bg-white p-4 shadow-sm">
                    <p className="text-xs font-medium text-gold">{c.coursCode}</p>
                    <p className="mt-1 font-semibold text-navy">{c.coursTitre}</p>
                    <p className="mt-2 text-sm text-navy/60">
                      {c.classeLibelle} · {c.classeCode} · {c.classeNiveau}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === "notes" && (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-navy">Notes</h2>
              {notesError && <p className="text-sm text-status-red">{notesError}</p>}
              {notes === null && !notesError && <p className="text-sm text-navy/50">Chargement…</p>}
              {notes?.length === 0 && <p className="text-sm text-navy/50">Aucune note pour le moment.</p>}
              {notes && notes.length > 0 && (
                <>
                  {/* Vue mobile : cartes empilées (sous md) */}
                  <div className="space-y-3 md:hidden">
                    {notes.map((n) => {
                      const isEditing = editingId === n.id;
                      return (
                        <div key={n.id} className="rounded-xl bg-white p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-navy">
                                {n.etudiantPrenom} {n.etudiantNom}
                              </p>
                              <p className="text-xs text-navy/50">{n.etudiantMatricule ?? "—"}</p>
                            </div>
                            {isEditing ? (
                              <div className="flex flex-shrink-0 gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleSaveNote(n.id)}
                                  disabled={savingId === n.id}
                                  className="rounded bg-status-green/10 p-1.5 text-status-green"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="rounded bg-navy/5 p-1.5 text-navy/50"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(n.id);
                                  setEditValue(String(n.noteBrute));
                                }}
                                className="flex-shrink-0 rounded p-1.5 text-navy/40 hover:bg-navy/5 hover:text-navy"
                              >
                                <Pencil size={14} />
                              </button>
                            )}
                          </div>
                          <p className="mt-2 truncate text-sm text-navy/60">
                            <span className="font-medium">{n.coursCode}</span> {n.coursTitre} ·{" "}
                            {n.epreuveType}
                          </p>
                          <div className="mt-2">
                            {isEditing ? (
                              <input
                                type="number"
                                min={0}
                                max={20}
                                step={0.5}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-20 rounded border border-navy/20 px-2 py-1 text-sm"
                                autoFocus
                              />
                            ) : (
                              <span className="text-lg font-semibold text-navy">{n.noteBrute}/20</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Vue tablette/desktop : tableau (à partir de md) */}
                  <div className="hidden overflow-x-auto rounded-xl bg-white shadow-sm md:block">
                    <table className="w-full text-left text-sm">
                    <thead className="border-b border-navy/10 text-navy/50">
                      <tr>
                        <th className="px-4 py-3 font-medium">Étudiant</th>
                        <th className="px-4 py-3 font-medium">Matricule</th>
                        <th className="px-4 py-3 font-medium">Cours</th>
                        <th className="px-4 py-3 font-medium">Type</th>
                        <th className="px-4 py-3 font-medium">Note</th>
                        <th className="px-4 py-3 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {notes.map((n) => {
                        const isEditing = editingId === n.id;
                        return (
                          <tr key={n.id} className="border-b border-navy/5 last:border-0">
                            <td className="px-4 py-3">
                              {n.etudiantPrenom} {n.etudiantNom}
                            </td>
                            <td className="px-4 py-3 text-navy/60">{n.etudiantMatricule ?? "—"}</td>
                            <td className="px-4 py-3">
                              <span className="font-medium">{n.coursCode}</span>{" "}
                              <span className="text-navy/50">{n.coursTitre}</span>
                            </td>
                            <td className="px-4 py-3 text-navy/60">{n.epreuveType}</td>
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <input
                                  type="number"
                                  min={0}
                                  max={20}
                                  step={0.5}
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="w-16 rounded border border-navy/20 px-2 py-1 text-sm"
                                  autoFocus
                                />
                              ) : (
                                <span className="font-semibold text-navy">{n.noteBrute}/20</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveNote(n.id)}
                                    disabled={savingId === n.id}
                                    className="rounded bg-status-green/10 p-1.5 text-status-green"
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingId(null)}
                                    className="rounded bg-navy/5 p-1.5 text-navy/50"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingId(n.id);
                                    setEditValue(String(n.noteBrute));
                                  }}
                                  className="rounded p-1.5 text-navy/40 hover:bg-navy/5 hover:text-navy"
                                >
                                  <Pencil size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          )}

          {tab === "emploi" && (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-navy">Emploi du temps</h2>
              <p className="text-sm text-navy/50">
                Fonctionnalité à venir — aucune donnée backend disponible pour le moment.
              </p>
            </section>
          )}

          {tab === "messages" && (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-navy">Messages</h2>
              <p className="text-sm text-navy/50">
                Fonctionnalité à venir — aucune donnée backend disponible pour le moment.
              </p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
