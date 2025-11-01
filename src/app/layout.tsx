import React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SupabaseAuthProvider } from '../hooks/useSupabaseAuth';
import ConditionalNavigation from '../components/ConditionalNavigation';
import { RealtimeServiceProvider } from '../services/realtimeService';
import ToastContainer from '../components/Toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Gastrosaas - Plataforma SaaS para Restaurantes',
  description: 'Gastrosaas es una plataforma SaaS que ayuda a restaurantes a digitalizar sus operaciones mediante herramientas como menú digital, gestión de pedidos, y comunicación automatizada con clientes por WhatsApp.',
  keywords: 'restaurante, digitalización, menú digital, pedidos, WhatsApp Business, SaaS, gastronomía',
  authors: [{ name: 'Gastrosaas Team' }],
  creator: 'Gastrosaas',
  publisher: 'Gastrosaas',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://gastrosaas.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Gastrosaas - Digitaliza tu Restaurante',
    description: 'Plataforma SaaS completa para restaurantes con menú digital, gestión de pedidos y WhatsApp Business',
    url: 'https://gastrosaas.com',
    siteName: 'Gastrosaas',
    locale: 'es_AR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gastrosaas - Digitaliza tu Restaurante',
    description: 'Plataforma SaaS completa para restaurantes con menú digital, gestión de pedidos y WhatsApp Business',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <SupabaseAuthProvider>
          <RealtimeServiceProvider>
            <ConditionalNavigation />
            <main className="min-h-screen">
              {children}
            </main>
            <ToastContainer />
          </RealtimeServiceProvider>
        </SupabaseAuthProvider>
      </body>
    </html>
  );
} 
