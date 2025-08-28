# Debug de órdenes pendientes
Write-Host "Debug de ordenes pendientes..." -ForegroundColor Yellow

# Test 1: Debug endpoint
Write-Host "`nTest 1: Debug endpoint" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/debug-pending-orders" -Method GET
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    $data = $response.Content | ConvertFrom-Json
    Write-Host "Método: $($data.method)" -ForegroundColor White
    Write-Host "Timestamp: $($data.timestamp)" -ForegroundColor White
    Write-Host "Órdenes encontradas: $($data.count)" -ForegroundColor White
    
    if ($data.count -gt 0) {
        Write-Host "Detalles:" -ForegroundColor Yellow
        foreach ($order in $data.pendingOrders) {
            Write-Host "  - ID: $($order.id)" -ForegroundColor White
            Write-Host "    Provider: $($order.order_data.provider.name)" -ForegroundColor White
            Write-Host "    Created: $($order.created_at)" -ForegroundColor White
        }
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nDebug completado" -ForegroundColor Green
