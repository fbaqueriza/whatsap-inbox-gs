'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { Menu, X, User, LogOut, Settings, Bell, MessageSquare } from 'lucide-react';
import UserProfile from './UserProfile';
import es from '../locales/es';

export default function Navigation() {
  const { signOut } = useSupabaseAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const hasRendered = useRef(false);
  
  useEffect(() => {
    if (!hasRendered.current) {
      setIsMounted(true);
      hasRendered.current = true;
    }
  }, []);
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/auth/login');
    } catch (error) {
      // Error al cerrar sesión
    }
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Órdenes', href: '/orders' },
    { name: 'Proveedores', href: '/providers' },
    { name: 'Stock', href: '/stock' },
    { name: 'Chat', href: '/chat' },
  ];

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/dashboard" className="text-xl font-bold text-gray-900 hover:text-gray-700">
                {es.appName}
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      isActive
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                    title={item.name}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="hidden sm:ml-6 sm:flex sm:items-center sm:space-x-4">
            {/* Notifications */}
            <button className="p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              <Bell className="h-6 w-6" />
              <span className="sr-only">{es.notificationsTooltip}</span>
            </button>

            {/* User Profile */}
            <div className="flex items-center space-x-4">
              <UserProfile showEmail={false} />
              
              {/* Sign Out Button */}
              <button
                onClick={handleSignOut}
                className="p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                title={es.signOut}
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center sm:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            >
              {isMounted && isMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMounted && isMenuOpen && (
        <div className="sm:hidden">
          <div className="pt-2 pb-3 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                    isActive
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>

          <div className="pt-4 pb-3 border-t border-gray-200">
            <div className="px-4">
              <UserProfile showEmail={true} className="mb-3" />
            </div>
            <div className="mt-3 space-y-1">
              <button
                onClick={handleSignOut}
                className="block w-full text-left px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              >
                <LogOut className="h-4 w-4 mr-2 inline" />
                {es.signOut}
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
