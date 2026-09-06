import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * Query de listing des abonnés — pagination uniquement pour l'instant.
 * Aucun filtre métier n'existait sur `GET /abonnes` avant la pagination :
 * ce DTO n'en introduit aucun, il se contente d'exposer `page`/`limit`.
 */
export class ListAbonneQueryDto extends PaginationDto {}
