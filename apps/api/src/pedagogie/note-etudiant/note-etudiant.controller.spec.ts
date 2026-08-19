import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { NoteEtudiantController } from './note-etudiant.controller';
import { NoteEtudiantService } from './note-etudiant.service';

/**
 * Portée : routes de consultation (findAll — Étape 4, findOne — Étape 5).
 * create/remove ne sont pas couvertes ici, hors périmètre de ces étapes.
 */
describe('NoteEtudiantController — GET /notes-etudiant (findAll)', () => {
  const reflector = new Reflector();

  it('expose bien une méthode findAll', () => {
    expect(typeof NoteEtudiantController.prototype.findAll).toBe('function');
  });

  it('@Roles() de findAll : ADMIN, RESPONSABLE_PEDAGOGIQUE, CHEF_DEPARTEMENT, ENSEIGNANT', () => {
    const roles = reflector.get<string[]>(ROLES_KEY, NoteEtudiantController.prototype.findAll);
    expect(roles).toEqual(['ADMIN', 'RESPONSABLE_PEDAGOGIQUE', 'CHEF_DEPARTEMENT', 'ENSEIGNANT']);
  });

  it('transmet le ListNoteEtudiantQueryDto et l’utilisateur courant tels quels au service', async () => {
    const serviceMock = { findAll: jest.fn().mockResolvedValue([]) };
    const controller = new NoteEtudiantController(serviceMock as unknown as NoteEtudiantService);
    const query = { epreuveId: 'ep-1', inscriptionId: 'insc-1' };
    const user = { id: 'user-1', email: 'e@t.local', nom: 'N', prenom: 'P', estActif: true, roles: ['ENSEIGNANT'], permissions: [] };

    await controller.findAll(query, user);

    expect(serviceMock.findAll).toHaveBeenCalledWith(query, user);
  });
});

/**
 * ParseUUIDPipe : aucun précédent dans le projet ne teste les pipes de
 * paramètre via les métadonnées NestJS internes (mécanisme non documenté,
 * non utilisé ailleurs) — non inventé ici. Sa présence sur `findOne(':id')`
 * est vérifiée par lecture directe du code (audit), à l'identique de
 * `EpreuveController.findOne`.
 */
describe('NoteEtudiantController — GET /notes-etudiant/:id (findOne)', () => {
  const reflector = new Reflector();

  it('expose bien une méthode findOne', () => {
    expect(typeof NoteEtudiantController.prototype.findOne).toBe('function');
  });

  it('@Roles() de findOne : ADMIN, RESPONSABLE_PEDAGOGIQUE, CHEF_DEPARTEMENT, ENSEIGNANT', () => {
    const roles = reflector.get<string[]>(ROLES_KEY, NoteEtudiantController.prototype.findOne);
    expect(roles).toEqual(['ADMIN', 'RESPONSABLE_PEDAGOGIQUE', 'CHEF_DEPARTEMENT', 'ENSEIGNANT']);
  });

  it('transmet l’id exactement tel que reçu au service', async () => {
    const serviceMock = { findOne: jest.fn().mockResolvedValue({}) };
    const controller = new NoteEtudiantController(serviceMock as unknown as NoteEtudiantService);

    await controller.findOne('note-1');

    expect(serviceMock.findOne).toHaveBeenCalledWith('note-1');
  });
});

/**
 * ParseUUIDPipe : même remarque que pour findOne — non testé via métadonnées,
 * aucun précédent dans le projet ; présence vérifiée par lecture du code.
 */
describe('NoteEtudiantController — PATCH /notes-etudiant/:id (update)', () => {
  const reflector = new Reflector();

  it('expose bien une méthode update', () => {
    expect(typeof NoteEtudiantController.prototype.update).toBe('function');
  });

  it('@Roles() de update : ADMIN, RESPONSABLE_PEDAGOGIQUE, ENSEIGNANT', () => {
    const roles = reflector.get<string[]>(ROLES_KEY, NoteEtudiantController.prototype.update);
    expect(roles).toEqual(['ADMIN', 'RESPONSABLE_PEDAGOGIQUE', 'ENSEIGNANT']);
  });

  it('transmet id, DTO et utilisateur courant exactement au service', async () => {
    const serviceMock = { update: jest.fn().mockResolvedValue({}) };
    const controller = new NoteEtudiantController(serviceMock as unknown as NoteEtudiantService);
    const dto = { noteBrute: 16, motif: 'Correction' };
    const user = { id: 'user-1', email: 'e@t.local', nom: 'N', prenom: 'P', estActif: true, roles: ['ENSEIGNANT'], permissions: [] };

    await controller.update('note-1', dto, user);

    expect(serviceMock.update).toHaveBeenCalledWith('note-1', dto, user);
  });
});

/**
 * remove() est ADMIN-only : aucune métadonnée @Roles() locale n'est posée,
 * la route hérite du défaut de classe @Roles('ADMIN'). ParseUUIDPipe non
 * testé via métadonnées (aucun précédent fiable dans le projet) — sa
 * présence est vérifiée par lecture directe du code.
 */
describe('NoteEtudiantController — DELETE /notes-etudiant/:id (remove)', () => {
  const reflector = new Reflector();

  it('expose bien une méthode remove', () => {
    expect(typeof NoteEtudiantController.prototype.remove).toBe('function');
  });

  it('@Roles() de remove : aucune métadonnée locale → hérite ADMIN de la classe', () => {
    const localRoles = reflector.get<string[]>(ROLES_KEY, NoteEtudiantController.prototype.remove);
    expect(localRoles).toBeUndefined();

    const effective =
      reflector.get<string[]>(ROLES_KEY, NoteEtudiantController.prototype.remove) ??
      reflector.get<string[]>(ROLES_KEY, NoteEtudiantController);
    expect(effective).toEqual(['ADMIN']);
  });

  it('transmet l’id exactement tel que reçu au service, sans utilisateur courant', async () => {
    const serviceMock = { remove: jest.fn().mockResolvedValue(undefined) };
    const controller = new NoteEtudiantController(serviceMock as unknown as NoteEtudiantService);

    await controller.remove('note-1');

    expect(serviceMock.remove).toHaveBeenCalledWith('note-1');
    expect(serviceMock.remove.mock.calls[0]).toHaveLength(1);
  });
});
