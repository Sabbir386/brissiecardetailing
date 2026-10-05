import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
