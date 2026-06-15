// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   images: {
//     unoptimized: true, 
//   },
// };

// module.exports = nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true, 
  },
  compiler: {
    // Remove console logs in production to reduce code size and improve performance
    // removeConsole: process.env.NODE_ENV === 'production',
    // Strips properties like data-test-id and potentially displayName from JSX in production
    reactRemoveProperties: process.env.NODE_ENV === 'production' ? {
      // properties: ['^displayName$', '^data-test-id$']
      properties: ['^displayName$']
    } : false,
  },
  // Set empty turbopack config to acknowledge we are using Turbopack
  turbopack: {},
};

module.exports = nextConfig;
