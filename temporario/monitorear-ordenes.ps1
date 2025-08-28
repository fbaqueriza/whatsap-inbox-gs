# Monitorear órdenes pendientes en tiempo real
Write-Host "Monitoreando ordenes pendientes..." -ForegroundColor Yellow

$contador = 0
$maxChecks = 10

while ($contador -lt $maxChecks) {
    $contador++
    Write-Host "`n--- Check #$contador ---" -ForegroundColor Cyan
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/get-all-pending-orders" -Method GET
        $data = $response.Content | ConvertFrom-Json
        
        Write-Host "Ordenes pendientes: $($data.pendingOrders.Count)" -ForegroundColor White
        
        if ($data.pendingOrders.Count -gt 0) {
            foreach ($order in $data.pendingOrders) {
                Write-Host "  - ID: $($order.id)" -ForegroundColor White
                Write-Host "    Provider: $($order.order_data.provider.name)" -ForegroundColor White
                Write-Host "    Created: $($order.created_at)" -ForegroundColor White
            }
        }
        
        Start-Sleep -Seconds 2
    } catch {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        break
    }
}

Write-Host "`nMonitoreo completado" -ForegroundColor Green
