# Limpieza forzada de órdenes pendientes
Write-Host "Ejecutando limpieza forzada..." -ForegroundColor Yellow

# Test 1: Limpieza forzada
Write-Host "`nTest 1: Limpieza forzada" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/force-cleanup-pending-orders" -Method POST -ContentType "application/json"
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    $data = $response.Content | ConvertFrom-Json
    Write-Host "Resultado: $($data.message)" -ForegroundColor White
    Write-Host "Ordenes eliminadas: $($data.deletedCount)" -ForegroundColor White
    Write-Host "Ordenes restantes: $($data.remainingCount)" -ForegroundColor White
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Verificar resultado
Write-Host "`nTest 2: Verificar resultado" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/get-all-pending-orders" -Method GET
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    $data = $response.Content | ConvertFrom-Json
    Write-Host "Ordenes pendientes despues de limpieza forzada: $($data.pendingOrders.Count)" -ForegroundColor White
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nProceso completado" -ForegroundColor Green
