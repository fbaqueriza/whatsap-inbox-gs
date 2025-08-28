# Test directo del trigger-conversation
Write-Host "Test directo del trigger-conversation" -ForegroundColor Yellow

$testNumbers = @(
    "+5491135562673",  # L'igiene
    "+5491140494130"   # Baron de la Menta
)

foreach ($number in $testNumbers) {
    Write-Host "`nProbando trigger-conversation con: $number" -ForegroundColor Cyan
    
    try {
        $body = '{"to": "' + $number + '", "template_name": "envio_de_orden"}'
        $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/trigger-conversation" -Method POST -ContentType "application/json" -Body $body
        
        Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
        $data = $response.Content | ConvertFrom-Json
        
        Write-Host "Exitoso: $($data.success)" -ForegroundColor White
        Write-Host "Fallback usado: $($data.fallback)" -ForegroundColor White
        
        if ($data.error) {
            Write-Host "Error: $($data.error)" -ForegroundColor Red
        }
        
        if ($data.data) {
            Write-Host "Message ID: $($data.data.messages[0].id)" -ForegroundColor Green
        }
        
    } catch {
        Write-Host "Error de conexión: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`nTest completado" -ForegroundColor Yellow
