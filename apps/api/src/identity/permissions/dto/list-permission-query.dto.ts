import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * Paramètres de `GET /api/v1/permissions`. Aucun filtre métier n'existe sur
 * cet endpoint : le DTO n'apporte pour l'instant que la pagination héritée de
 * `PaginationDto` (`page`, `limit`).
 */
export class ListPermissionQueryDto extends PaginationDto {}
