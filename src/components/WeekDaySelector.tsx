'use client';

import { useState } from 'react';
import { Calendar } from 'lucide-react';

interface WeekDaySelectorProps {
  value: string[];
  onChange: (days: string[]) => void;
  className?: string;
}

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Lunes', short: 'Lun' },
  { value: 'tuesday', label: 'Martes', short: 'Mar' },
  { value: 'wednesday', label: 'Miércoles', short: 'Mié' },
  { value: 'thursday', label: 'Jueves', short: 'Jue' },
  { value: 'friday', label: 'Viernes', short: 'Vie' },
  { value: 'saturday', label: 'Sábado', short: 'Sáb' },
  { value: 'sunday', label: 'Domingo', short: 'Dom' },
];

export default function WeekDaySelector({ value, onChange, className = '' }: WeekDaySelectorProps) {
  const toggleDay = (day: string) => {
    console.log('DEBUG: WeekDaySelector - Toggling day:', day, 'Current value:', value);
    const newValue = value.includes(day)
      ? value.filter(d => d !== day)
      : [...value, day];
    console.log('DEBUG: WeekDaySelector - New value:', newValue);
    onChange(newValue);
  };

  const selectAll = () => {
    onChange(DAYS_OF_WEEK.map(day => day.value));
  };

  const clearAll = () => {
    onChange([]);
  };

  const selectWeekdays = () => {
    onChange(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
  };

  const getSelectedDaysText = () => {
    if (value.length === 0) return 'Seleccionar días';
    if (value.length === 7) return 'Todos los días';
    if (value.length === 5 && value.every(day => ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(day))) {
      return 'Lunes a Viernes';
    }
    return value.map(day => DAYS_OF_WEEK.find(d => d.value === day)?.short).join(', ');
  };

  return (
    <div className={className}>
      <div className="space-y-2">
        {/* Day Selection - Compact horizontal layout */}
        <div className="flex flex-wrap gap-1.5">
          {DAYS_OF_WEEK.map((day) => (
            <button
              key={day.value}
              type="button"
              onClick={() => toggleDay(day.value)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                value.includes(day.value)
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
              }`}
              title={day.label}
            >
              {day.short}
            </button>
          ))}
        </div>

        {/* Quick Selection Buttons - Compact */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={selectWeekdays}
            className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded border border-blue-200 hover:bg-blue-100"
          >
            L-V
          </button>
          <button
            type="button"
            onClick={selectAll}
            className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded border border-green-200 hover:bg-green-100"
          >
            Todos
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded border border-red-200 hover:bg-red-100"
          >
            Limpiar
          </button>
        </div>
      </div>
    </div>
  );
} 