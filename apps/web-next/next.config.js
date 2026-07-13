/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@reveria/shared"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async rewrites() {
    const apiOrigin = process.env.API_INTERNAL_URL || "http://127.0.0.1:4100";
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
};

module.exports = nextConfig;
