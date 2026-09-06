import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TypeEpreuve } from '@prisma/client';
import { ListEpreuveQueryDto } from './list-epreuve-query.dto';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

async function errorsFor(payload: unknown) {
  const dto = plainToInstance(ListEpreuveQueryDto, payload);
  return validate(dto as object);
}

describe('ListEpreuveQueryDto', () => {
  describe('cas valides', () => {
    it('accepte l’absence de tout filtre', async () => {
      const errors = await errorsFor({});
      expect(errors).toHaveLength(0);
    });

    it('accepte coursClasseId seul', async () => {
      const errors = await errorsFor({ coursClasseId: VALID_UUID });
      expect(errors).toHaveLength(0);
    });

    it('accepte type seul', async () => {
      const errors = await errorsFor({ type: TypeEpreuve.TP });
      expect(errors).toHaveLength(0);
    });

    it('accepte coursClasseId + type combinés', async () => {
      const errors = await errorsFor({ coursClasseId: VALID_UUID, type: TypeEpreuve.EXAMEN });
      expect(errors).toHaveLength(0);
    });

    it('applique les valeurs par défaut de PaginationDto quand page/limit sont absents', async () => {
      const dto = plainToInstance(ListEpreuveQueryDto, {});
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(20);
    });

    it('transforme page/limit reçus en chaîne (query string) en nombres', async () => {
      const dto = plainToInstance(ListEpreuveQueryDto, { page: '3', limit: '50' });
      expect(dto.page).toBe(3);
      expect(dto.limit).toBe(50);
      expect(await validate(dto as object)).toHaveLength(0);
    });

    it('accepte limit à la borne haute (100)', async () => {
      const errors = await errorsFor({ limit: 100 });
      expect(errors).toHaveLength(0);
    });

    it('accepte pagination + filtre existant combinés', async () => {
      const errors = await errorsFor({ page: 2, limit: 10, coursClasseId: VALID_UUID });
      expect(errors).toHaveLength(0);
    });
  });

  describe('cas invalides', () => {
    it('rejette coursClasseId non-UUID', async () => {
      const errors = await errorsFor({ coursClasseId: 'not-a-uuid' });
      expect(errors.some((e) => e.property === 'coursClasseId')).toBe(true);
    });

    it('rejette une valeur de type inconnue', async () => {
      const errors = await errorsFor({ type: 'INVALIDE' });
      expect(errors.some((e) => e.property === 'type')).toBe(true);
    });

    // Comportement hérité de PaginationDto (@Max(100)) : un limit trop grand est
    // *rejeté* par la validation (→ 400), il n'est pas silencieusement plafonné.
    it('rejette limit au-delà de 100', async () => {
      const errors = await errorsFor({ limit: 101 });
      expect(errors.some((e) => e.property === 'limit' && e.constraints?.max)).toBe(true);
    });

    it('rejette page < 1', async () => {
      const errors = await errorsFor({ page: 0 });
      expect(errors.some((e) => e.property === 'page')).toBe(true);
    });

    it('rejette un limit non entier', async () => {
      const errors = await errorsFor({ limit: 1.5 });
      expect(errors.some((e) => e.property === 'limit')).toBe(true);
    });
  });
});
