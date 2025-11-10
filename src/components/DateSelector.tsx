'use client';

import { useState, useEffect, useRef } from 'react';
import { Calendar, Clock } from 'lucide-react';

interface DateSelectorProps {
  value: string;
  onChange: (date: string) => void;
  className?: string;
  providerDeliveryDays?: string[];
  providerDeliveryTime?: string[];
  timeRanges?: string[];
  onTimeRangesChange?: (times: string[]) => void;
}

const TIME_RANGES = [
  { value: '08:00-10:00', label: '8:00 - 10:00 AM', description: 'Mañana temprano' },
  { value: '10:00-12:00', label: '10:00 - 12:00 AM', description: 'Mañana' },
  { value: '12:00-14:00', label: '12:00 - 2:00 PM', description: 'Mediodía' },
  { value: '14:00-16:00', label: '2:00 - 4:00 PM', description: 'Tarde' },
  { value: '16:00-18:00', label: '4:00 - 6:00 PM', description: 'Tarde tarde' },
  { value: '18:00-20:00', label: '6:00 - 8:00 PM', description: 'Noche' },
];

export default function DateSelector({ 
  value, 
  onChange, 
  className = '',
  providerDeliveryDays,
  providerDeliveryTime,
  timeRanges = [],
  onTimeRangesChange
}: DateSelectorProps) {
  const [showQuickOptions, setShowQuickOptions] = useState(false);
  const [showTimeSelector, setShowTimeSelector] = useState(false);
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [customStartTime, setCustomStartTime] = useState('');
  const [customEndTime, setCustomEndTime] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const getQuickDates = () => {
    const today = new Date();
    const dates = [];
    
    // Próximos 7 días
    for (let i = 1; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push({
        value: date.toISOString().split('T')[0],
        label: date.toLocaleDateString('es-ES', { 
          weekday: 'short', 
          month: 'short', 
          day: 'numeric' 
        }),
        isToday: i === 1
      });
    }

    // Si hay días de entrega del proveedor, agregar opciones específicas
    if (providerDeliveryDays && providerDeliveryTime && providerDeliveryTime.length > 0) {
      const deliveryDates = [];
      for (let i = 1; i <= 14; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
        
        if (providerDeliveryDays.includes(dayName)) {
          // Usar el primer horario disponible
          const firstTime = providerDeliveryTime[0];
          deliveryDates.push({
            value: date.toISOString().split('T')[0],
            label: `${date.toLocaleDateString('es-ES', { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric' 
            })} (${firstTime})`,
            isDeliveryDay: true
          });
        }
      }
      return [...dates, ...deliveryDates];
    }

    return dates;
  };

  const getTimeCategory = (time: string) => {
    const startHour = parseInt(time.split('-')[0].split(':')[0]);
    if (startHour < 12) return 'morning';
    if (startHour < 18) return 'afternoon';
    return 'evening';
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'morning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'afternoon': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'evening': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const toggleTimeRange = (timeRange: string) => {
    if (!onTimeRangesChange) return;
    
    const newValue = timeRanges.includes(timeRange)
      ? timeRanges.filter(t => t !== timeRange)
      : [...timeRanges, timeRange];
    onTimeRangesChange(newValue);
  };

  const addCustomTimeRange = () => {
    if (!onTimeRangesChange || !customStartTime || !customEndTime) return;
    
    const customRange = `${customStartTime}-${customEndTime}`;
    if (!timeRanges.includes(customRange)) {
      onTimeRangesChange([...timeRanges, customRange]);
    }
    setCustomStartTime('');
    setCustomEndTime('');
  };

  // 🔧 CORRECCIÓN: Función para traducir días de inglés a español
  const translateDeliveryDays = (days: string[]): string[] => {
    const dayTranslations: { [key: string]: string } = {
      'monday': 'Lunes',
      'tuesday': 'Martes', 
      'wednesday': 'Miércoles',
      'thursday': 'Jueves',
      'friday': 'Viernes',
      'saturday': 'Sábado',
      'sunday': 'Domingo',
      'mon': 'Lun',
      'tue': 'Mar',
      'wed': 'Mié',
      'thu': 'Jue',
      'fri': 'Vie',
      'sat': 'Sáb',
      'sun': 'Dom'
    };

    return days.map(day => {
      const normalizedDay = day.toLowerCase().trim();
      return dayTranslations[normalizedDay] || day;
    });
  };

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // 🔧 CORRECCIÓN: Solo cerrar si el clic es completamente fuera del DateSelector
      const target = event.target as Node;
      
      // Verificar si el clic es dentro del DateSelector
      if (containerRef.current && containerRef.current.contains(target)) {
        return; // No hacer nada si el clic es dentro del DateSelector
      }
      
      // Verificar si el clic es dentro del modal padre
      const modalElement = document.querySelector('[data-modal="true"]');
      if (modalElement && modalElement.contains(target)) {
        return; // No hacer nada si el clic es dentro del modal
      }
      
      // Solo cerrar si el clic es completamente fuera
      setShowQuickOptions(false);
      setShowTimeSelector(false);
    };

    // 🔧 MEJORA: Usar capture phase para interceptar eventos antes
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, []);

  const quickDates = getQuickDates();

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        <Calendar className="inline h-4 w-4 mr-1" />
        Fecha de entrega deseada
      </label>
      
      <div className="flex gap-2">
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowQuickOptions(!showQuickOptions);
            setShowTimeSelector(false); // Close time selector when opening date selector
          }}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <Calendar className="h-4 w-4" />
        </button>
        {onTimeRangesChange && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowTimeSelector(!showTimeSelector);
              setShowQuickOptions(false); // Close date selector when opening time selector
            }}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Clock className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Date Quick Options */}
      {showQuickOptions && (
        <div 
          className="absolute z-[9999] mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-3">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Fechas sugeridas</h4>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {quickDates.map((date) => (
                <button
                  key={date.value}
                  type="button"
                  onClick={() => {
                    onChange(date.value);
                    setShowQuickOptions(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    value === date.value
                      ? 'bg-blue-100 text-blue-700'
                      : 'hover:bg-gray-100 text-gray-700'
                  } ${date.isDeliveryDay ? 'border-l-4 border-green-500' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span>{date.label}</span>
                    {date.isDeliveryDay && (
                      <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                        Entrega
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Time Range Selector */}
      {showTimeSelector && onTimeRangesChange && (
        <div 
          className="absolute z-[9999] mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-3 space-y-3">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Rangos horarios</h4>
            
            {/* Quick Time Selection */}
            <div className="grid grid-cols-2 gap-2">
              {TIME_RANGES.map((timeRange) => {
                const category = getTimeCategory(timeRange.value);
                const isSelected = timeRanges.includes(timeRange.value);
                
                return (
                  <button
                    key={timeRange.value}
                    type="button"
                    onClick={() => toggleTimeRange(timeRange.value)}
                    className={`p-2 rounded-lg text-center transition-colors border min-h-[60px] flex flex-col justify-center ${
                      isSelected
                        ? 'bg-blue-500 text-white border-blue-600 shadow-md'
                        : `${getCategoryColor(category)} hover:border-blue-300`
                    }`}
                  >
                    <div className="text-xs font-medium mb-1">{timeRange.label}</div>
                    <div className="text-[9px] opacity-75 leading-tight">{timeRange.description}</div>
                  </button>
                );
              })}
            </div>

            {/* Custom Time Input */}
            <div className="border-t pt-3">
              <button
                type="button"
                onClick={() => setShowCustomTime(!showCustomTime)}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                {showCustomTime ? 'Ocultar hora personalizada' : 'Hora personalizada'}
              </button>

              {showCustomTime && (
                <div className="mt-3 space-y-3 p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Agregar rango personalizado:
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={customStartTime}
                      onChange={(e) => setCustomStartTime(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Hora inicio"
                    />
                    <span className="text-sm text-gray-500">a</span>
                    <input
                      type="time"
                      value={customEndTime}
                      onChange={(e) => setCustomEndTime(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Hora fin"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        addCustomTimeRange();
                      }}
                      disabled={!customStartTime || !customEndTime}
                      className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      Agregar
                    </button>
                  </div>
                  <div className="text-xs text-gray-500">
                    Formato: HH:MM (24 horas)
                  </div>
                </div>
              )}
            </div>

            {/* Selected Times Display */}
            {timeRanges.length > 0 && (
              <div className="border-t pt-3">
                <div className="text-sm text-gray-600 mb-2">
                  <strong>Horarios seleccionados:</strong>
                </div>
                <div className="space-y-1">
                  {timeRanges.map((time, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded border">
                      <span className="text-sm">{time}</span>
                      <button
                        type="button"
                        onClick={() => toggleTimeRange(time)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {providerDeliveryDays && providerDeliveryTime && (
        <p className="mt-1 text-xs text-gray-500">
          Días de entrega del proveedor: {translateDeliveryDays(providerDeliveryDays).join(', ')}
          {Array.isArray(providerDeliveryTime) && providerDeliveryTime.length === 2 && providerDeliveryTime[0] && providerDeliveryTime[1]
            ? ` de ${providerDeliveryTime[0]} a ${providerDeliveryTime[1]}`
            : Array.isArray(providerDeliveryTime) && providerDeliveryTime.length > 0
              ? ` a las ${providerDeliveryTime[0]}`
              : typeof providerDeliveryTime === 'string'
                ? ` a las ${providerDeliveryTime}`
                : ''}
        </p>
      )}
    </div>
  );
} 