/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "20mb" },
  },
  webpack: (config) => {
    // Required for pdfjs-dist
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
