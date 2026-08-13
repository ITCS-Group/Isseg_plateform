import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // ── Sécurité : Headers HTTP ─────────────────────────────────────────────────
  app.use(helmet());

  // ── Cookie parser ───────────────────────────────────────────────────────────
  app.use(cookieParser());

  // ── CORS ────────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // ── Préfixe global et versioning URI ────────────────────────────────────────
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // ── Filtre d'exceptions global ──────────────────────────────────────────────
  // Intercepte les erreurs Prisma, les HttpException et tout le reste
  app.useGlobalFilters(new AllExceptionsFilter());

  // ── Validation globale des DTOs ─────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Documentation Swagger ────────────────────────────────────────────────────
  // Disponible en development ET en staging (pas en production)
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('ISSEG Platform — API')
      .setDescription(
        '## Documentation de l\'API REST de la plateforme universitaire ISSEG\n\n' +
        '### Authentification\n' +
        '1. Appelez `POST /api/v1/auth/login` avec vos identifiants\n' +
        '2. Copiez la valeur `accessToken` reçue\n' +
        '3. Cliquez sur le bouton **Authorize 🔒** ci-dessus et collez : `Bearer <accessToken>`\n' +
        '4. Toutes les routes protégées seront automatiquement authentifiées\n\n' +
        '### Rate limiting\n' +
        'Maximum **100 requêtes / minute / IP**',
      )
      .setVersion('1.0')
      .setContact('ISSEG Platform', '', 'support@isseg.edu')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Coller ici le accessToken obtenu via POST /api/v1/auth/login',
          name: 'Authorization',
          in: 'header',
        },
        'JWT',
      )
      .addTag('Authentification', 'Login, refresh de tokens, profil courant, déconnexion')
      .addTag('Utilisateurs', 'Gestion des comptes utilisateurs')
      .addTag('Rôles & Permissions', 'Gestion du RBAC')
      .addTag('Étudiants', 'Profils et données académiques des étudiants')
      .addTag('Inscriptions', 'Gestion des inscriptions et dossiers scolaires')
      .addTag('Finance', 'Frais de scolarité et transactions')
      .addTag('Pédagogie', 'Cours, évaluations et notes')
      .addTag('Portail Parent', 'Carnets de suivi et messagerie')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);

    SwaggerModule.setup('api/docs', app, document, {
      customSiteTitle: 'ISSEG API — Swagger UI',
      swaggerOptions: {
        persistAuthorization: true,          // conserve le token entre les rechargements
        displayOperationId: false,
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 2,
        docExpansion: 'list',                // 'none' | 'list' | 'full'
        filter: true,                        // barre de recherche dans Swagger UI
        showRequestDuration: true,           // affiche le temps de réponse
        tryItOutEnabled: true,               // bouton "Try it out" ouvert par défaut
      },
    });

    logger.log('Swagger UI disponible sur http://localhost:3001/api/docs');
    logger.log('JSON OpenAPI     disponible sur http://localhost:3001/api/docs-json');
  }

  // ── Arrêt propre ────────────────────────────────────────────────────────────
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  logger.log(`ISSEG API démarrée sur http://localhost:${port}/api/v1`);
}

bootstrap();
