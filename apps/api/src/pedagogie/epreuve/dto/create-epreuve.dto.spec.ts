import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TypeEpreuve } from '@prisma/client';
import { CreateEpreuveDto } from './create-epreuve.dto';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

async function errorsFor(payload: unknown) {
  const dto = plainToInstance(CreateEpreuveDto, payload);
  return validate(dto as object);
}

describe('CreateEpreuveDto', () => {
  describe('cas valides', () => {
    it('accepte coursClasseId (UUID v4) + type valides', async () => {
      const errors = await errorsFor({ coursClasseId: VALID_UUID, type: TypeEpreuve.CC });
      expect(errors).toHaveLength(0);
    });

    it.each(Object.values(TypeEpreuve))('accepte chaque valeur de TypeEpreuve (%s)', async (type) => {
      const errors = await errorsFor({ coursClasseId: VALID_UUID, type });
      expect(errors).toHaveLength(0);
    });
  });

  describe('cas invalides', () => {
    it('rejette coursClasseId absent', async () => {
      const errors = await errorsFor({ type: TypeEpreuve.CC });
      expect(errors.some((e) => e.property === 'coursClasseId')).toBe(true);
    });

    it('rejette coursClasseId non-UUID', async () => {
      const errors = await errorsFor({ coursClasseId: 'not-a-uuid', type: TypeEpreuve.CC });
      expect(errors.some((e) => e.property === 'coursClasseId')).toBe(true);
    });

    it('rejette type absent', async () => {
      const errors = await errorsFor({ coursClasseId: VALID_UUID });
      expect(errors.some((e) => e.property === 'type')).toBe(true);
    });

    it('rejette une valeur de type inconnue', async () => {
      const errors = await errorsFor({ coursClasseId: VALID_UUID, type: 'INVALIDE' });
      expect(errors.some((e) => e.property === 'type')).toBe(true);
    });
  });
});
