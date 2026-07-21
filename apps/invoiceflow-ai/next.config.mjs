import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Image de production minimale : serveur autonome (Next standalone).
  output: "standalone",
  // Monorepo : tracer les dépendances depuis la racine du workspace, sinon les
  // packages @daromsart/* ne sont pas embarqués dans le bundle standalone.
  // (clé sous `experimental` sur Next 14 ; top-level à partir de Next 15)
  experimental: {
    outputFileTracingRoot: path.join(dirname, "../../"),
    // @react-pdf/renderer embarque un reconciler React "maison" qui exige le
    // runtime React standard : bundlé via webpack, il hérite du build React
    // "react-server" (conditions RSC) appliqué aux route handlers de l'App
    // Router, qui n'expose pas `React.Component` de la même façon et fait
    // planter le reconciler (`TypeError: a.Component is not a constructor`).
    // Externaliser le paquet le fait charger via `require` Node normal, avec
    // le vrai `react`, plutôt que d'être bundlé/aliasé par webpack.
    // @react-email/render : même famille de risque que @react-pdf/renderer
    // (conditions d'exports "node"/"edge"/"browser" sensibles au layer RSC) —
    // externalisé par précaution avant même d'avoir observé le crash.
    serverComponentsExternalPackages: ["@react-pdf/renderer", "@react-email/render"],
  },
  // Les packages du monorepo sont consommés en source (pas de build préalable).
  transpilePackages: ["@daromsart/ui", "@daromsart/theme"],
};

export default nextConfig;
