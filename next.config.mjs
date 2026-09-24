/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false };
    // The repo lives under Dropbox/CloudStorage, whose virtual filesystem breaks
    // webpack's persistent (filesystem) cache snapshots ("Unable to snapshot resolve
    // dependencies"), leaving builds without a BUILD_ID. Use an in-memory cache locally;
    // Vercel's clean filesystem is unaffected either way.
    if (config.cache && config.cache.type === "filesystem") {
      config.cache = { type: "memory" };
    }
    return config;
  },
};

export default nextConfig;
