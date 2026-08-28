"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError } from "./api";
import type { Paginated, PaginationMeta } from "./pagination";

export type PaginatedFetchStatus = "loading" | "ready" | "error";

export interface UsePaginatedFetchOptions {
  /** Passé tel quel à apiFetch — le composant appelant reste responsable de sa disponibilité. */
  token?: string | null;
  limit?: number;
  /** Paramètres de requête additionnels (ex. { statut: "OUVERTE" }) — page/limit gérés par le hook. */
  params?: Record<string, string>;
  /** Si false, aucun appel n'est déclenché (ex. tant que le token n'est pas encore disponible). */
  enabled?: boolean;
}

export interface UsePaginatedFetchResult<T> {
  data: T[] | null;
  meta: PaginationMeta | null;
  status: PaginatedFetchStatus;
  error: string;
  page: number;
  setPage: (page: number) => void;
  refetch: () => void;
}

/**
 * Consomme un endpoint paginé `{ data, meta }` (cf. pagination.ts) au-dessus
 * d'apiFetch, sans le modifier — extension additive. Générique : ne suppose
 * rien d'un domaine métier particulier.
 */
export function usePaginatedFetch<T>(
  path: string,
  options: UsePaginatedFetchOptions = {},
): UsePaginatedFetchResult<T> {
  const { token, limit = 20, params, enabled = true } = options;

  const [page, setPage] = useState(1);
  const [data, setData] = useState<T[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [status, setStatus] = useState<PaginatedFetchStatus>("loading");
  const [error, setError] = useState("");
  const [refetchIndex, setRefetchIndex] = useState(0);

  const paramsKey = JSON.stringify(params ?? {});

  const fetchPage = useCallback(async () => {
    if (!enabled) return;
    setStatus("loading");
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...JSON.parse(paramsKey),
      });
      const result = await apiFetch<Paginated<T>>(`${path}?${query.toString()}`, { token });
      setData(result.data);
      setMeta(result.meta);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur réseau");
      setStatus("error");
    }
  }, [path, page, limit, token, enabled, paramsKey]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage, refetchIndex]);

  const refetch = useCallback(() => setRefetchIndex((i) => i + 1), []);

  return { data, meta, status, error, page, setPage, refetch };
}
