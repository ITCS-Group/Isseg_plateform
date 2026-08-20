import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, StatutDossier } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { TYPE_ABONNE_RULES, typeAbonneFromNiveau } from '../../bibliotheque/common/loan-rules.constants';
import { RejectDossierDto } from './dto/reject-dossier.dto';
import { TransitionDto } from './dto/transition.dto';
import { RegistrationOutboxPayload, TransitionOptions, TransitionResult } from './registration.types';
import { isTransitionAllowed, TRANSITION_EVENT_TYPE } from './state-machine';

// ── Sélection Prisma : dossier + relations nécessaires à la transition ───────
const DOSSIER_INCLUDE = {
  etudiant: { select: { id: true, matriculeUnique: true, userId: true } },
  anneeUniversitaire: { select: { id: true, dateDebut: true } },
  classe: { select: { niveau: true } },
} satisfies Prisma.DossierInscriptionInclude;

// ────────────────────────────────────────────────────────────────────────────

/**
 * Service de transition d'état du DossierInscription (workflow B1.1).
 *
 * Chaque transition réussie s'exécute dans UNE transaction atomique et produit
 * exactement 1 RegistrationHistory + 1 OutboxEvent. En cas d'échec (transition
 * interdite, conflit de version, erreur DB), toute la transaction est annulée :
 * 0 mutation, 0 history, 0 outbox.
 *
 * Aucune règle RBAC ici : `actorId` est fourni par l'appelant authentifié et
 * ne doit jamais être NULL (= changedBy).
 */
@Injectable()
export class RegistrationWorkflowService {
  private readonly logger = new Logger(RegistrationWorkflowService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Use-cases publics ───────────────────────────────────────────────────────

  /** T1 : BROUILLON → SOUMIS */
  async submit(dossierId: string, actorId: string, dto: TransitionDto): Promise<TransitionResult> {
    return this.applyTransition(dossierId, StatutDossier.SOUMIS, actorId, dto.expectedVersion, {
      comment: dto.comment,
    });
  }

  /** T2 : SOUMIS → EN_TRAITEMENT */
  async startProcessing(
    dossierId: string,
    actorId: string,
    dto: TransitionDto,
  ): Promise<TransitionResult> {
    return this.applyTransition(dossierId, StatutDossier.EN_TRAITEMENT, actorId, dto.expectedVersion, {
      comment: dto.comment,
    });
  }

  /** T3 : EN_TRAITEMENT → INSCRIT (attribution du matricule à vie) */
  async register(
    dossierId: string,
    actorId: string,
    dto: TransitionDto,
  ): Promise<TransitionResult> {
    return this.applyTransition(dossierId, StatutDossier.INSCRIT, actorId, dto.expectedVersion, {
      comment: dto.comment,
    });
  }

  /** T4 : EN_TRAITEMENT → REJETE (motif obligatoire) */
  async reject(
    dossierId: string,
    actorId: string,
    dto: RejectDossierDto,
  ): Promise<TransitionResult> {
    return this.applyTransition(dossierId, StatutDossier.REJETE, actorId, dto.expectedVersion, {
      comment: dto.comment,
      motifRejet: dto.motifRejet,
    });
  }

  // ── Cœur de transition (atomique) ────────────────────────────────────────────

  private async applyTransition(
    dossierId: string,
    target: StatutDossier,
    actorId: string,
    expectedVersion: number,
    options: TransitionOptions,
  ): Promise<TransitionResult> {
    return this.prisma.$transaction(
      async (tx) => {
        // 1. Lecture du dossier + relations
        const dossier = await tx.dossierInscription.findUnique({
          where: { id: dossierId },
          include: DOSSIER_INCLUDE,
        });
        if (!dossier) {
          throw new NotFoundException(`Dossier introuvable (id: ${dossierId})`);
        }

        const from = dossier.statutDossier;

        // 2. Qualification du conflit de concurrence : une version périmée est
        //    un conflit d'état/version → 409, AVANT la garde métier (422).
        //    Le CAS updateMany (étape 4) reste la garantie atomique lecture→écriture.
        if (dossier.version !== expectedVersion) {
          throw new ConflictException(
            'Conflit de version : le dossier a été modifié (version périmée)',
          );
        }

        // 3. Garde de transition (source unique de vérité)
        if (!isTransitionAllowed(from, target)) {
          throw new UnprocessableEntityException(
            `Transition invalide : ${from} → ${target}`,
          );
        }

        // 3. Construction du patch (champs conditionnels par transition)
        const now = new Date();
        const data: Prisma.DossierInscriptionUncheckedUpdateManyInput = {
          statutDossier: target,
          version: { increment: 1 },
        };
        if (target === StatutDossier.SOUMIS) {
          data.dateSoumission = now;
        }
        if (target === StatutDossier.INSCRIT || target === StatutDossier.REJETE) {
          data.dateValidation = now;
          data.validePar = actorId;
        }
        if (target === StatutDossier.REJETE) {
          data.motifRejet = options.motifRejet;
        }

        // 4. Compare-And-Swap optimiste : n'aboutit que si version ET statut intacts
        const updated = await tx.dossierInscription.updateMany({
          where: { id: dossierId, version: expectedVersion, statutDossier: from },
          data,
        });
        if (updated.count === 0) {
          throw new ConflictException(
            'Conflit de concurrence : le dossier a été modifié entre-temps',
          );
        }
        const newVersion = expectedVersion + 1;

        // 5. Matricule à vie — uniquement pour INSCRIT, uniquement si absent
        let matricule: string | undefined;
        if (target === StatutDossier.INSCRIT) {
          if (dossier.etudiant.matriculeUnique === null) {
            const rows = await tx.$queryRaw<Array<{ seq: string }>>`
              SELECT nextval('matricule_global_seq')::text AS seq`;
            const numero = rows[0].seq.padStart(4, '0');
            const annee = dossier.anneeUniversitaire.dateDebut.getUTCFullYear();
            matricule = `ISSEG-${annee}-${numero}`;
            await tx.etudiant.update({
              where: { id: dossier.etudiantId },
              data: { matriculeUnique: matricule },
            });
          } else {
            // Réinscription : conserver le matricule, ne PAS consommer la séquence
            matricule = dossier.etudiant.matriculeUnique;
          }

          // Auto-abonnement Bibliothèque (décision #6 — appel direct, même
          // transaction, pas d'event-emitter). Idempotent : upsert sur
          // utilisateurId (contrainte unique), ne réattribue pas les quotas
          // déjà personnalisés si l'Abonne existe déjà (ex. réinscription).
          const typeAbonne = typeAbonneFromNiveau(dossier.classe.niveau);
          const rule = TYPE_ABONNE_RULES[typeAbonne];
          await tx.abonne.upsert({
            where: { utilisateurId: dossier.etudiant.userId },
            update: {},
            create: {
              utilisateurId: dossier.etudiant.userId,
              typeAbonne,
              limiteEmprunts: rule.limiteEmprunts,
              dureePretJours: rule.dureePretJours,
            },
          });
        }

        // 6. RegistrationHistory : exactement 1 entrée
        const comment =
          target === StatutDossier.REJETE ? options.motifRejet ?? null : options.comment ?? null;
        await tx.registrationHistory.create({
          data: {
            dossierId,
            fromStatus: from,
            toStatus: target,
            changedBy: actorId,
            changedAt: now,
            comment,
          },
        });

        // 7. OutboxEvent : exactement 1 entrée
        const eventType = TRANSITION_EVENT_TYPE[target];
        if (!eventType) {
          // Défensif : ne devrait jamais arriver (cibles couvertes par ALLOWED)
          throw new UnprocessableEntityException(`Aucun eventType défini pour ${target}`);
        }
        const payload: RegistrationOutboxPayload = {
          dossierId,
          etudiantId: dossier.etudiantId,
          anneeId: dossier.anneeId,
          classeId: dossier.classeId,
          fromStatus: from,
          toStatus: target,
          version: newVersion,
          changedBy: actorId,
          changedAt: now.toISOString(),
          eventType,
          ...(matricule ? { matricule } : {}),
          ...(target === StatutDossier.REJETE ? { motifRejet: options.motifRejet } : {}),
        };
        await tx.outboxEvent.create({
          data: {
            aggregateId: dossierId,
            eventType,
            payload: payload as unknown as Prisma.InputJsonValue,
          },
        });

        this.logger.log(
          `Transition ${from} → ${target} sur dossier ${dossierId} (v${newVersion}) par ${actorId}`,
        );

        return { dossierId, fromStatus: from, toStatus: target, version: newVersion, matricule };
      },
      {
        timeout: 10_000,
        maxWait: 5_000,
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );
  }
}
