import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * Paramètres de `GET /api/v1/roles`. Aucun filtre métier n'existe sur cet
 * endpoint : le DTO n'apporte pour l'instant que la pagination héritée de
 * `PaginationDto` (`page`, `limit`).
 */
export class ListRoleQueryDto extends PaginationDto {}
