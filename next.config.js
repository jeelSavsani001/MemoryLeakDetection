// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   images: {
//     unoptimized: true, 
//   },
// };

// module.exports = nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true, 
  },
  // turbopack: {},
  webpack: (config, { dev, isServer }) => {
    // This forces the React Profiler to stay enabled in your deployed production build
    if (!dev && !isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'react-dom$': 'react-dom/profiling',
        // 'scheduler/tracing': 'scheduler/tracing-profiling',
      };

      // Disable minification for production builds
      config.optimization.minimize = false;
      config.optimization.minimizer = [];
    }
    return config;
  },
};

module.exports = nextConfig;
