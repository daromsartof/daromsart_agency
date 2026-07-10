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
  },
  // Les packages du monorepo sont consommés en source (pas de build préalable).
  transpilePackages: ["@daromsart/ui", "@daromsart/theme"],
};

export default nextConfig;
