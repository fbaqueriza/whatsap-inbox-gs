/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimizaciones de rendimiento
  swcMinify: true,
  compress: true,
  
  // Configuración de ESLint
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Optimización de imágenes
  images: {
    domains: [],
    unoptimized: false,
  },
  
  // Configuración de webpack optimizada
  webpack: (config, { isServer, dev }) => {
    // Optimizaciones para desarrollo
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    
    // Fallbacks para cliente
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        undici: false,
      };
    }
    
    // Optimización de bundles
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      },
      // Optimización para reducir tiempo de carga
      runtimeChunk: 'single',
    };
    
    return config;
  },
  
  // Headers para API
  async headers() {
    return [
      {
        source: '/api/whatsapp/twilio/webhook',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/json',
          },
        ],
      },
    ];
  },
  
  // Configuración experimental para mejor rendimiento
  experimental: {
    optimizeCss: true,
    scrollRestoration: true,
    // Optimizaciones adicionales
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
  
  // Optimización de compilación
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Configuración de potencia
  poweredByHeader: false,
  
  // Optimización de generación estática
  generateEtags: false,
};

module.exports = nextConfig;
