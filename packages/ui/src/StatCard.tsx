"use client";

import type { LucideIcon } from "lucide-react";

type StatCardStatus = "loading" | "ready" | "error" | "coming-soon";

interface StatCardProps {
  label: string;
  icon: LucideIcon;
  status: StatCardStatus;
  value?: string;
  delta?: string;
  deltaTone?: "positive" | "negative";
  errorMessage?: string;
}

export function StatCard({ label, icon: Icon, status, value, delta, deltaTone, errorMessage }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-5">
      <div className="mb-3 flex items-start justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-page text-navy">
          <Icon size={18} strokeWidth={1.75} />
        </span>
        {status === "ready" && delta && (
          <span
            className={`text-xs font-medium ${
              deltaTone === "negative" ? "text-status-red" : "text-status-green"
            }`}
          >
            {delta}
          </span>
        )}
      </div>

      <p className="text-sm text-navy/50">{label}</p>

      {status === "ready" && <p className="mt-1 text-2xl font-semibold text-navy">{value}</p>}

      {status === "loading" && (
        <div className="mt-2 h-7 w-16 animate-pulse rounded bg-navy/10" aria-label="Chargement…" />
      )}

      {status === "error" && (
        <p className="mt-1 text-sm text-status-red" title={errorMessage}>
          Erreur de chargement
        </p>
      )}

      {status === "coming-soon" && (
        <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold">
          Bientôt disponible
        </p>
      )}
    </div>
  );
}
