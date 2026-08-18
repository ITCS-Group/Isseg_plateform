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
  });
});
