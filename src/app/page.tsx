'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGlobalChat } from '../contexts/GlobalChatContext';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { 
  MessageCircle, 
  Menu, 
  X,
  ArrowRight,
  Users,
  BarChart3,
  CreditCard,
  Shield
} from 'lucide-react';

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();
  const { user } = useSupabaseAuth();

  // Redirigir usuarios autenticados al dashboard
  useEffect(() => {
    if (user) {
      console.log('🔒 Usuario autenticado detectado, redirigiendo al dashboard');
      router.push('/dashboard');
    }
  }, [user, router]);



  const handleWhatsAppClick = () => {
    window.open('https://wa.me/541135562673', '_blank');
  };

  const handleLoginClick = () => {
    try {
      router.push('/auth/login');
    } catch (error) {
      console.error('Error en redirección:', error);
      // Fallback a window.location.href
      window.location.href = '/auth/login';
    }
  };



  const features = [
    {
      icon: <CreditCard className="w-6 h-6" />,
      title: "Gestión de Facturas y Finanzas",
      description: "Control completo de facturación, comprobantes y finanzas con reportes automáticos y análisis de rentabilidad."
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Gestión de Pedidos en Tiempo Real",
      description: "Recibe, gestiona y rastrea pedidos desde múltiples canales en una sola plataforma."
    },
    {
      icon: <MessageCircle className="w-6 h-6" />,
      title: "Comunicación Automatizada WhatsApp",
      description: "Integración completa con WhatsApp Business para atención automática e inteligente."
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Reportes y Analítica",
      description: "Dashboard completo con métricas de ventas, clientes y rendimiento de tu negocio."
    },
    {
      icon: <CreditCard className="w-6 h-6" />,
      title: "Integración con Pagos",
      description: "Acepta pagos online y en efectivo con reportes automáticos de transacciones."
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Gestión de Stock",
      description: "Control de inventario con alertas automáticas de reposición y análisis de rotación."
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Simple Header for Landing Page */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="text-2xl font-bold text-green-600">Gastrosaas</div>
            </div>
            
            <div className="flex space-x-4">
              <button
                onClick={handleLoginClick}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors cursor-pointer"
                type="button"
              >
                Iniciar Sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-green-50 to-blue-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Digitaliza tu Restaurante con
              <span className="text-green-600"> Gastrosaas</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Gastrosaas es una plataforma SaaS que ayuda a restaurantes a digitalizar sus operaciones mediante herramientas como gestión de facturas y finanzas, gestión de pedidos, y comunicación automatizada con clientes por WhatsApp.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleLoginClick}
                className="bg-green-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center cursor-pointer"
                type="button"
              >
                Comenzar Gratis
                <ArrowRight className="ml-2 w-5 h-5" />
              </button>
              <button
                onClick={handleWhatsAppClick}
                className="bg-white text-green-600 border-2 border-green-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-green-50 transition-colors flex items-center justify-center"
              >
                <MessageCircle className="mr-2 w-5 h-5" />
                ¿Tienes dudas? Escríbenos por WhatsApp
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="servicios" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Servicios Destacados
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Todo lo que necesitas para modernizar tu restaurante en una sola plataforma
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
                <div className="text-green-600 mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contacto" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Contáctanos
            </h2>
            <p className="text-xl text-gray-600">
              Estamos aquí para ayudarte a digitalizar tu restaurante
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-6">
                Información de Contacto
              </h3>
              <div className="space-y-4">
                <div className="flex items-center">
                  <span className="text-gray-700">WhatsApp: +54 11 3556-2673</span>
                </div>
                <div className="flex items-center">
                  <span className="text-gray-700">Email: fbaqueriza@itba.edu.ar</span>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-6">
                ¿Listo para comenzar?
              </h3>
              <p className="text-gray-600 mb-6">
                Únete a cientos de restaurantes que ya están digitalizando sus operaciones con Gastrosaas.
              </p>
              <button
                onClick={handleLoginClick}
                className="bg-green-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-green-700 transition-colors"
              >
                Comenzar Ahora
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400 mb-4">Gastrosaas</div>
            <p className="text-gray-400 mb-8">
              Digitalizando restaurantes, un pedido a la vez.
            </p>
            <div className="flex justify-center space-x-6">
              <button
                onClick={handleLoginClick}
                className="text-gray-400 hover:text-white transition-colors"
              >
                Iniciar Sesión
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
} 
