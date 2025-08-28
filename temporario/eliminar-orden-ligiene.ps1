# Eliminar orden específica de L'igiene
Write-Host "Eliminando orden de L'igiene..." -ForegroundColor Yellow

# Test 1: Eliminar orden específica por ID
Write-Host "`nTest 1: Eliminar orden por ID" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/remove-pending-order" -Method POST -ContentType "application/json" -Body '{"providerPhone": "+5491135562673"}'
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    $data = $response.Content | ConvertFrom-Json
    Write-Host "Resultado: $($data.message)" -ForegroundColor White
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
