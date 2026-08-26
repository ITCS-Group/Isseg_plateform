import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/auth.interfaces';
import { PrismaService } from '../../database/prisma/prisma.service';

/** Rôles qui voient/gèrent toutes les requêtes, sans filtre de sous-service ni de demandeur. */
export const UNSCOPED_REQUETE_ROLES = ['ADMIN', 'RESPONSABLE_IT'];

interface RequeteScopeRow {
  demandeurId: string;
  sousServiceCible: Prisma.RequeteGetPayload<{ select: { sousServiceCible: true } }>['sousServiceCible'];
}

/** null = aucune requête visible (appelant sans profil Personnel ni Technicien). */
export async function buildRequeteScopeFilter(
  prisma: PrismaService,
  user: AuthenticatedUser,
): Promise<Prisma.RequeteWhereInput | null> {
  if (user.roles.some((r) => UNSCOPED_REQUETE_ROLES.includes(r))) {
    return {};
  }

  if (user.roles.includes('TECHNICIEN')) {
    const technicien = await prisma.technicien.findFirst({ where: { personnel: { userId: user.id } } });
    if (!technicien) return null;
    return { sousServiceCible: technicien.sousService };
  }

  const personnel = await prisma.personnel.findUnique({ where: { userId: user.id } });
  if (!personnel) return null;
  return { demandeurId: personnel.id };
}

export async function assertCanViewRequete(
  prisma: PrismaService,
  row: RequeteScopeRow,
  user: AuthenticatedUser,
): Promise<void> {
  if (user.roles.some((r) => UNSCOPED_REQUETE_ROLES.includes(r))) return;

  if (user.roles.includes('TECHNICIEN')) {
    const technicien = await prisma.technicien.findFirst({ where: { personnel: { userId: user.id } } });
    if (technicien?.sousService === row.sousServiceCible) return;
  }

  const personnel = await prisma.personnel.findUnique({ where: { userId: user.id } });
  if (personnel?.id === row.demandeurId) return;

  throw new ForbiddenException("Vous n'avez pas accès à cette requête.");
}

export async function assertCanHandleRequete(
  prisma: PrismaService,
  row: RequeteScopeRow,
  user: AuthenticatedUser,
): Promise<void> {
  if (user.roles.some((r) => UNSCOPED_REQUETE_ROLES.includes(r))) return;

  if (user.roles.includes('TECHNICIEN')) {
    const technicien = await prisma.technicien.findFirst({ where: { personnel: { userId: user.id } } });
    if (technicien?.sousService === row.sousServiceCible) return;
  }

  throw new ForbiddenException(
    'Seul un technicien du sous-service ciblé (ou RESPONSABLE_IT) peut traiter cette requête.',
  );
}
