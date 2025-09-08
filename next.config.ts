import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
      encoding: false,
    };

    config.externals = config.externals || [];
    config.externals.push({
      canvas: "canvas",
      jsdom: "jsdom",
    });

    return config;
  },
};

export default nextConfig;
