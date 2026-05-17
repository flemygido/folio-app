import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ["localhost:3000", "folio-app-six.vercel.app"] },
  },
  images: {
    domains: ["lh3.googleusercontent.com"],
  },
};

export default nextConfig;
