# Diagnóstico completo del sistema
Write-Host "=== DIAGNÓSTICO COMPLETO DEL SISTEMA ===" -ForegroundColor Yellow

# 1. Análisis detallado de órdenes pendientes
Write-Host "`n1. ANALIZANDO ÓRDENES PENDIENTES..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/debug-pending-orders-detailed" -Method GET
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    $data = $response.Content | ConvertFrom-Json
    
    if ($data.success) {
        $analysis = $data.analysis
        Write-Host "Total órdenes: $($analysis.totalOrders)" -ForegroundColor White
        Write-Host "Teléfonos válidos: $($analysis.summary.validPhones)" -ForegroundColor White
        Write-Host "Teléfonos inválidos: $($analysis.summary.invalidPhones)" -ForegroundColor White
        $providers = $analysis.summary.providers -join ', '
        Write-Host "Proveedores: $providers" -ForegroundColor White
        
        if ($analysis.summary.duplicates.Count -gt 0) {
            Write-Host "DUPLICADOS ENCONTRADOS:" -ForegroundColor Red
            foreach ($dup in $analysis.summary.duplicates) {
                Write-Host "  - Teléfono $($dup.phone): $($dup.count) órdenes" -ForegroundColor Red
            }
        }
        
        if ($analysis.orders.Count -gt 0) {
            Write-Host "`nDETALLES DE ÓRDENES:" -ForegroundColor Yellow
            foreach ($order in $analysis.orders) {
                Write-Host "  - ID: $($order.id)" -ForegroundColor White
                Write-Host "    Proveedor: $($order.providerName)" -ForegroundColor White
                Write-Host "    Teléfono: $($order.providerPhone) (Válido: $($order.phoneAnalysis.isValidFormat))" -ForegroundColor White
                Write-Host "    Orden: $($order.orderData.orderNumber)" -ForegroundColor White
                Write-Host "    Creada: $($order.createdAt)" -ForegroundColor White
                Write-Host ""
            }
        }
    } else {
        Write-Host "Error: $($data.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# 2. Probar envío de template a diferentes proveedores
Write-Host "`n2. PROBANDO ENVÍO DE TEMPLATES..." -ForegroundColor Cyan

$testPhones = @(
    "+5491135562673",  # Número válido
    "+5491140494130",  # Baron de la Menta
    "+5491135562673"   # L'igiene (asumiendo que es el mismo)
)

foreach ($phone in $testPhones) {
    Write-Host "`nProbando template para: $phone" -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/trigger-conversation" -Method POST -ContentType "application/json" -Body "{\"to\": \"$phone\", \"template_name\": \"envio_de_orden\"}"
        Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
        $data = $response.Content | ConvertFrom-Json
        
        if ($data.success) {
            Write-Host "✅ Template enviado exitosamente" -ForegroundColor Green
            if ($data.fallback) {
                Write-Host "⚠️ Se usó fallback (mensaje normal)" -ForegroundColor Yellow
            }
        } else {
            Write-Host "❌ Error: $($data.error)" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Error de conexión: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# 3. Verificar configuración de WhatsApp
Write-Host "`n3. VERIFICANDO CONFIGURACIÓN..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/trigger-conversation" -Method POST -ContentType "application/json" -Body '{"to": "+5491135562673", "template_name": "test"}'
    $data = $response.Content | ConvertFrom-Json
    
    if ($data.success) {
        Write-Host "✅ Configuración de WhatsApp OK" -ForegroundColor Green
    } else {
        Write-Host "❌ Problema de configuración: $($data.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error verificando configuración: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== DIAGNÓSTICO COMPLETADO ===" -ForegroundColor Yellow
