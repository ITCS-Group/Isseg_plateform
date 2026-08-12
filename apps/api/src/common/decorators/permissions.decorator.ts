import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/** Restreint une route aux permissions spécifiées. Ex: @Permissions('WRITE_INSCRIPTIONS') */
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
