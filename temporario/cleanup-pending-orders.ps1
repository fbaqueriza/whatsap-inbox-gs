# Script para limpiar pedidos pendientes y crear uno nuevo
Write-Host "Limpiando pedidos pendientes antiguos..." -ForegroundColor Yellow

# Primero, obtener todos los pedidos pendientes
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/get-all-pending-orders" -Method GET
    $data = $response.Content | ConvertFrom-Json
    
    Write-Host "Pedidos pendientes encontrados: $($data.pendingOrders.Count)" -ForegroundColor Cyan
    
    # Eliminar todos los pedidos pendientes
    foreach ($order in $data.pendingOrders) {
        Write-Host "Eliminando pedido: $($order.orderId)" -ForegroundColor Gray
        
        $body = @{
            providerPhone = $order.providerPhone
        } | ConvertTo-Json
        
        $removeResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/remove-pending-order" -Method POST -ContentType "application/json" -Body $body
        
        if ($removeResponse.StatusCode -eq 200) {
            Write-Host "  ✅ Eliminado" -ForegroundColor Green
        } else {
            Write-Host "  ❌ Error eliminando" -ForegroundColor Red
        }
    }
    
} catch {
    Write-Host "Error obteniendo pedidos pendientes: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Verificando que se eliminaron todos..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/get-all-pending-orders" -Method GET
    $data = $response.Content | ConvertFrom-Json
    
    Write-Host "Pedidos pendientes restantes: $($data.pendingOrders.Count)" -ForegroundColor Cyan
    
    if ($data.pendingOrders.Count -eq 0) {
        Write-Host "✅ Todos los pedidos pendientes eliminados" -ForegroundColor Green
    } else {
        Write-Host "❌ Aún quedan pedidos pendientes" -ForegroundColor Red
    }
    
} catch {
    Write-Host "Error verificando pedidos pendientes: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Limpieza completada" -ForegroundColor Green
