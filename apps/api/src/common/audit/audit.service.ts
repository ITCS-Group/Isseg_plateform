import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import type { AuditEntry, AuditWriteClient } from './audit.types';

/**
 * Clés dont la valeur ne doit JAMAIS atteindre la table AuditLog.
 *
 * Le filtrage est fait ici, au point d'écriture, et non chez l'appelant : un
 * service métier qui passerait par mégarde un DTO complet contenant un mot de
 * passe ne doit pas pouvoir provoquer une fuite. C'est une défense en
 * profondeur, elle ne dispense pas les appelants de rester minimalistes.
 */
const CLES_SENSIBLES =
  /(mot_?de_?passe|password|passwd|hash|token|secret|cookie|credential|authorization|api_?key)/i;

const VALEUR_MASQUEE = '[REDACTED]';
const PROFONDEUR_MAX = 5;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  /**
   * Écrit une entrée d'audit métier.
   *
   * Le client Prisma est un paramètre OBLIGATOIRE et explicite, jamais une
   * dépendance injectée. C'est délibéré : à l'intérieur d'un `$transaction`,
   * l'appelant doit passer `tx`, sans quoi l'audit serait validé indépendamment
   * de la mutation métier — exactement ce que DEC-01-D interdit. Rendre le
   * client implicite rendrait cette erreur invisible à la relecture.
   *
   * En cas d'échec, la méthode laisse remonter l'exception. Dans une
   * transaction, cela annule la mutation métier : mieux vaut une opération
   * refusée qu'une mutation sans trace.
   */
  async record(client: AuditWriteClient, entry: AuditEntry): Promise<void> {
    const details = this.assainir(entry.details);

    await client.auditLog.create({
      data: {
        action: AuditAction[entry.action],
        entity: entry.entity,
        entityId: entry.entityId,
        utilisateurId: entry.actorId ?? null,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
        details: details === undefined ? Prisma.DbNull : (details as Prisma.InputJsonValue),
      },
    });

    if (!entry.actorId) {
      this.logger.warn(
        `Audit sans acteur : ${entry.action} ${entry.entity} ${entry.entityId}`,
      );
    }
  }

  /**
   * Remplace récursivement la valeur de toute clé sensible par un marqueur.
   *
   * La clé est conservée : savoir qu'un mot de passe a changé fait partie de la
   * trace, connaître sa valeur non.
   */
  private assainir(
    valeur: unknown,
    profondeur = 0,
  ): Record<string, unknown> | undefined {
    if (valeur === undefined || valeur === null) return undefined;
    if (typeof valeur !== 'object' || Array.isArray(valeur)) return undefined;

    return this.assainirObjet(valeur as Record<string, unknown>, profondeur);
  }

  private assainirObjet(
    objet: Record<string, unknown>,
    profondeur: number,
  ): Record<string, unknown> {
    const sortie: Record<string, unknown> = {};

    for (const [cle, val] of Object.entries(objet)) {
      if (CLES_SENSIBLES.test(cle)) {
        sortie[cle] = VALEUR_MASQUEE;
        continue;
      }
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        // Au-delà de la profondeur maximale on masque plutôt que de recopier
        // un objet dont on n'a pas inspecté les clés.
        sortie[cle] =
          profondeur >= PROFONDEUR_MAX
            ? VALEUR_MASQUEE
            : this.assainirObjet(val as Record<string, unknown>, profondeur + 1);
        continue;
      }
      if (Array.isArray(val)) {
        sortie[cle] =
          profondeur >= PROFONDEUR_MAX
            ? VALEUR_MASQUEE
            : val.map((element) =>
                element && typeof element === 'object' && !Array.isArray(element)
                  ? this.assainirObjet(
                      element as Record<string, unknown>,
                      profondeur + 1,
                    )
                  : element,
              );
        continue;
      }
      sortie[cle] = val;
    }

    return sortie;
  }
}
