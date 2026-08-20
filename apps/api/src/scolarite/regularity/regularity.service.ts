import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { StatutPaiement, StatutTransaction } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RegularityStatusResponseDto } from './dto/regularity-status.response.dto';

/**
 * Vérification de régularité étudiant — règle CLAUDE.md § Student Regularity :
 * "fees paid, no administrative holds". Seule la donnée de frais de
 * scolarité (FraisScolarite/Transaction) existe réellement dans le schéma
 * à ce jour — aucun autre type de blocage (bibliothèque, discipline) n'est
 * modélisé, donc aucune autre logique n'est inventée ici.
 *
 * Consommé en interne (injection directe, pas HTTP) par d'autres modules
 * du même monolithe — ex. Bibliothèque avant un prêt — via RegularityModule.
 */
@Injectable()
export class RegularityService {
  private readonly logger = new Logger(RegularityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async checkRegularity(matricule: string): Promise<RegularityStatusResponseDto> {
    const etudiant = await this.prisma.etudiant.findUnique({
      where: { matriculeUnique: matricule },
      include: {
        inscriptions: {
          where: { estActive: true },
          orderBy: { dateInscription: 'desc' },
          take: 1,
          include: {
            frais: {
              include: {
                transactions: {
                  where: { statut: StatutTransaction.COMPLETEE },
                  orderBy: { dateTransaction: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!etudiant) {
      throw new NotFoundException(`Étudiant introuvable (matricule: ${matricule})`);
    }

    const inscriptionActive = etudiant.inscriptions[0];
    if (!inscriptionActive) {
      return {
        isRegular: false,
        reason: 'Aucune inscription active trouvée pour cet étudiant.',
      };
    }

    const frais = inscriptionActive.frais;
    if (!frais) {
      return {
        isRegular: false,
        reason: "Aucun dossier de frais de scolarité enregistré pour l'inscription active.",
      };
    }

    if (frais.statutPaiement !== StatutPaiement.PAYE) {
      const montantRestant = Number(frais.montantTotal) - Number(frais.montantPaye);
      return {
        isRegular: false,
        reason: `Frais de scolarité non soldés (${montantRestant} GNF restant, statut: ${frais.statutPaiement}).`,
      };
    }

    const dernierPaiement = frais.transactions[0];
    this.logger.log(`Régularité vérifiée pour ${matricule} : régulier`);

    return {
      isRegular: true,
      lastPaymentDate: dernierPaiement?.dateTransaction,
    };
  }
}
