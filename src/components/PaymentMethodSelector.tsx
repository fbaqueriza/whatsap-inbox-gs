'use client';

import { CreditCard, DollarSign, Building2, Receipt } from 'lucide-react';

interface PaymentMethodSelectorProps {
  value: 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque';
  onChange: (method: 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque') => void;
  className?: string;
}

const PAYMENT_METHODS = [
  { 
    value: 'efectivo' as const, 
    label: 'Efectivo', 
    icon: DollarSign,
    description: 'Pago en efectivo'
  },
  { 
    value: 'transferencia' as const, 
    label: 'Transferencia', 
    icon: Building2,
    description: 'Transferencia bancaria'
  },
  { 
    value: 'tarjeta' as const, 
    label: 'Tarjeta', 
    icon: CreditCard,
    description: 'Tarjeta de crédito/débito'
  },
  { 
    value: 'cheque' as const, 
    label: 'Cheque', 
    icon: Receipt,
    description: 'Cheque bancario'
  },
];

export default function PaymentMethodSelector({ value, onChange, className = '' }: PaymentMethodSelectorProps) {
  return (
    <div className={className}>
      <div className="grid grid-cols-4 gap-1.5">
        {PAYMENT_METHODS.map((method) => {
          const Icon = method.icon;
          return (
            <button
              key={method.value}
              type="button"
              onClick={() => onChange(method.value)}
              className={`p-1.5 border rounded-md text-center transition-colors ${
                value === method.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50'
              }`}
              title={method.description}
            >
              <Icon className="h-3.5 w-3.5 mx-auto mb-0.5" />
              <div className="text-[10px] font-medium leading-tight">{method.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
} 