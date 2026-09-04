"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Mail, Lock, AlertCircle } from "lucide-react";
import { IssegLogo } from "@isseg/ui";
import { login } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { resolveDashboardRoute } from "@/lib/routes";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email || !motDePasse) {
      setError("Veuillez remplir tous les champs.");
      return;
    }

    setLoading(true);
    try {
      const user = await login(email, motDePasse);
      const dashboardRoute = resolveDashboardRoute(user.roles);
      if (dashboardRoute) {
        router.push(dashboardRoute);
      } else {
        setError(
          `Connexion réussie, mais aucun tableau de bord n'est encore disponible pour le rôle ${user.roles.join(", ") || "(aucun)"}.`,
        );
      }
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 429) {
          setError("Trop de tentatives. Réessayez dans une minute.");
        } else {
          setError(e.message || "Identifiants invalides.");
        }
      } else {
        setError("Impossible de contacter le serveur.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center p-4"
      style={{ background: "linear-gradient(160deg, #0B2559 0%, #0d2f6e 60%, #122f70 100%)" }}
    >
      <div className="mb-8 flex flex-col items-center text-white">
        <IssegLogo />
        <h1 className="mt-4 text-2xl font-bold tracking-wide">ISSEG</h1>
        <p className="mt-1 text-center text-sm text-white/60">
          Institut Supérieur des Sciences de l&apos;Éducation de Guinée
        </p>
      </div>

      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <h2 className="mb-1 text-xl font-semibold text-navy">Connexion</h2>
        <p className="mb-6 text-sm text-navy/60">Accédez à votre espace académique</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Adresse e-mail</label>
            <div className="flex items-center gap-2 rounded-xl border border-navy/15 px-3 py-3 transition-all focus-within:border-navy focus-within:ring-2 focus-within:ring-navy/30">
              <Mail size={16} className="text-navy/40" />
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom.nom@isseg.gn"
                className="w-full text-sm outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Mot de passe</label>
            <div className="flex items-center gap-2 rounded-xl border border-navy/15 px-3 py-3 transition-all focus-within:border-navy focus-within:ring-2 focus-within:ring-navy/30">
              <Lock size={16} className="text-navy/40" />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                placeholder="••••••••"
                className="w-full text-sm outline-none"
              />
              <button type="button" onClick={() => setShowPassword((s) => !s)} className="text-navy/40 hover:text-navy">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-navy/60">
              <input type="checkbox" className="accent-gold" />
              Se souvenir de moi
            </label>
            <button type="button" className="font-medium text-navy transition-colors hover:text-gold">
              Mot de passe oublié ?
            </button>
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-sm text-status-red">
              <AlertCircle size={14} />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gold py-3 text-sm font-semibold text-navy transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-xs text-white/40">© 2026 ISSEG · Conakry, République de Guinée</p>
    </div>
  );
}
