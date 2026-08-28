/**
 * Contrat générique des réponses paginées du backend : `{ data, meta }`.
 * Miroir exact de `PaginationMetaDto` (apps/api/src/common/dto/pagination.dto.ts).
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}
