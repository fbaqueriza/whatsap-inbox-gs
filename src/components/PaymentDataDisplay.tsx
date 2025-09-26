'use client';

import React, { useState, useEffect } from 'react';
import { Copy, CheckCircle, CreditCard, Building2, FileText, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase/client';

interface PaymentData {
  orderId: string;
  orderNumber: string;
  providerName: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  invoiceNumber?: string;
  bankInfo: {
    cbu?: string;
    alias?: string;
    cuitCuil?: string;
    razonSocial?: string;
  };
  invoiceData?: any;
  status: string;
  generatedAt: string;
  paymentMessage: string;
}

interface PaymentDataDisplayProps {
  orderId: string;
  className?: string;
}

export default function PaymentDataDisplay({ orderId, className = "" }: PaymentDataDisplayProps) {
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;

    const fetchPaymentData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Obtener usuario autenticado
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          setError('Usuario no autenticado');
          return;
        }

        // Importar y usar el servicio directamente
        const { paymentDataService } = await import('../lib/paymentDataService.js');
        const result = await paymentDataService.generatePaymentData(orderId, user.id, supabase);

        if (result.success) {
          setPaymentData(result.data);
        } else {
          setError(result.error || 'Error obteniendo datos de pago');
        }
      } catch (err) {
        setError('Error de conexión');
        console.error('Error fetching payment data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentData();
  }, [orderId]);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency || 'ARS',
      minimumFractionDigits: 2
    }).format(amount);
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            <div className="h-3 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !paymentData) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}>
        <div className="flex items-center text-red-600 mb-2">
          <FileText className="h-5 w-5 mr-2" />
          <span className="font-medium">Error cargando datos de pago</span>
        </div>
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <CreditCard className="h-6 w-6 text-blue-600 mr-3" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Datos de Pago</h3>
            <p className="text-sm text-gray-500">Orden #{paymentData.orderNumber}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-green-600">
            {formatAmount(paymentData.amount, paymentData.currency)}
          </div>
          <div className="text-sm text-gray-500 capitalize">
            {paymentData.paymentMethod}
          </div>
        </div>
      </div>

      {/* Información del Proveedor */}
      <div className="mb-6">
        <div className="flex items-center mb-3">
          <Building2 className="h-5 w-5 text-gray-400 mr-2" />
          <h4 className="font-medium text-gray-900">Proveedor</h4>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="font-medium text-gray-900">{paymentData.providerName}</p>
          {paymentData.bankInfo.razonSocial && (
            <p className="text-sm text-gray-600 mt-1">{paymentData.bankInfo.razonSocial}</p>
          )}
          {paymentData.bankInfo.cuitCuil && (
            <p className="text-sm text-gray-600">CUIT: {paymentData.bankInfo.cuitCuil}</p>
          )}
        </div>
      </div>

      {/* Información Bancaria */}
      {paymentData.paymentMethod === 'transferencia' && (
        <div className="mb-6">
          <div className="flex items-center mb-3">
            <DollarSign className="h-5 w-5 text-gray-400 mr-2" />
            <h4 className="font-medium text-gray-900">Información Bancaria</h4>
          </div>
          <div className="space-y-3">
            {paymentData.bankInfo.cbu && (
              <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">CBU</p>
                  <p className="text-sm text-gray-600 font-mono">{paymentData.bankInfo.cbu}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(paymentData.bankInfo.cbu!, 'cbu')}
                  className="flex items-center text-blue-600 hover:text-blue-700 transition-colors"
                >
                  {copiedField === 'cbu' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            )}
            
            {paymentData.bankInfo.alias && (
              <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">Alias</p>
                  <p className="text-sm text-gray-600 font-mono">{paymentData.bankInfo.alias}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(paymentData.bankInfo.alias!, 'alias')}
                  className="flex items-center text-blue-600 hover:text-blue-700 transition-colors"
                >
                  {copiedField === 'alias' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Información de la Factura */}
      {paymentData.invoiceNumber && (
        <div className="mb-6">
          <div className="flex items-center mb-3">
            <FileText className="h-5 w-5 text-gray-400 mr-2" />
            <h4 className="font-medium text-gray-900">Información de Factura</h4>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Número:</span> {paymentData.invoiceNumber}
            </p>
            {paymentData.invoiceData?.issueDate && (
              <p className="text-sm text-gray-600 mt-1">
                <span className="font-medium">Fecha:</span> {new Date(paymentData.invoiceData.issueDate).toLocaleDateString('es-AR')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Mensaje de Pago Completo */}
      <div className="border-t pt-4">
        <h4 className="font-medium text-gray-900 mb-3">Mensaje de Pago</h4>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
            {paymentData.paymentMessage}
          </pre>
        </div>
      </div>

      {/* Información de Generación */}
      <div className="mt-4 pt-4 border-t">
        <p className="text-xs text-gray-400">
          Datos generados: {new Date(paymentData.generatedAt).toLocaleString('es-AR')}
        </p>
      </div>
    </div>
  );
}
