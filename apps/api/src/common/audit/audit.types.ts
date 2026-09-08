import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../database/prisma/prisma.service';

/**
 * Client accepté par AuditService.
 *
 * `Prisma.TransactionClient` est le type du `tx` fourni par `$transaction`.
 * Accepter les deux permet d'écrire l'audit DANS la transaction métier quand
 * l'atomicité est requise, et hors transaction sinon.
 */
export type AuditWriteClient = PrismaService | Prisma.TransactionClient;

/**
 * Actions métier génériques. Volontairement disjointes des actions
 * d'authentification de `AuditAction`, qui restent écrites par AuthService.
 */
export type AuditActionMetier = 'CREATE' | 'UPDATE' | 'DELETE';

/**
 * Entités auditables.
 *
 * C'est ici que se trouve la sécurité de typage : `AuditLog.entity` est une
 * colonne texte libre en base, pour ne pas imposer une migration à chaque
 * nouvelle entité, mais aucun appelant ne peut écrire une valeur hors de cette
 * union. Ajouter une entité = ajouter une ligne ici, sans migration.
 */
export type AuditEntity =
  // Identity
  | 'Utilisateur'
  | 'Role'
  | 'Permission'
  // Bibliothèque
  | 'Ouvrage'
  | 'Emprunt'
  | 'DocumentAcademique'
  | 'Abonne'
  // Pédagogie
  | 'CoursClasse'
  | 'Epreuve'
  | 'NoteEtudiant'
  // Scolarité
  | 'Abandon'
  // Support informatique
  | 'Requete'
  | 'Poste'
  | 'CoursSupportIT'
  | 'InscriptionCoursSupportIT'
  | 'Intervention';

/** Une entrée d'audit métier. */
export interface AuditEntry {
  action: AuditActionMetier;
  /** Type de l'entité cible. */
  entity: AuditEntity;
  /** Identifiant de l'entité cible. Pour un DELETE, il doit être capturé AVANT la suppression. */
  entityId: string;
  /**
   * Acteur de l'action. `null` est accepté (tâche système, seed), mais doit
   * rester l'exception : un audit sans acteur ne répond pas à « qui ».
   */
  actorId?: string | null;
  /** Contexte complémentaire. Assaini avant écriture, cf. AuditService. */
  details?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}
