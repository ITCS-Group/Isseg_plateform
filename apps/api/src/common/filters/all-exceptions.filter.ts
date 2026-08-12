import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

/**
 * Filtre global interceptant toutes les exceptions non gérées.
 *
 * Ordre de traitement :
 *  1. HttpException (NestJS natif) → passe telle quelle
 *  2. PrismaClientKnownRequestError → mappée en HTTP lisible
 *  3. PrismaClientValidationError  → 400 Bad Request
 *  4. Tout le reste               → 500 sans détails techniques
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message } = this.resolve(exception);

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }

  // ── Résolution de l'exception ──────────────────────────────────────────────

  private resolve(exception: unknown): { status: number; message: string | string[] } {
    // 1. HttpException NestJS — on passe la réponse telle quelle
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : (response as { message?: string | string[] }).message ?? exception.message;

      return { status: exception.getStatus(), message };
    }

    // 2. Erreur Prisma connue (contraintes, enregistrement absent…)
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.handlePrismaKnown(exception);
    }

    // 3. Erreur Prisma de validation (mauvais type passé à l'ORM)
    if (exception instanceof Prisma.PrismaClientValidationError) {
      this.logger.warn('Prisma validation error', exception.message);
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'Données invalides transmises à la base de données',
      };
    }

    // 4. Erreur de connexion DB
    if (exception instanceof Prisma.PrismaClientInitializationError) {
      this.logger.error('Prisma connexion impossible', exception.message);
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Service temporairement indisponible',
      };
    }

    // 5. Erreur inattendue — on log le stack mais on n'expose rien au client
    this.logger.error(
      'Exception non gérée',
      exception instanceof Error ? exception.stack : String(exception),
    );

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Une erreur interne est survenue',
    };
  }

  // ── Mapping des codes d'erreur Prisma ─────────────────────────────────────

  private handlePrismaKnown(
    e: Prisma.PrismaClientKnownRequestError,
  ): { status: number; message: string } {
    switch (e.code) {
      case 'P2002': // Unique constraint
        return {
          status: HttpStatus.CONFLICT,
          message: 'Cette valeur est déjà utilisée (contrainte d\'unicité)',
        };
      case 'P2025': // Record not found
        return { status: HttpStatus.NOT_FOUND, message: 'Ressource introuvable' };
      case 'P2003': // Foreign key constraint
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Référence invalide (contrainte de clé étrangère)',
        };
      case 'P2014': // Relation violation
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Violation de relation entre entités',
        };
      case 'P2016': // Query interpretation error
        return { status: HttpStatus.BAD_REQUEST, message: 'Requête invalide' };
      default:
        this.logger.warn(`Code Prisma non mappé : ${e.code} — ${e.message}`);
        return { status: HttpStatus.BAD_REQUEST, message: 'Erreur de base de données' };
    }
  }
}
