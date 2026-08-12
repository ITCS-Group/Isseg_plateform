import { Module } from '@nestjs/common';
import { PermissionsModule } from './permissions/permissions.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';

/**
 * Module barrel regroupant tous les sous-modules du domaine Identité.
 * Importer uniquement IdentityModule dans AppModule.
 */
@Module({
  imports: [UsersModule, RolesModule, PermissionsModule],
  exports: [UsersModule, RolesModule, PermissionsModule],
})
export class IdentityModule {}
