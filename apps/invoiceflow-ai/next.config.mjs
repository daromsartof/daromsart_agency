/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Les packages du monorepo sont consommés en source (pas de build préalable).
  transpilePackages: ["@daromsart/ui", "@daromsart/theme"],
};

export default nextConfig;
