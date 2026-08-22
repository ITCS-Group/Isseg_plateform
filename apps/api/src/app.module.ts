import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { BibliothequeModule } from './bibliotheque/bibliotheque.module';
import configuration from './config/configuration';
import { PrismaModule } from './database/prisma/prisma.module';
import { IdentityModule } from './identity/identity.module';
import { PedagogieModule } from './pedagogie/pedagogie.module';
import { AbandonModule } from './scolarite/abandon/abandon.module';
import { RegularityModule } from './scolarite/regularity/regularity.module';
import { RegistrationModule } from './scolarite/registration/registration.module';

@Module({
  imports: [
    // ── Configuration ──────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),

    // ── Rate limiting : 100 requêtes / minute / IP ─────────────────────────
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    // ── Base de données (global — PrismaService disponible partout) ────────
    PrismaModule,

    // ── Authentification & RBAC ────────────────────────────────────────────
    AuthModule,

    // ── Domaine : Identité (Users, Roles, Permissions) ─────────────────────
    IdentityModule,

    // ── Domaine : Scolarité — workflow d'inscription ───────────────────────
    RegistrationModule,

    // ── Domaine : Scolarité — statut de régularité (contrat inter-modules) ──
    RegularityModule,

    // ── Domaine : Scolarité — workflow abandon / reprise ────────────────────
    AbandonModule,

    // ── Domaine : Pédagogie ──────────────────────────────────────────────────
    PedagogieModule,

    // ── Domaine : Bibliothèque ───────────────────────────────────────────────
    BibliothequeModule,
  ],
  controllers: [],
  providers: [
    // ── Guards globaux (ordre : Throttler → JWT → Roles → Permissions) ─────
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
