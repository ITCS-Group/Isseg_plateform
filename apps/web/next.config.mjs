/** @type {import("next").NextConfig} */
const nextConfig = {
  transpilePackages: ["@isseg/ui"],
  async redirects() {
    return [
      // Ancienne route du dashboard enseignant, renommée lors de
      // l'harmonisation des routes (2026-08-21) — filet de sécurité
      // conservé même sans usage externe connu à ce jour.
      {
        source: "/teacher",
        destination: "/enseignant",
        permanent: true,
      },
    ];
  },
};
export default nextConfig;
