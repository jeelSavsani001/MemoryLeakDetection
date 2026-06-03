/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true, 
  },
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      // Disable minification for MemLab
      config.optimization.minimize = false;
      config.optimization.minimizer = [];
      
      // Preserve original names
      config.optimization.moduleIds = 'named';
      config.optimization.chunkIds = 'named';
      config.optimization.mangleExports = false;
    }
    return config;
  },
};

module.exports = nextConfig;
