# Diagnostico simple del sistema
Write-Host "=== DIAGNOSTICO COMPLETO DEL SISTEMA ===" -ForegroundColor Yellow

# 1. Analizar ordenes pendientes
Write-Host "`n1. ANALIZANDO ORDENES PENDIENTES..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/debug-pending-orders-detailed" -Method GET
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    $data = $response.Content | ConvertFrom-Json
    
    if ($data.success) {
        $analysis = $data.analysis
        Write-Host "Total ordenes: $($analysis.totalOrders)" -ForegroundColor White
        Write-Host "Telefonos validos: $($analysis.summary.validPhones)" -ForegroundColor White
        Write-Host "Telefonos invalidos: $($analysis.summary.invalidPhones)" -ForegroundColor White
        
        if ($analysis.summary.providers) {
            $providers = $analysis.summary.providers -join ', '
            Write-Host "Proveedores: $providers" -ForegroundColor White
        }
        
        if ($analysis.summary.duplicates.Count -gt 0) {
            Write-Host "DUPLICADOS ENCONTRADOS:" -ForegroundColor Red
            foreach ($dup in $analysis.summary.duplicates) {
                Write-Host "  - Telefono $($dup.phone): $($dup.count) ordenes" -ForegroundColor Red
            }
        }
        
        if ($analysis.orders.Count -gt 0) {
            Write-Host "`nDETALLES DE ORDENES:" -ForegroundColor Yellow
            foreach ($order in $analysis.orders) {
                Write-Host "  - ID: $($order.id)" -ForegroundColor White
                Write-Host "    Proveedor: $($order.providerName)" -ForegroundColor White
                Write-Host "    Telefono: $($order.providerPhone) (Valido: $($order.phoneAnalysis.isValidFormat))" -ForegroundColor White
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

# 2. Probar envio de template
Write-Host "`n2. PROBANDO ENVIO DE TEMPLATES..." -ForegroundColor Cyan

$testPhones = @(
    "+5491135562673",
    "+5491140494130"
)

foreach ($phone in $testPhones) {
    Write-Host "`nProbando template para: $phone" -ForegroundColor Yellow
    try {
        $body = '{"to": "' + $phone + '", "template_name": "envio_de_orden"}'
        $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/trigger-conversation" -Method POST -ContentType "application/json" -Body $body
        Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
        $data = $response.Content | ConvertFrom-Json
        
        if ($data.success) {
            Write-Host "Template enviado exitosamente" -ForegroundColor Green
            if ($data.fallback) {
                Write-Host "Se uso fallback (mensaje normal)" -ForegroundColor Yellow
            }
        } else {
            Write-Host "Error: $($data.error)" -ForegroundColor Red
        }
    } catch {
        Write-Host "Error de conexion: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n=== DIAGNOSTICO COMPLETADO ===" -ForegroundColor Yellow
