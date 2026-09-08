import { AuditAction } from '@prisma/client';
import { AuditService } from './audit.service';
import type { AuditWriteClient } from './audit.types';

/** Client Prisma minimal : seul `auditLog.create` est utilisé par le service. */
function makeClient() {
  return {
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  } as unknown as AuditWriteClient & {
    auditLog: { create: jest.Mock };
  };
}

function dataDuDernierAppel(client: { auditLog: { create: jest.Mock } }) {
  return client.auditLog.create.mock.calls[0][0].data;
}

describe('AuditService', () => {
  let service: AuditService;
  let client: ReturnType<typeof makeClient>;

  beforeEach(() => {
    service = new AuditService();
    client = makeClient();
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
  });

  // ── Les trois actions ──────────────────────────────────────────────────────

  it('CREATE : écrit la bonne action, la cible et l\'acteur', async () => {
    await service.record(client, {
      action: 'CREATE',
      entity: 'Utilisateur',
      entityId: 'cible-1',
      actorId: 'acteur-1',
    });

    expect(client.auditLog.create).toHaveBeenCalledTimes(1);
    const data = dataDuDernierAppel(client);
    expect(data.action).toBe(AuditAction.CREATE);
    expect(data.entity).toBe('Utilisateur');
    expect(data.entityId).toBe('cible-1');
    // L'acteur et la cible sont bien distincts : c'est tout l'objet du chantier.
    expect(data.utilisateurId).toBe('acteur-1');
  });

  it('UPDATE : écrit la bonne action', async () => {
    await service.record(client, {
      action: 'UPDATE',
      entity: 'Role',
      entityId: 'role-1',
      actorId: 'acteur-1',
    });

    expect(dataDuDernierAppel(client).action).toBe(AuditAction.UPDATE);
  });

  it('DELETE : écrit la bonne action', async () => {
    await service.record(client, {
      action: 'DELETE',
      entity: 'Permission',
      entityId: 'perm-1',
      actorId: 'acteur-1',
    });

    expect(dataDuDernierAppel(client).action).toBe(AuditAction.DELETE);
  });

  it('n\'écrit jamais une action d\'authentification', async () => {
    await service.record(client, {
      action: 'UPDATE',
      entity: 'Utilisateur',
      entityId: 'u-1',
      actorId: 'a-1',
    });

    const action = dataDuDernierAppel(client).action;
    expect([AuditAction.CREATE, AuditAction.UPDATE, AuditAction.DELETE]).toContain(action);
  });

  // ── Acteur ─────────────────────────────────────────────────────────────────

  it('accepte un audit sans acteur mais le signale', async () => {
    await service.record(client, {
      action: 'CREATE',
      entity: 'Ouvrage',
      entityId: 'ouv-1',
    });

    expect(dataDuDernierAppel(client).utilisateurId).toBeNull();
    expect(service['logger'].warn).toHaveBeenCalled();
  });

  // ── Données sensibles ──────────────────────────────────────────────────────

  it('masque les valeurs sensibles sans perdre la clé', async () => {
    await service.record(client, {
      action: 'UPDATE',
      entity: 'Utilisateur',
      entityId: 'u-1',
      actorId: 'a-1',
      details: {
        email: 'test@isseg.local',
        motDePasse: 'Secret123!',
        motDePasseHash: '$2b$12$abcdef',
        refreshToken: 'eyJhbGciOi',
        accessToken: 'eyJhbGciOi',
        apiKey: 'sk-live-123',
        cookie: 'session=abc',
      },
    });

    const details = dataDuDernierAppel(client).details as Record<string, unknown>;
    expect(details.email).toBe('test@isseg.local');
    for (const cle of [
      'motDePasse',
      'motDePasseHash',
      'refreshToken',
      'accessToken',
      'apiKey',
      'cookie',
    ]) {
      expect(details[cle]).toBe('[REDACTED]');
    }
  });

  it('masque aussi les valeurs sensibles imbriquées', async () => {
    await service.record(client, {
      action: 'UPDATE',
      entity: 'Utilisateur',
      entityId: 'u-1',
      actorId: 'a-1',
      details: { avant: { nom: 'Diallo', password: 'clair' } },
    });

    const details = dataDuDernierAppel(client).details as {
      avant: Record<string, unknown>;
    };
    expect(details.avant.nom).toBe('Diallo');
    expect(details.avant.password).toBe('[REDACTED]');
  });

  it('aucune valeur sensible ne subsiste dans le JSON sérialisé', async () => {
    await service.record(client, {
      action: 'UPDATE',
      entity: 'Utilisateur',
      entityId: 'u-1',
      actorId: 'a-1',
      details: { motDePasse: 'Secret123!', nested: { token: 'eyJhbGciOi' } },
    });

    const serialise = JSON.stringify(dataDuDernierAppel(client).details);
    expect(serialise).not.toContain('Secret123!');
    expect(serialise).not.toContain('eyJhbGciOi');
  });

  // ── Transaction ────────────────────────────────────────────────────────────

  it('écrit avec le client transactionnel fourni, et non un autre', async () => {
    const tx = makeClient();
    const global = makeClient();

    await service.record(tx, {
      action: 'CREATE',
      entity: 'Emprunt',
      entityId: 'e-1',
      actorId: 'a-1',
    });

    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(global.auditLog.create).not.toHaveBeenCalled();
  });

  it('laisse remonter l\'échec d\'écriture pour que la transaction annule la mutation', async () => {
    const casse = makeClient();
    casse.auditLog.create.mockRejectedValue(new Error('écriture refusée'));

    await expect(
      service.record(casse, {
        action: 'DELETE',
        entity: 'Utilisateur',
        entityId: 'u-1',
        actorId: 'a-1',
      }),
    ).rejects.toThrow('écriture refusée');
  });

  it('une mutation qui échoue avant l\'audit n\'écrit aucune entrée', async () => {
    const mutation = jest.fn().mockRejectedValue(new Error('contrainte violée'));

    await expect(
      (async () => {
        await mutation();
        await service.record(client, {
          action: 'UPDATE',
          entity: 'Poste',
          entityId: 'p-1',
          actorId: 'a-1',
        });
      })(),
    ).rejects.toThrow('contrainte violée');

    expect(client.auditLog.create).not.toHaveBeenCalled();
  });
});
