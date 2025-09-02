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
  
  // Configuración de webpack para evitar errores de módulos
  webpack: (config, { isServer }) => {
    // Configuración para evitar errores de módulos
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    
    return config;
  },
};

module.exports = nextConfig;
