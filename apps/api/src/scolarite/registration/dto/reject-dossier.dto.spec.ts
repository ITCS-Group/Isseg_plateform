import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RejectDossierDto } from './reject-dossier.dto';
import { TransitionDto } from './transition.dto';

async function errorsFor(cls: typeof RejectDossierDto, payload: unknown) {
  const dto = plainToInstance(cls, payload);
  return validate(dto as object);
}

describe('RejectDossierDto', () => {
  describe('motifRejet obligatoire non vide', () => {
    it.each([
      ['undefined', undefined],
      ['chaîne vide', ''],
      ['espaces seulement', '   '],
    ])('rejette un motif %s', async (_label, motifRejet) => {
      const errors = await errorsFor(RejectDossierDto, { expectedVersion: 1, motifRejet });
      const motifError = errors.find((e) => e.property === 'motifRejet');
      expect(motifError).toBeDefined();
    });

    it('accepte un motif valide (et le trim)', async () => {
      const dto = plainToInstance(RejectDossierDto, {
        expectedVersion: 1,
        motifRejet: '  Pièces manquantes  ',
      });
      const errors = await validate(dto as object);
      expect(errors).toHaveLength(0);
      expect(dto.motifRejet).toBe('Pièces manquantes');
    });
  });

  describe('expectedVersion (hérité de TransitionDto)', () => {
    it('refuse une version absente', async () => {
      const errors = await errorsFor(RejectDossierDto, { motifRejet: 'x' });
      expect(errors.some((e) => e.property === 'expectedVersion')).toBe(true);
    });

    it('refuse une version < 1', async () => {
      const errors = await errorsFor(RejectDossierDto, { expectedVersion: 0, motifRejet: 'x' });
      expect(errors.some((e) => e.property === 'expectedVersion')).toBe(true);
    });
  });
});

describe('TransitionDto', () => {
  it('accepte une version valide sans commentaire', async () => {
    const dto = plainToInstance(TransitionDto, { expectedVersion: 2 });
    const errors = await validate(dto as object);
    expect(errors).toHaveLength(0);
  });

  it('refuse expectedVersion = 0', async () => {
    const dto = plainToInstance(TransitionDto, { expectedVersion: 0 });
    const errors = await validate(dto as object);
    expect(errors.some((e) => e.property === 'expectedVersion')).toBe(true);
  });
});
