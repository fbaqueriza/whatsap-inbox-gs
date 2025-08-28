# Debug de template
Write-Host "Debug de template" -ForegroundColor Yellow

$testNumbers = @(
    "+5491135562673",  # L'igiene
    "+5491140494130"   # Baron de la Menta
)

foreach ($number in $testNumbers) {
    Write-Host "`nProbando con: $number" -ForegroundColor Cyan
    
    try {
        $body = '{"to": "' + $number + '", "template_name": "envio_de_orden"}'
        $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/debug-template-send" -Method POST -ContentType "application/json" -Body $body
        
        Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
        $data = $response.Content | ConvertFrom-Json
        
        Write-Host "Exitoso: $($data.success)" -ForegroundColor White
        Write-Host "Status Code: $($data.analysis.statusCode)" -ForegroundColor White
        Write-Host "Tiene Error: $($data.analysis.hasError)" -ForegroundColor White
        
        if ($data.analysis.errorDetails) {
            Write-Host "Error: $($data.analysis.errorDetails.message)" -ForegroundColor Red
            Write-Host "Tipo: $($data.analysis.errorDetails.type)" -ForegroundColor Red
            Write-Host "Código: $($data.analysis.errorDetails.code)" -ForegroundColor Red
        }
        
        if ($data.analysis.messageId) {
            Write-Host "Message ID: $($data.analysis.messageId)" -ForegroundColor Green
        }
        
    } catch {
        Write-Host "Error de conexión: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`nDebug completado" -ForegroundColor Yellow
