export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
  cors: {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'CHANGE_ME_IN_PRODUCTION',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'CHANGE_ME_REFRESH_IN_PRODUCTION',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  cookie: {
    name: process.env.COOKIE_NAME ?? 'refreshToken',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
  },
  bibliotheque: {
    // Types d'Abonne autorisés à emprunter à domicile (POST /emprunts).
    // Décision métier (entretien Groupe 4, Bibliothèque, 05/08/2026) : le prêt
    // à domicile est réservé aux enseignants au lancement, les étudiants étant
    // limités à la consultation sur place — extension aux étudiants prévue
    // plus tard. Paramètre de configuration exprès (pas une règle figée en
    // dur) pour pouvoir réactiver l'accès étudiant sans nouveau déploiement de
    // code : ex. BIBLIOTHEQUE_EMPRUNT_DOMICILE_TYPES_AUTORISES=ENSEIGNANT,ETUDIANT_L1_L2,ETUDIANT_L3_M2
    empruntDomicileTypesAutorises: (
      process.env.BIBLIOTHEQUE_EMPRUNT_DOMICILE_TYPES_AUTORISES ?? 'ENSEIGNANT'
    )
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  },
});
