/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuración básica
  swcMinify: true,
  
  // Configuración de ESLint
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Configuración de TypeScript
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Configuración experimental simplificada
  experimental: {
    optimizeCss: true,
  },
};

module.exports = nextConfig;
