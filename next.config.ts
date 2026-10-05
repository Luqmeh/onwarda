import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Inlined at build so preview clients see the same origin the server uses.
    // Explicit NEXT_PUBLIC_APP_URL still wins, including in production.
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? "",
    NEXT_PUBLIC_VERCEL_URL: process.env.VERCEL_URL ?? "",
  },
};

export default nextConfig;
