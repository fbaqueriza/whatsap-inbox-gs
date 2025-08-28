# Test del flujo de notificación
Write-Host "=== TEST DEL FLUJO DE NOTIFICACIÓN ===" -ForegroundColor Yellow

$providers = @("L'igiene", "Baron de la Menta")

foreach ($provider in $providers) {
    Write-Host "`n🧪 Probando con: $provider" -ForegroundColor Cyan
    
    try {
        $body = '{"providerName": "' + $provider.Replace("'", "''") + '"}'
        $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/test-notification-flow" -Method POST -ContentType "application/json" -Body $body
        
        Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
        $data = $response.Content | ConvertFrom-Json
        
        if ($data.success) {
            Write-Host "✅ Test exitoso para $provider" -ForegroundColor Green
            Write-Host "  Teléfono: $($data.testData.providerPhone)" -ForegroundColor White
            Write-Host "  Template enviado: $($data.result.templateSent)" -ForegroundColor White
            Write-Host "  Pedido guardado: $($data.result.pendingOrderSaved)" -ForegroundColor White
            
            if ($data.result.errors.Count -gt 0) {
                Write-Host "  Errores:" -ForegroundColor Red
                foreach ($err in $data.result.errors) {
                    Write-Host "    - $err" -ForegroundColor Red
                }
            }
        } else {
            Write-Host "❌ Test falló para $provider" -ForegroundColor Red
            Write-Host "  Error: $($data.error)" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Error de conexión para $provider" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n=== TEST COMPLETADO ===" -ForegroundColor Yellow
