import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import type { AttestationSupportITData } from './attestation.types';

/**
 * Stub de délivrance d'attestation — forme provisoire, scopée à Support IT
 * (voir attestation.types.ts). Un seul gabarit texte codé en dur, pas de
 * PDF (la génération de documents lourds est déléguée à apps/worker
 * ailleurs dans la plateforme — hors périmètre de ce stub).
 */
@Injectable()
export class AttestationService {
  genererAttestationSupportIT(params: {
    participantNom: string;
    participantPrenom: string;
    coursTitre: string;
    dateReussite: Date;
  }): AttestationSupportITData {
    const numeroReference = `ATT-SUPPORT-IT-${randomUUID()}`;
    const contenu =
      `Attestation de réussite (Support Informatique — ISSEG)\n` +
      `Décerné à : ${params.participantPrenom} ${params.participantNom}\n` +
      `Cours : ${params.coursTitre}\n` +
      `Date de réussite : ${params.dateReussite.toISOString().slice(0, 10)}\n` +
      `Référence : ${numeroReference}`;

    return { ...params, numeroReference, contenu };
  }
}
