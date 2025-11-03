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
    type: 'frequency' | 'preferred';
    rowData: any;
    currentValue: any;
  } | null>(null);

  const [bulkUpdateModal, setBulkUpdateModal] = useState<{
    isOpen: boolean;
    selectedItems: any[];
    preferredProvider: string;
    restockFrequency: string;
    category: string;
  } | null>(null);
  // Subida manual de facturas
  const [invoiceProviderId, setInvoiceProviderId] = useState<string>('');
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceUploading, setInvoiceUploading] = useState(false);
  const [invoiceMessage, setInvoiceMessage] = useState<string | null>(null);
  const [showInvoiceToast, setShowInvoiceToast] = useState(false);

  useEffect(() => {
    if (!invoiceMessage) return;
    // Scroll al banner embebido
    const el = document.getElementById('invoice-upload-status');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Mostrar toast fijo
    setShowInvoiceToast(true);
    const t = setTimeout(() => setShowInvoiceToast(false), 6000);
    return () => clearTimeout(t);
  }, [invoiceMessage]);
  
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
    { key: 'lastPriceNet', name: 'Precio Unit.', width: 130, editable: false,
      render: (value: any) => {
        if (!value && value !== 0) return '';
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value) || 0);
      }
    },
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
      name: 'Proveedor',
      width: 220,
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
              <span className="text-gray-400">Seleccionar proveedor</span>
            )}
          </div>
        );
      },
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
            ...(restockFrequency !== '' && { restockFrequency }),
            ...(category !== '' && { category }),
            updatedAt: new Date(),
          };
          await updateStockItem(updatedItem);
        }
        
        const changes = [];
        if (preferredProvider === 'none') changes.push('proveedor preferido (sin preferido)');
        else if (preferredProvider !== '') changes.push('proveedor preferido');
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
      'Proveedor'
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
          getProviderName(item.preferredProvider ?? '')
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
      'Proveedor'
    ];
    
    const exampleRow = [
      'Harina de trigo',
      'Harinas',
      '50',
      'kg',
      'Semanal',
      'Proveedor A'
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
      '"Proveedor: Nombre del proveedor único del producto"',
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
        // Proveedor (único)
        'proveedor': 'preferredProvider',
        'proveedorpreferido': 'preferredProvider',
        'preferredprovider': 'preferredProvider',
        'preferred_provider': 'preferredProvider',
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
        let preferredProvider = row.preferredProvider ? row.preferredProvider.trim() : '';
        preferredProvider = providerNameToId(preferredProvider || row.proveedor);
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
          preferredProvider,
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

  // Eliminado cálculo de última/próxima orden (no se muestran en UI)

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
            {/* Toast fijo de estado de carga/proceso */}
            {showInvoiceToast && invoiceMessage && (
              <div className={`fixed right-4 top-20 z-50 px-4 py-3 rounded shadow border ${
                invoiceMessage.startsWith('✅')
                  ? 'bg-green-50 text-green-800 border-green-200'
                  : invoiceMessage.startsWith('⚠️')
                  ? 'bg-yellow-50 text-yellow-800 border-yellow-200'
                  : invoiceMessage.startsWith('Procesando')
                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}>
                <div className="flex items-start gap-3">
                  <span>{invoiceMessage}</span>
                  <button type="button" onClick={() => setShowInvoiceToast(false)} className="text-sm opacity-70 hover:opacity-100">✕</button>
                </div>
              </div>
            )}
            {/* Subida manual de facturas */}
            <form onSubmit={(e) => e.preventDefault()} className="mb-6 p-4 border border-gray-200 rounded-md bg-gray-50">
              <div className="flex flex-col md:flex-row md:items-end gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                  <select
                    value={invoiceProviderId}
                    onChange={(e) => setInvoiceProviderId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar proveedor</option>
                    {providers?.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Archivo de factura (PDF/imagen)</label>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <button
                    type="button"
                    disabled={!invoiceFile || invoiceUploading}
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!invoiceFile) return;
                      console.log('📤 Subiendo factura manual (Stock)');
                      setInvoiceUploading(true);
                      setInvoiceMessage('Procesando factura...');
                      setShowInvoiceToast(true);
                      setTimeout(() => {
                        const el = document.getElementById('invoice-upload-status');
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 0);
                      try {
                        const form = new FormData();
                        form.append('file', invoiceFile);
                        form.append('userId', user.id);
                        // Timeout seguro para subida
                        setInvoiceMessage('Subiendo archivo...');
                        const uploadController = new AbortController();
                        const uploadTimer = setTimeout(() => uploadController.abort(), 60000);
                        const upRes = await fetch('/api/facturas/upload-invoice', { method: 'POST', body: form, signal: uploadController.signal }).catch((e) => {
                          if (e?.name === 'AbortError') throw new Error('Tiempo de espera agotado al subir la factura');
                          throw e;
                        }).finally(() => clearTimeout(uploadTimer));
                        const up = await upRes.json();
                        if (!up.success) {
                          setInvoiceMessage(`❌ ${up.error || 'Error subiendo archivo'}`);
                          alert(up.error || 'Error subiendo archivo');
                          throw new Error(up.error || 'Error subiendo archivo');
                        }
                        setInvoiceMessage('Archivo subido. Procesando OCR...');
                        // Timeout seguro para procesamiento
                        const processController = new AbortController();
                        const processTimer = setTimeout(() => processController.abort(), 120000);
                        const procRes = await fetch('/api/facturas/process-invoice', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            fileUrl: up.fileUrl,
                            providerId: invoiceProviderId || undefined,
                            userId: user.id,
                            async: true
                          }),
                          signal: processController.signal
                        }).catch((e) => {
                          if (e?.name === 'AbortError') throw new Error('Tiempo de espera agotado al procesar la factura');
                          throw e;
                        }).finally(() => clearTimeout(processTimer));
                        const proc = await procRes.json();
                        if (!proc.success && procRes.status !== 202) {
                          setInvoiceMessage(`❌ ${proc.error || 'Error procesando factura'}`);
                          alert(proc.error || 'Error procesando factura');
                          throw new Error(proc.error || 'Error procesando factura');
                        }
                        // Procesamiento en segundo plano aceptado
                        setInvoiceMessage('🟦 Procesando en segundo plano. Te avisaremos al completar.');
                        const processingId = proc.processingId;
                        if (processingId) {
                          // Poll estado de procesamiento para abrir proveedor
                          const maxTries = 10;
                          for (let k = 0; k < maxTries; k++) {
                            try {
                              await new Promise(r => setTimeout(r, 2000));
                              const st = await fetch(`/api/facturas/processing-status?id=${processingId}`);
                              if (!st.ok) continue;
                              const js = await st.json();
                              const header = js?.data?.header_json;
                              const supplierId = js?.data?.supplier_id;
                              const created = header?.supplier_created;
                              const cuit = header?.supplier_cuit || '';
                              const items = js?.data?.items || [];
                              console.log('📦 [Stock] Items recibidos:', items.length, items);
                              // Si ya existe proveedor o al menos tenemos CUIT detectado, abrir modal
                              if (supplierId || cuit) {
                                const razon = header?.supplier_name || '';
                                // Guardar items en sessionStorage para mostrarlos en el modal
                                if (items.length > 0) {
                                  console.log('📦 [Stock] Guardando items en sessionStorage:', items.length);
                                  sessionStorage.setItem('invoiceItems', JSON.stringify(items));
                                } else {
                                  console.log('⚠️ [Stock] No hay items para guardar');
                                }
                                window.location.href = `/providers?prefill=1&cuit=${encodeURIComponent(cuit)}&razon=${encodeURIComponent(razon)}`;
                                break;
                              }
                            } catch {}
                          }
                        } else if (up?.fileUrl) {
                          // Fallback: resolver por fileUrl
                          const maxTries = 10;
                          for (let k = 0; k < maxTries; k++) {
                            try {
                              await new Promise(r => setTimeout(r, 2000));
                              const st = await fetch(`/api/facturas/processing-status?fileUrl=${encodeURIComponent(up.fileUrl)}`);
                              if (!st.ok) continue;
                              const js = await st.json();
                              const header = js?.data?.header_json;
                              const supplierId = js?.data?.supplier_id;
                              const cuit = header?.supplier_cuit || '';
                              const items = js?.data?.items || [];
                              console.log('📦 [Stock-Fallback] Items recibidos:', items.length, items);
                              if (supplierId || cuit) {
                                const razon = header?.supplier_name || '';
                                // Guardar items en sessionStorage para mostrarlos en el modal
                                if (items.length > 0) {
                                  console.log('📦 [Stock-Fallback] Guardando items en sessionStorage:', items.length);
                                  sessionStorage.setItem('invoiceItems', JSON.stringify(items));
                                } else {
                                  console.log('⚠️ [Stock-Fallback] No hay items para guardar');
                                }
                                window.location.href = `/providers?prefill=1&cuit=${encodeURIComponent(cuit)}&razon=${encodeURIComponent(razon)}`;
                                break;
                              }
                            } catch {}
                          }
                        }
                        // Refrescar datos (stock actualizado) con reintentos para esperar al background
                        setTimeout(() => { fetchAll(); }, 2000);
                        setTimeout(() => { fetchAll(); }, 5000);
                        setTimeout(() => { fetchAll(); }, 9000);
                        // Limpiar selección
                        setInvoiceFile(null);
                        setInvoiceProviderId('');
                      } catch (e: any) {
                        setInvoiceMessage(`❌ ${e.message || 'Error procesando factura'}`);
                      } finally {
                        setInvoiceUploading(false);
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50"
                  >
                    {invoiceUploading ? 'Subiendo...' : 'Subir factura'}
                  </button>
                </div>
              </div>
              {invoiceMessage && (
                <div
                  id="invoice-upload-status"
                  role="alert"
                  className={`mt-3 text-sm px-3 py-2 rounded border ${
                    invoiceMessage.startsWith('✅')
                      ? 'bg-green-50 text-green-800 border-green-200'
                      : invoiceMessage.startsWith('⚠️')
                      ? 'bg-yellow-50 text-yellow-800 border-yellow-200'
                      : invoiceMessage.startsWith('Procesando')
                      ? 'bg-blue-50 text-blue-800 border-blue-200'
                      : 'bg-red-50 text-red-800 border-red-200'
                  }`}
                >
                  {invoiceMessage}
                </div>
              )}
            </form>
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
                  Proveedor
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
