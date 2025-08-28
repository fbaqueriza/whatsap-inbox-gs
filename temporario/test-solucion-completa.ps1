# Test de la solución completa
Write-Host "Probando solución completa..." -ForegroundColor Yellow

# Test 1: Eliminar orden fantasma
Write-Host "`nTest 1: Eliminar orden fantasma" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/delete-ghost-order" -Method POST -ContentType "application/json"
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    $data = $response.Content | ConvertFrom-Json
    Write-Host "Resultado: $($data.message)" -ForegroundColor White
    Write-Host "Órdenes restantes: $($data.remainingOrders)" -ForegroundColor White
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Verificar órdenes pendientes
Write-Host "`nTest 2: Verificar órdenes pendientes" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/get-all-pending-orders" -Method GET
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    $data = $response.Content | ConvertFrom-Json
    Write-Host "Órdenes pendientes: $($data.pendingOrders.Count)" -ForegroundColor White
    
    if ($data.pendingOrders.Count -gt 0) {
        Write-Host "Detalles:" -ForegroundColor Yellow
        foreach ($order in $data.pendingOrders) {
            Write-Host "  - ID: $($order.id)" -ForegroundColor White
            Write-Host "    Provider: $($order.order_data.provider.name)" -ForegroundColor White
            Write-Host "    Phone: $($order.provider_phone)" -ForegroundColor White
        }
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Probar template con número válido
Write-Host "`nTest 3: Probar template con número válido" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/trigger-conversation" -Method POST -ContentType "application/json" -Body '{"to": "+5491135562673", "template_name": "envio_de_orden"}'
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    $data = $response.Content | ConvertFrom-Json
    Write-Host "Resultado: $($data.success)" -ForegroundColor White
    if ($data.success) {
        Write-Host "Template enviado exitosamente" -ForegroundColor Green
    } else {
        Write-Host "Error: $($data.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTest completado" -ForegroundColor Green
