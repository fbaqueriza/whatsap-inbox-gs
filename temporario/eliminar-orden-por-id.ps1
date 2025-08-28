# Eliminar orden específica por ID
Write-Host "Eliminando orden por ID..." -ForegroundColor Yellow

# Test 1: Eliminar orden específica por ID
Write-Host "`nTest 1: Eliminar orden por ID" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/remove-pending-order-by-id" -Method POST -ContentType "application/json" -Body '{"orderId": "aee69daf-7db1-4324-99c6-22c5f8d2f814"}'
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    $data = $response.Content | ConvertFrom-Json
    Write-Host "Resultado: $($data.message)" -ForegroundColor White
    Write-Host "Registros eliminados: $($data.deletedCount)" -ForegroundColor White
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Verificar que se eliminó
Write-Host "`nTest 2: Verificar eliminación" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/get-all-pending-orders" -Method GET
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    $data = $response.Content | ConvertFrom-Json
    Write-Host "Ordenes pendientes después de eliminación: $($data.pendingOrders.Count)" -ForegroundColor White
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nProceso completado" -ForegroundColor Green
