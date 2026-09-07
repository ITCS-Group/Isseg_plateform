/** Représentation de l'utilisateur authentifié attachée à request.user */
export interface AuthenticatedUser {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  estActif: boolean;
  roles: string[];
  permissions: string[];
}

/** Payload du JWT d'accès (access token) */
export interface JwtPayload {
  sub: string;
  email: string;
  nom: string;
  prenom: string;
  roles: string[];
  permissions: string[];
  iat?: number;
  exp?: number;
}

/** Payload du JWT de rafraîchissement (refresh token) */
export interface RefreshPayload {
  sub: string;
  type: 'refresh';
  /**
   * Identifiant unique de l'émission, garantissant que deux jetons émis pour le
   * même utilisateur dans la même seconde restent distincts (`iat`/`exp` étant
   * exprimés à la seconde). Optionnel : les jetons émis avant l'introduction de
   * ce claim n'en portent pas et doivent rester valides jusqu'à leur expiration.
   */
  jti?: string;
  iat?: number;
  exp?: number;
}

/** Réponse retournée lors du login et du refresh */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
