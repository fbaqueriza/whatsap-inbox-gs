# Script para probar el flujo completo del webhook
Write-Host "Probando flujo completo del webhook..." -ForegroundColor Yellow

# Simular un mensaje del proveedor con el formato correcto de Meta (SIN el prefijo +)
$webhookData = @{
    object = "whatsapp_business_account"
    entry = @(
        @{
            id = "123456789"
            changes = @(
                @{
                    value = @{
                        messaging_product = "whatsapp"
                        metadata = @{
                            display_phone_number = "+5491135562673"
                            phone_number_id = "123456789"
                        }
                        contacts = @(
                            @{
                                profile = @{
                                    name = "Test Provider"
                                }
                                wa_id = "5491135562673"
                            }
                        )
                        messages = @(
                            @{
                                from = "5491135562673"  # Formato correcto de Meta (SIN el +)
                                id = "wamid.test123"
                                timestamp = "1234567890"
                                type = "text"
                                text = @{
                                    body = "bueno"
                                }
                            }
                        )
                    }
                    field = "messages"
                }
            )
        }
    )
}

$jsonData = $webhookData | ConvertTo-Json -Depth 10

Write-Host "Enviando webhook simulado..." -ForegroundColor Cyan
Write-Host "Datos del webhook: $jsonData" -ForegroundColor Gray

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/webhook" -Method POST -ContentType "application/json" -Body $jsonData
    
    Write-Host "Webhook enviado exitosamente" -ForegroundColor Green
    Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor Cyan
    Write-Host "Response: $($response.Content)" -ForegroundColor Gray
    
} catch {
    Write-Host "Error enviando webhook: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Verificando pedidos pendientes después del webhook..." -ForegroundColor Yellow

try {
    $pendingResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/get-all-pending-orders" -Method GET
    $pendingData = $pendingResponse.Content | ConvertFrom-Json
    
    Write-Host "Pedidos pendientes encontrados: $($pendingData.pendingOrders.Count)" -ForegroundColor Cyan
    
    foreach ($order in $pendingData.pendingOrders) {
        Write-Host "  - Order ID: $($order.orderId)" -ForegroundColor Gray
        Write-Host "    Provider Phone: $($order.providerPhone)" -ForegroundColor Gray
        Write-Host "    Status: $($order.status)" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "Error verificando pedidos pendientes: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Prueba completada" -ForegroundColor Green
