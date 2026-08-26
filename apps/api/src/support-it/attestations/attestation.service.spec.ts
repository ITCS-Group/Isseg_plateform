import { AttestationService } from './attestation.service';

describe('AttestationService (stub provisoire)', () => {
  const service = new AttestationService();

  it('génère un numéro de référence unique et un contenu incluant les paramètres', () => {
    const dateReussite = new Date('2026-08-20T00:00:00.000Z');
    const result = service.genererAttestationSupportIT({
      participantNom: 'Bah',
      participantPrenom: 'Mamadou',
      coursTitre: 'Bureautique niveau 1',
      dateReussite,
    });

    expect(result.numeroReference).toMatch(/^ATT-SUPPORT-IT-/);
    expect(result.contenu).toContain('Mamadou Bah');
    expect(result.contenu).toContain('Bureautique niveau 1');
    expect(result.contenu).toContain('2026-08-20');
  });

  it('deux appels produisent des références différentes', () => {
    const params = {
      participantNom: 'Bah',
      participantPrenom: 'Mamadou',
      coursTitre: 'Bureautique niveau 1',
      dateReussite: new Date(),
    };
    const a = service.genererAttestationSupportIT(params);
    const b = service.genererAttestationSupportIT(params);
    expect(a.numeroReference).not.toBe(b.numeroReference);
  });
});
