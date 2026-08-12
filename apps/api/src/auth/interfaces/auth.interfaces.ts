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
  iat?: number;
  exp?: number;
}

/** Réponse retournée lors du login et du refresh */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
