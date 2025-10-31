'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '../../../hooks/useSupabaseAuth';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState('');


  const router = useRouter();
  const { user, isLoading, needsEmailVerification, clearEmailVerification, resetPassword, signIn } = useSupabaseAuth();

  // 🔧 VERIFICACIÓN DE SESIÓN: Redirigir si ya está autenticado (con delay para evitar loops)
  useEffect(() => {
    if (!isLoading && user) {
      console.log('🔐 Login: Usuario ya autenticado, redirigiendo al dashboard');
      // Usar setTimeout para evitar loops infinitos
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 100);
    }
  }, [user, isLoading]);

  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberEmail(true);
    }
  }, []);
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevenir múltiples envíos
    if (loading) return;
    
    setLoading(true);
    setError('');
    
    if (rememberEmail) {
      localStorage.setItem('rememberedEmail', email);
    } else {
      localStorage.removeItem('rememberedEmail');
    }
    
    try {
      console.log('🔐 Login: Iniciando signIn...');
      const result = await signIn(email, password);
      console.log('🔐 Login: Resultado de signIn:', result);
      
      if (result && result.error) {
        console.error('🔐 Login: Error de autenticación:', result.error);
        setError(result.error.message || 'Error de inicio de sesión.');
        return;
      }
      
      // Si no hay error, asumir que el login fue exitoso y redirigir
      console.log('🔐 Login: Usuario autenticado exitosamente, redirigiendo...');
      // Usar window.location para forzar la redirección
      window.location.href = '/dashboard';
    } catch (err: any) {
      console.error('🔐 Login: Error inesperado:', err);
      setError(err.message || 'Error de inicio de sesión.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevenir múltiples envíos
    if (resetLoading) return;
    
    setResetLoading(true);
    setResetError('');
    setResetSuccess(false);
    
    try {
      const result = await resetPassword(resetEmail);
      
      if (result?.error) {
        console.error('🔐 Reset Password: Error:', result.error);
        setResetError(result.error.message || 'Error al enviar el email de recuperación.');
        return;
      }
      
      console.log('🔐 Reset Password: Email enviado exitosamente a:', resetEmail);
      setResetSuccess(true);
    } catch (err: any) {
      console.error('🔐 Reset Password: Error inesperado:', err);
      setResetError(err.message || 'Error al enviar el email de recuperación.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleShowResetPassword = () => {
    setShowResetPassword(true);
    setResetEmail(email); // Pre-llenar con el email actual
    setResetError('');
    setResetSuccess(false);
  };

  const handleBackToLogin = () => {
    setShowResetPassword(false);
    setResetEmail('');
    setResetError('');
    setResetSuccess(false);
  };


  
  // 🔧 LOADING: Mostrar spinner mientras se verifica la autenticación
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center text-green-600 hover:text-green-700 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al inicio
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Gastrosaas
          </h1>
          <p className="text-gray-600">
            Accede a tu cuenta para gestionar tu restaurante
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
            Iniciar sesión
          </h2>
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
          
          {needsEmailVerification && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    Verificación de email requerida
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>
                      Por favor, revisa tu correo electrónico y haz clic en el enlace de verificación para activar tu cuenta.
                    </p>
                    <p className="mt-2">
                      Si no recibiste el email, revisa tu carpeta de spam o solicita un nuevo enlace.
                    </p>
                  </div>
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={clearEmailVerification}
                      className="text-sm text-blue-600 hover:text-blue-500 underline"
                    >
                      Entendido
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={rememberEmail}
                  onChange={e => setRememberEmail(e.target.checked)}
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Recordar correo</span>
              </label>
              <button
                type="button"
                onClick={handleShowResetPassword}
                className="text-sm text-green-600 hover:text-green-700 font-medium transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Iniciando sesión...
                </div>
              ) : (
                'Iniciar sesión'
              )}
            </button>
          </form>

          {/* Reset Password Form */}
          {showResetPassword && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                Recuperar contraseña
              </h3>
              
              {resetSuccess && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-green-800">
                        Email enviado exitosamente
                      </h3>
                      <div className="mt-2 text-sm text-green-700">
                        <p>
                          Hemos enviado un enlace de recuperación a tu correo electrónico. 
                          Revisa tu bandeja de entrada y sigue las instrucciones para restablecer tu contraseña.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {resetError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm">{resetError}</p>
                </div>
              )}
              
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label htmlFor="resetEmail" className="block text-sm font-medium text-gray-700 mb-2">
                    Correo electrónico
                  </label>
                  <input
                    id="resetEmail"
                    type="email"
                    placeholder="tu@email.com"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
                    required
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={handleBackToLogin}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                  >
                    Volver al login
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resetLoading ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Enviando...
                      </div>
                    ) : (
                      'Enviar email de recuperación'
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              ¿No tienes cuenta?{' '}
              <a 
                href="/auth/signup" 
                className="text-green-600 hover:text-green-700 font-medium transition-colors"
              >
                Regístrate aquí
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            © 2024 Gastrosaas. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
