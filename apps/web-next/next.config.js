/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@reveria/shared"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

module.exports = nextConfig;
