'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import SpreadsheetGrid from '../../components/DataGrid';
import { StockItem } from '../../types';
import {
  Plus,
  Package,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Download,
  Upload,
} from 'lucide-react';
import { DataProvider, useData } from '../../components/DataProvider';
import es from '../../locales/es';
import { useRouter } from 'next/navigation';

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getRestockDays(frequency: string) {
  switch (frequency) {
    case 'daily': return 1;
    case 'weekly': return 7;
    case 'monthly': return 30;
    default: return 7;
  }
}

export default function StockPageWrapper() {
  const { user, loading: authLoading } = useSupabaseAuth();
  const router = useRouter();
  if (!authLoading && !user) {
    if (typeof window !== 'undefined') router.push('/auth/login');
    return null;
  }
  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div><p className="mt-4 text-gray-600">Cargando...</p></div></div>;
  }
  return (
    <DataProvider userEmail={user?.email ?? undefined} userId={user?.id}>
      {user && <StockPage user={user} />}
    </DataProvider>
  );
}

type StockPageProps = { user: any };
function StockPage({ user }: StockPageProps) {
  // user y authLoading ya están definidos arriba
  const { stockItems, providers, orders, addStockItem, deleteStockItem, updateStockItem, setStockItems, fetchAll } = useData();
  const [data, setData] = useState(stockItems);
  const isSeedUser = user?.email === 'test@test.com';

  const [editingModal, setEditingModal] = useState<{
    isOpen: boolean;
    type: 'frequency' | 'preferred' | 'associated';
    rowData: any;
    currentValue: any;
  } | null>(null);

  const [bulkUpdateModal, setBulkUpdateModal] = useState<{
    isOpen: boolean;
    selectedItems: any[];
    preferredProvider: string;
    associatedProviders: string[];
    restockFrequency: string;
    category: string;
  } | null>(null);
  
  // Chat state
  // Chat hooks disabled - using placeholders
  const openChat = () => console.log('Chat not available in stock page');
  const isChatOpen = false;
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);

  // Sincronizar el estado local con el contexto
  useEffect(() => {
    if (isChatOpen !== isChatPanelOpen) {
      setIsChatPanelOpen(isChatOpen);
    }
  }, [isChatOpen, isChatPanelOpen]);

  // Remove minimumQuantity and currentStock columns
  const columns = [
    { key: 'productName', name: 'Producto', width: 180, editable: true },
    { key: 'category', name: 'Categoría', width: 150, editable: true },
    { key: 'quantity', name: 'Cantidad', width: 100, editable: true },
    { key: 'unit', name: 'Unidad', width: 100, editable: true },
    {
      key: 'restockFrequency',
      name: 'Frecuencia de reposición',
      width: 180,
      editable: false,
      render: (value: any, rowData: any) => {
        const options = [
          { value: 'daily', label: 'Diario' },
          { value: 'weekly', label: 'Semanal' },
          { value: 'monthly', label: 'Mensual' },
        ];
        
        const getLabel = (val: string) => {
          const option = options.find(opt => opt.value === val);
          return option ? option.label : val;
        };
        
        return (
          <div 
            className="px-2 py-1 cursor-pointer hover:bg-gray-100"
            onClick={() => {
              setEditingModal({
                isOpen: true,
                type: 'frequency',
                rowData,
                currentValue: value || 'weekly'
              });
            }}
          >
            {getLabel(value || 'weekly')}
          </div>
        );
      },
    },
    {
      key: 'preferredProvider',
      name: 'Proveedor preferido',
      width: 200,
      editable: false,
      render: (value: any, rowData: any) => {
        const availableProviders = providers || [];
        if (!availableProviders || availableProviders.length === 0) {
          return <span className="text-gray-400">Sin proveedores disponibles</span>;
        }
        
        const getProviderById = (id: string) => availableProviders.find((p: any) => p.id === id);
        const prov = getProviderById(value);
        
        return (
          <div 
            className="px-2 py-1 cursor-pointer hover:bg-gray-100"
            onClick={() => {
              setEditingModal({
                isOpen: true,
                type: 'preferred',
                rowData,
                currentValue: value || ''
              });
            }}
          >
            {prov ? (
              <span className="flex items-center bg-green-100 text-green-800 rounded px-2 py-0.5 text-sm font-medium">
                {prov.name}
              </span>
            ) : (
              <span className="text-gray-400">Sin preferido</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'associatedProviders',
      name: 'Proveedores asociados',
      width: 200,
      editable: false,
      render: (value: any, rowData: any) => {
        const availableProviders = providers || [];
        const associatedProviders = Array.isArray(value) ? value : [];
        
        const selectedProviders = associatedProviders
          .map(providerId => availableProviders.find((p: any) => p.id === providerId))
          .filter(Boolean);
        
        return (
          <div 
            className="px-2 py-1 cursor-pointer hover:bg-gray-100"
            onClick={() => {
              setEditingModal({
                isOpen: true,
                type: 'associated',
                rowData,
                currentValue: associatedProviders
              });
            }}
          >
            {selectedProviders.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {selectedProviders.map((provider: any) => (
                  <span key={provider.id} className="bg-blue-100 text-blue-800 rounded px-2 py-0.5 text-xs font-medium">
                    {provider.name}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-gray-400">Sin proveedores</span>
            )}
          </div>
        );
      },
    },
    { 
      key: 'lastOrdered', 
      name: 'Última orden', 
      width: 150, 
      editable: false,
      render: (value: any) => {
        if (!value) return '';
        const date = new Date(value);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleDateString('es-ES', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit' 
        });
      }
    },
    { 
      key: 'nextOrder', 
      name: 'Próxima orden', 
      width: 150, 
      editable: false,
      render: (value: any) => {
        if (!value) return '';
        const date = new Date(value);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleDateString('es-ES', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit' 
        });
      }
    },
  ];

  const allowedRestockFrequencies = [
    'daily',
    'weekly',
    'monthly',
    'custom',
  ] as const;
  type RestockFrequency = (typeof allowedRestockFrequencies)[number];
  function isRestockFrequency(val: any): val is RestockFrequency {
    return allowedRestockFrequencies.includes(val);
  }

  const handleDataChange = useCallback(async (newData: any[]) => {
    console.log('handleDataChange called with:', newData);
    
    // Encontrar solo los items que realmente cambiaron
    const changedItems = newData.filter((newItem, index) => {
      const originalItem = stockItems[index];
      if (!originalItem) return false;
      
      // Comparar solo los campos editables
      return (
        newItem.productName !== originalItem.productName ||
        newItem.category !== originalItem.category ||
        newItem.quantity !== originalItem.quantity ||
        newItem.unit !== originalItem.unit ||
        newItem.restockFrequency !== originalItem.restockFrequency ||
        newItem.preferredProvider !== originalItem.preferredProvider ||
        JSON.stringify(newItem.associatedProviders) !== JSON.stringify(originalItem.associatedProviders)
      );
    });
    

    
    // Actualizar solo los items modificados
    for (const changedItem of changedItems) {
      try {
        // Preservar datos existentes que no se editaron
        const originalItem = stockItems.find(item => item.id === changedItem.id);
        if (originalItem) {
          // Validaciones mejoradas
          const updatedItem = {
            ...originalItem,
            ...changedItem,
            // Validar y convertir quantity
            quantity: changedItem.quantity === '' || changedItem.quantity === null || changedItem.quantity === undefined 
              ? 0 
              : Number(changedItem.quantity),
            // Asegurar que los arrays se mantengan como arrays
            associatedProviders: Array.isArray(changedItem.associatedProviders) 
              ? changedItem.associatedProviders 
              : originalItem.associatedProviders || [],
            // Validar fechas
            lastOrdered: changedItem.lastOrdered && !isNaN(Date.parse(String(changedItem.lastOrdered))) 
              ? new Date(changedItem.lastOrdered) 
              : originalItem.lastOrdered,
            nextOrder: changedItem.nextOrder && !isNaN(Date.parse(String(changedItem.nextOrder))) 
              ? new Date(changedItem.nextOrder) 
              : originalItem.nextOrder,
          };
          
          console.log('📝 Actualizando item:', updatedItem.id, updatedItem.productName);
          await updateStockItem(updatedItem);
        }
      } catch (error) {
        console.error('Error updating stock item:', changedItem.id, error);
      }
    }
  }, [updateStockItem, stockItems]);

  const [addingStockItem, setAddingStockItem] = useState(false);

  const handleAddRow = useCallback(() => {
    if (!user || addingStockItem) {
      console.error('No user available for adding stock item or already adding');
      return;
    }
    
    setAddingStockItem(true);
    console.log('Adding new stock item for user:', user.id);
    const newStockItem: Partial<StockItem> = {
      user_id: user.id,
      productName: '',
      category: 'Other',
      quantity: 0,
      unit: '',
      restockFrequency: 'weekly',
      associatedProviders: [],
      preferredProvider: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Forzar actualización inmediata del estado
    addStockItem(newStockItem, user.id).then(() => {
      console.log('Stock item added successfully');
      setAddingStockItem(false);
      // Forzar re-render del DataGrid
      setTimeout(() => {
        fetchAll();
      }, 100);
    }).catch(error => {
      console.error('Error adding stock item:', error);
      setAddingStockItem(false);
    });
  }, [addStockItem, user, addingStockItem, fetchAll]);

  const handleDeleteRows = useCallback(
    async (rowsToDelete: any[]) => {
      if (!rowsToDelete || rowsToDelete.length === 0) return;
      setLoading(true);
      try {
        const ids = rowsToDelete.map(row => row.id);
        await deleteStockItem(ids, user.id, true); // batch delete
      } catch (err) {
        console.error('Error deleting stock items:', rowsToDelete, err);
      }
      setLoading(false);
    },
    [deleteStockItem, user]
  );

  const handleBulkUpdate = useCallback(
    async (
      selectedItems: any[], 
      preferredProvider: string, 
      associatedProviders: string[],
      restockFrequency: string,
      category: string
    ) => {
      if (!selectedItems || selectedItems.length === 0) return;
      setLoading(true);
      try {
        console.log('📝 Actualizando', selectedItems.length, 'items');
        
        // Actualizar cada item seleccionado
        for (const item of selectedItems) {
          const updatedItem = {
            ...item,
            ...(preferredProvider === 'none' && { preferredProvider: '' }),
            ...(preferredProvider !== '' && preferredProvider !== 'none' && { preferredProvider }),
            ...(associatedProviders.length > 0 && { associatedProviders }),
            ...(restockFrequency !== '' && { restockFrequency }),
            ...(category !== '' && { category }),
            updatedAt: new Date(),
          };
          await updateStockItem(updatedItem);
        }
        
        const changes = [];
        if (preferredProvider === 'none') changes.push('proveedor preferido (sin preferido)');
        else if (preferredProvider !== '') changes.push('proveedor preferido');
        if (associatedProviders.length > 0) changes.push('proveedores asociados');
        if (restockFrequency !== '') changes.push('frecuencia de reposición');
        if (category !== '') changes.push('categoría');
        
        setImportMessage(`✅ ¡${changes.join(', ')} actualizados exitosamente en ${selectedItems.length} productos!`);
        
        // Actualizar los datos después de la asignación
        setTimeout(() => {
          fetchAll();
        }, 500);
        
      } catch (err) {
        console.error('Error updating items:', selectedItems, err);
        setImportMessage(`❌ Error al actualizar productos: ${err}`);
      }
      setLoading(false);
    },
    [updateStockItem, user, fetchAll]
  );

  const handleExport = useCallback(() => {
    const headers = [
      'Producto',
      'Categoría',
      'Cantidad',
      'Unidad',
      'Frecuencia de Reposición',
      'Proveedores Asociados',
      'Proveedor Preferido',
      'Última Orden',
      'Próxima Orden',
    ];
    
    // Función para convertir frecuencia al español
    const frequencyToSpanish = (freq: string) => {
      const freqMap: Record<string, string> = {
        'daily': 'Diario',
        'weekly': 'Semanal',
        'monthly': 'Mensual',
        'custom': 'Personalizado',
      };
      return freqMap[freq] || freq;
    };
    
    // Función para convertir ID de proveedor a nombre
    const getProviderName = (providerId: string) => {
      if (!providerId) return '';
      const provider = providers?.find((p: any) => p.id === providerId);
      return provider ? provider.name : providerId;
    };
    
    const csvContent = [
      headers.join(','),
      ...stockItems.map((item) =>
        [
          item.productName ?? '',
          item.category ?? '',
          item.quantity ?? '',
          item.unit ?? '',
          frequencyToSpanish(item.restockFrequency ?? ''),
          (item.associatedProviders ?? [])
            .map(getProviderName)
            .filter(Boolean)
            .join(';'),
          getProviderName(item.preferredProvider ?? ''),
          item.lastOrdered ? new Date(item.lastOrdered).toISOString().split('T')[0] : '',
          item.nextOrder ? new Date(item.nextOrder).toISOString().split('T')[0] : '',
        ].map(v => {
          const stringValue = String(v ?? '');
          // Si contiene comas, comillas, saltos de línea o espacios, encerrar en comillas
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes(' ')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',')
      ),
    ].join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  }, [stockItems, providers]);

  const handleDownloadTemplate = useCallback(() => {
    const headers = [
      'Producto',
      'Categoría',
      'Cantidad',
      'Unidad',
      'Frecuencia de Reposición',
      'Proveedores Asociados',
      'Proveedor Preferido',
      'Última Orden',
      'Próxima Orden'
    ];
    
    const exampleRow = [
      'Harina de trigo',
      'Harinas',
      '50',
      'kg',
      'Semanal',
      'Proveedor A;Proveedor B',
      'Proveedor A',
      '2025-01-20',
      '2025-01-27'
    ];
    
    // Función para escapar valores CSV
    const escapeCSV = (value: string) => {
      const stringValue = String(value);
      // Si contiene comas, comillas, saltos de línea, encerrar en comillas y escapar comillas internas
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes(':')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };
    
    const csvLines = [
      headers.map(escapeCSV).join(','),
      exampleRow.map(escapeCSV).join(','),
      '', // Línea vacía
      '"INSTRUCCIONES:"',
      '"Producto: Nombre del producto (OBLIGATORIO)"',
      '"Categoría: Categoría del producto (OBLIGATORIO)"',
      '"Cantidad: Cantidad en stock (OBLIGATORIO, número)"',
      '"Unidad: Unidad de medida (ej: kg, lt, unidades)"',
      '"Frecuencia de Reposición: Diario, Semanal, Mensual, Personalizado"',
      '"Proveedores Asociados: Nombres de proveedores separados por ;"',
      '"Proveedor Preferido: Nombre del proveedor preferido"',
      '"Última Orden: Fecha de última orden (YYYY-MM-DD)"',
      '"Próxima Orden: Fecha de próxima orden (YYYY-MM-DD)"',
      '',
      '"EJEMPLO DE USO:"',
      '"Agrega tus productos debajo de la fila de ejemplo, una fila por producto."',
      '"Los proveedores deben existir en tu sistema para que se asignen correctamente."',
      '"Las fechas deben estar en formato YYYY-MM-DD (año-mes-día)."'
    ];
    
    const templateContent = csvLines.join('\n');
    
    // Crear el blob con BOM para UTF-8
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + templateContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  }, []);

  const [loading, setLoading] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  // Update handleImport to persist to Supabase
  const handleImport = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(Boolean);
      if (lines.length < 2) {
        setImportMessage('El archivo CSV está vacío o no tiene datos.');
        return;
      }
      // Limpiar BOM y parsear headers con parseCsvRow
      let rawHeaders = parseCsvRow(lines[0]);
      if (rawHeaders[0].charCodeAt(0) === 0xFEFF) {
        rawHeaders[0] = rawHeaders[0].slice(1);
      }
      // Normalizar headers (igual que en proveedores)
      const normalizeHeader = (str: string) => str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '');
      const headerMap: Record<string, string> = {
        // Producto
        'producto': 'productName',
        'productname': 'productName',
        'product_name': 'productName',
        // Categoría
        'categoria': 'category',
        'categoría': 'category',
        'category': 'category',
        // Cantidad
        'cantidad': 'quantity',
        'quantity': 'quantity',
        // Unidad
        'unidad': 'unit',
        'unit': 'unit',
        // Frecuencia de Reposición
        'frecuenciadereposicion': 'restockFrequency',
        'frecuenciadereposición': 'restockFrequency',
        'frecuenciadereposicion': 'restockFrequency',
        'restockfrequency': 'restockFrequency',
        'restock_frequency': 'restockFrequency',
        'frecuencia': 'restockFrequency',
        'frecuenciaderepocicion': 'restockFrequency',
        'frecuenciareposicion': 'restockFrequency',
        // Proveedores Asociados
        'proveedoresasociados': 'associatedProviders',
        'associatedproviders': 'associatedProviders',
        'associated_providers': 'associatedProviders',
        // Proveedor Preferido
        'proveedorpreferido': 'preferredProvider',
        'proveedorpreferído': 'preferredProvider',
        'preferredprovider': 'preferredProvider',
        'preferred_provider': 'preferredProvider',
        // Última Orden
        'ultimaorden': 'lastOrdered',
        'últimaorden': 'lastOrdered',
        'lastordered': 'lastOrdered',
        'last_order': 'lastOrdered',
        // Próxima Orden
        'proximaorden': 'nextOrder',
        'próximaorden': 'nextOrder',
        'nextorder': 'nextOrder',
        'next_order': 'nextOrder',
        // Otros
        'createdat': 'createdAt',
        'created_at': 'createdAt',
        'updatedat': 'updatedAt',
        'updated_at': 'updatedAt',
      };
      const normalizedRawHeaders = rawHeaders.map(h => normalizeHeader(h));
      const headers = normalizedRawHeaders.map(h => headerMap[h] || h);
      console.log('HEADERS:', headers);
      const required = ['productName', 'category', 'quantity', 'unit', 'restockFrequency'];
      const missing = required.filter(r => !headers.includes(r));
      if (missing.length > 0) {
        setImportMessage(`Faltan columnas requeridas: ${missing.join(', ')}. El archivo debe contener las columnas: Producto, Categoría, Cantidad, Unidad, Frecuencia de Reposición. Puedes descargar la plantilla desde el botón "Descargar plantilla" para ver el formato correcto.`);
        return;
      }
      const importedStock = lines.slice(1).map(line => {
        const values = parseCsvRow(line);
        const row: any = {};
        headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
        console.log('ROW:', row);
        let associatedProviders: string[] = [];
        if (row.associatedProviders && typeof row.associatedProviders === 'string') {
          associatedProviders = row.associatedProviders.split(';').map((p: string) => p.trim()).filter(Boolean);
        }
        const providerNameToId = (name: string) => {
          if (!name) return '';
          // Buscar por nombre exacto primero
          let prov = providers?.find((p: any) => p.name?.toLowerCase().trim() === name.toLowerCase().trim());
          // Si no encuentra, buscar por coincidencia parcial
          if (!prov) {
            prov = providers?.find((p: any) => 
              p.name?.toLowerCase().includes(name.toLowerCase().trim()) || 
              name.toLowerCase().trim().includes(p.name?.toLowerCase())
            );
          }
          return prov ? prov.id : name;
        };
        associatedProviders = associatedProviders.map(providerNameToId);
        let preferredProvider = row.preferredProvider ? row.preferredProvider.trim() : '';
        preferredProvider = providerNameToId(preferredProvider);
        const lastOrdered = row.lastOrdered && !isNaN(Date.parse(row.lastOrdered)) ? new Date(row.lastOrdered) : undefined;
        const nextOrder = row.nextOrder && !isNaN(Date.parse(row.nextOrder)) ? new Date(row.nextOrder) : undefined;
        const quantity = row.quantity && !isNaN(Number(row.quantity)) ? Number(row.quantity) : 0;
        const freqMap: Record<string, string> = {
          'diario': 'daily',
          'Diario': 'daily',
          'daily': 'daily',
          'semanal': 'weekly',
          'Semanal': 'weekly',
          'weekly': 'weekly',
          'mensual': 'monthly',
          'Mensual': 'monthly',
          'monthly': 'monthly',
          'personalizado': 'custom',
          'Personalizado': 'custom',
          'custom': 'custom',
        };
        let restockFrequency = row.restockFrequency?.trim();
        restockFrequency = freqMap[restockFrequency] || freqMap[restockFrequency?.toLowerCase()] || restockFrequency;
        const allowedFrequencies = ['daily','weekly','monthly','custom'];
        const finalRestockFrequency = allowedFrequencies.includes(restockFrequency) ? restockFrequency : 'weekly';
        return {
          productName: row.productName || '',
          category: row.category || '',
          quantity,
          unit: row.unit || '',
          restockFrequency: finalRestockFrequency,
          associatedProviders,
          preferredProvider,
          lastOrdered,
          nextOrder,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      })
      .filter(item => item.productName && item.productName.trim() !== ''); // Solo importar si tiene productName
      setLoading(true);
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      
      try {
        if (importedStock.length > 0) {
          console.log('📦 Importando stock:', importedStock.length, 'productos');
          
          // Validar datos antes de insertar
          const validItems = importedStock.filter((item, index) => {
            if (!item.productName || item.productName.trim() === '') {
              errors.push(`Fila ${index + 2}: Falta nombre del producto`);
              return false;
            }
            if (!item.category || item.category.trim() === '') {
              errors.push(`Fila ${index + 2}: Falta categoría para "${item.productName}"`);
              return false;
            }
            if (isNaN(item.quantity) || item.quantity < 0) {
              errors.push(`Fila ${index + 2}: Cantidad inválida para "${item.productName}"`);
              return false;
            }
            return true;
          });
          
          if (validItems.length > 0) {
            await addStockItem(validItems, user.id, true); // batch insert
            successCount = validItems.length;
          }
          
          errorCount = importedStock.length - validItems.length;
        }
      } catch (err: any) {
        console.error('Error importing stock batch:', err);
        let errorMsg = 'Error desconocido';
        if (err && (err.message || err.details)) {
          errorMsg = err.message || err.details;
        } else if (typeof err === 'string') {
          errorMsg = err;
        } else if (err && err.toString) {
          errorMsg = err.toString();
        }
        errors.push(`Error general: ${errorMsg}`);
        errorCount = importedStock.length;
      }
      
      setLoading(false);
      
      if (errorCount === 0) {
        setImportMessage(`✅ ¡Importación exitosa! Se importaron ${successCount} productos de stock.`);
        // Actualizar los datos después de la importación exitosa
        setTimeout(() => {
          fetchAll();
        }, 500);
      } else if (successCount > 0) {
        setImportMessage(`⚠️ Importación parcial: ${successCount} éxitos, ${errorCount} errores. ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`);
      } else {
        setImportMessage(`❌ Error en la importación: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`);
      }
    };
    reader.readAsText(file);
  }, [addStockItem, providers, user, fetchAll]);

  // Get unique categories from stock items
  const uniqueCategories = useMemo(() => {
    const categories = stockItems.map(item => item.category).filter(Boolean);
    return Array.from(new Set(categories)).sort();
  }, [stockItems]);

  // Remove lowStockItems and quick stats that depend on removed columns

  // Dynamically calculate lastOrdered and nextOrder for each stock item
  const stockWithDates = stockItems.map((item) => {
    // Find all completed orders for this item
    const completedOrders = orders.filter((order) =>
      (order.status === 'confirmed' || order.status === 'delivered') &&
      order.items.some((orderItem) => orderItem.productName === item.productName)
    );
    let lastOrdered: Date | undefined = undefined;
    if (completedOrders.length > 0) {
      lastOrdered = new Date(Math.max(...completedOrders.map((o) => new Date(o.orderDate).getTime())));
    }
    // Calculate nextOrder
    let nextOrder: Date | undefined = undefined;
    if (lastOrdered) {
      nextOrder = addDays(lastOrdered, getRestockDays(item.restockFrequency));
    }
    return {
      ...item,
      lastOrdered,
      nextOrder,
    };
  });

  // Add a migration useEffect to convert provider names to IDs in stockItems
  useEffect(() => {
    if (!providers || providers.length === 0) return;
    let changed = false;
    // Normaliza para comparar
    const normalize = (str: string) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    const migrated = stockItems.map(item => {
      // Migrate associatedProviders: if value is an ID, replace with provider name
      let newAssociated = Array.isArray(item.associatedProviders) ? item.associatedProviders.map(val => {
        // If it's a name, keep it
        if (providers.some(p => normalize(p.name) === normalize(val || ''))) return val;
        // If it's an ID, find the provider and use its name
        const found = providers.find(p => String(p.id) === String(val));
        if (found) { changed = true; return found.name; }
        return val;
      }) : [];
      newAssociated = Array.from(new Set(newAssociated));
      // Migrate preferredProvider
      let newPreferred = item.preferredProvider;
      if (newPreferred && !providers.some(p => normalize(p.name) === normalize(newPreferred || ''))) {
        const found = providers.find(p => String(p.id) === String(newPreferred));
        if (found) { changed = true; newPreferred = found.name; }
      }
      return { ...item, associatedProviders: newAssociated, preferredProvider: newPreferred };
    });
    // setStockItems(migrated); // This line was removed
  }, [providers]);

  // MIGRACIÓN: Al cargar stockItems o providers, convierte nombres a IDs
  React.useEffect(() => {
    if (!providers || providers.length === 0 || !stockItems || stockItems.length === 0) return;
    let changed = false;
    const getIdByName = (name: string) => {
      const prov = providers.find(p => p.name === name);
      return prov ? prov.id : name;
    };
    const migrated = stockItems.map(item => {
      let newAssociated = Array.isArray(item.associatedProviders)
        ? item.associatedProviders.map(val => providers.some(p => p.id === val) ? val : getIdByName(val))
        : [];
      newAssociated = Array.from(new Set(newAssociated));
      let newPreferred = item.preferredProvider;
      if (newPreferred && !providers.some(p => p.id === newPreferred)) {
        newPreferred = getIdByName(newPreferred);
      }
      if (
        JSON.stringify(newAssociated) !== JSON.stringify(item.associatedProviders) ||
        newPreferred !== item.preferredProvider
      ) {
        changed = true;
        return { ...item, associatedProviders: newAssociated, preferredProvider: newPreferred };
      }
      return item;
    });
    // setStockItems(migrated); // This line was removed
  }, [providers, stockItems]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__GLOBAL_PROVIDERS__ = providers;
    }
  }, [providers]);



  if (!user) {
    return null; // Will redirect to login
  }

  // Removed the blocking check for providers - allow stock page to load even without providers

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Package className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Gestión de Stock</h1>
                  <p className="text-sm text-gray-500">
                    Administra tu inventario y proveedores
                  </p>
                </div>
              </div>
              <div className="flex space-x-3">
                {/* Botones removidos - solo se usan desde SpreadsheetGrid */}
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                💡 <strong>¿Necesitas agregar muchos productos?</strong> Usa "Exportar" para descargar la planilla, 
                completa tus datos y luego "Importar" para cargarlos de manera masiva.
              </p>
            </div>
            
            {importMessage && (
              <div className={`mb-4 p-3 rounded-md border ${
                importMessage.includes('✅') 
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : importMessage.includes('⚠️')
                  ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <p className="text-sm">{importMessage}</p>
              </div>
            )}
            <SpreadsheetGrid
              columns={columns}
              data={stockItems}
              onDataChange={handleDataChange}
              onExport={handleExport}
              onImport={handleImport}
              onDownloadTemplate={handleDownloadTemplate}
              onAddRow={handleAddRow}
              onDeleteRows={handleDeleteRows}
              onAssignProviders={(selectedItems) => {
                setBulkUpdateModal({
                  isOpen: true,
                  selectedItems,
                  preferredProvider: '',
                  associatedProviders: [],
                  restockFrequency: '',
                  category: '',
                });
              }}
              loading={loading}
            />
          </div>
        </div>
      </div>

      {/* Modal de Edición */}
      {editingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingModal.type === 'frequency' && 'Editar Frecuencia de Reposición'}
              {editingModal.type === 'preferred' && 'Editar Proveedor Preferido'}
              {editingModal.type === 'associated' && 'Editar Proveedores Asociados'}
            </h3>
            
            {editingModal.type === 'frequency' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Frecuencia de reposición
                </label>
                <select
                  value={editingModal.currentValue}
                  onChange={(e) => {
                    const newData = stockItems.map((item: any) => 
                      item.id === editingModal.rowData.id 
                        ? { ...item, restockFrequency: e.target.value }
                        : item
                    );
                    handleDataChange(newData);
                    setEditingModal(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="daily">Diario</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensual</option>
                </select>
              </div>
            )}

            {editingModal.type === 'preferred' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proveedor preferido
                </label>
                <select
                  value={editingModal.currentValue}
                  onChange={(e) => {
                    const newData = stockItems.map((item: any) => 
                      item.id === editingModal.rowData.id 
                        ? { ...item, preferredProvider: e.target.value }
                        : item
                    );
                    handleDataChange(newData);
                    setEditingModal(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Sin preferido</option>
                  {providers.map((provider: any) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {editingModal.type === 'associated' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proveedores asociados
                </label>
                <select
                  multiple
                  value={editingModal.currentValue}
                  onChange={(e) => {
                    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                    const newData = stockItems.map((item: any) => 
                      item.id === editingModal.rowData.id 
                        ? { ...item, associatedProviders: selectedOptions }
                        : item
                    );
                    handleDataChange(newData);
                    setEditingModal(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  size={Math.min(providers.length, 8)}
                >
                  {providers.map((provider: any) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Mantén Ctrl (Cmd en Mac) para seleccionar múltiples
                </p>
              </div>
            )}

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setEditingModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Actualización Masiva */}
      {bulkUpdateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Actualizar {bulkUpdateModal.selectedItems.length} Productos
            </h3>
            
            <div className="space-y-4">
              <div className="bg-yellow-50 p-3 rounded-md">
                <p className="text-sm text-yellow-800">
                  <strong>💡 Tip:</strong> Deja los campos vacíos para mantener los valores actuales
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categoría
                </label>
                <select
                  value={bulkUpdateModal.category}
                  onChange={(e) => {
                    setBulkUpdateModal(prev => prev ? {
                      ...prev,
                      category: e.target.value
                    } : null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Mantener categoría actual</option>
                  {uniqueCategories.map((category: string) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Frecuencia de Reposición
                </label>
                <select
                  value={bulkUpdateModal.restockFrequency}
                  onChange={(e) => {
                    setBulkUpdateModal(prev => prev ? {
                      ...prev,
                      restockFrequency: e.target.value
                    } : null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Mantener frecuencia actual</option>
                  <option value="daily">Diario</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensual</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proveedor Preferido
                </label>
                <select
                  value={bulkUpdateModal.preferredProvider}
                  onChange={(e) => {
                    setBulkUpdateModal(prev => prev ? {
                      ...prev,
                      preferredProvider: e.target.value
                    } : null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Mantener proveedor actual</option>
                  <option value="none">Sin preferido</option>
                  {providers.map((provider: any) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proveedores Asociados
                </label>
                <select
                  multiple
                  value={bulkUpdateModal.associatedProviders}
                  onChange={(e) => {
                    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                    setBulkUpdateModal(prev => prev ? {
                      ...prev,
                      associatedProviders: selectedOptions
                    } : null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  size={Math.min(providers.length, 6)}
                >
                  {providers.map((provider: any) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Mantén Ctrl (Cmd en Mac) para seleccionar múltiples. Vacío = mantener actual
                </p>
              </div>

              <div className="bg-blue-50 p-3 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Productos seleccionados:</strong>
                </p>
                <ul className="text-sm text-blue-700 mt-1">
                  {bulkUpdateModal.selectedItems.slice(0, 3).map((item: any) => (
                    <li key={item.id}>• {item.productName}</li>
                  ))}
                  {bulkUpdateModal.selectedItems.length > 3 && (
                    <li>• y {bulkUpdateModal.selectedItems.length - 3} más...</li>
                  )}
                </ul>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setBulkUpdateModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (bulkUpdateModal) {
                    handleBulkUpdate(
                      bulkUpdateModal.selectedItems,
                      bulkUpdateModal.preferredProvider,
                      bulkUpdateModal.associatedProviders,
                      bulkUpdateModal.restockFrequency,
                      bulkUpdateModal.category
                    );
                    setBulkUpdateModal(null);
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
              >
                Actualizar Productos
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Botón flotante del chat */}
      {/* ChatFloatingButton
        onToggleChat={() => setIsChatPanelOpen(!isChatPanelOpen)}
        isChatOpen={isChatPanelOpen}
      /> */}
    </div>
  );
}

// Función robusta para parsear filas CSV (ya existe en el archivo, reutilizar)
function parseCsvRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
