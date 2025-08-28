# Diagnóstico de órdenes pendientes
Write-Host "Diagnosticando ordenes pendientes..." -ForegroundColor Yellow

# Test 1: Obtener todas las órdenes pendientes
Write-Host "`nTest 1: Obtener todas las órdenes pendientes" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/get-all-pending-orders" -Method GET
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    $data = $response.Content | ConvertFrom-Json
    Write-Host "Ordenes pendientes encontradas: $($data.pendingOrders.Count)" -ForegroundColor White
    
    if ($data.pendingOrders.Count -gt 0) {
        Write-Host "Detalles de las ordenes:" -ForegroundColor Yellow
        foreach ($order in $data.pendingOrders) {
            Write-Host "  - ID: $($order.id)" -ForegroundColor White
            Write-Host "    Order ID: $($order.order_id)" -ForegroundColor White
            Write-Host "    Provider Phone: $($order.provider_phone)" -ForegroundColor White
            Write-Host "    Status: $($order.status)" -ForegroundColor White
            Write-Host "    Created: $($order.created_at)" -ForegroundColor White
            if ($order.order_data.provider) {
                Write-Host "    Provider Name: $($order.order_data.provider.name)" -ForegroundColor White
            }
            Write-Host ""
        }
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Limpiar órdenes obsoletas
Write-Host "`nTest 2: Limpiar órdenes obsoletas" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/cleanup-all-pending-orders" -Method POST -ContentType "application/json"
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    $data = $response.Content | ConvertFrom-Json
    Write-Host "Resultado: $($data.message)" -ForegroundColor White
    Write-Host "Ordenes eliminadas: $($data.deletedCount)" -ForegroundColor White
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Verificar nuevamente después de la limpieza
Write-Host "`nTest 3: Verificar órdenes después de la limpieza" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/get-all-pending-orders" -Method GET
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    $data = $response.Content | ConvertFrom-Json
    Write-Host "Ordenes pendientes despues de limpieza: $($data.pendingOrders.Count)" -ForegroundColor White
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nDiagnostico completado" -ForegroundColor Green
