# Test simple de templates
Write-Host "Test simple de templates" -ForegroundColor Yellow

# Test L'igiene
Write-Host "`nProbando L'igiene..." -ForegroundColor Cyan
try {
    $body = '{"providerName": "Ligiene"}'
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/test-notification-flow" -Method POST -ContentType "application/json" -Body $body
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    $data = $response.Content | ConvertFrom-Json
    Write-Host "Template enviado: $($data.result.templateSent)" -ForegroundColor White
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test Baron de la Menta
Write-Host "`nProbando Baron de la Menta..." -ForegroundColor Cyan
try {
    $body = '{"providerName": "Baron de la Menta"}'
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/test-notification-flow" -Method POST -ContentType "application/json" -Body $body
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    $data = $response.Content | ConvertFrom-Json
    Write-Host "Template enviado: $($data.result.templateSent)" -ForegroundColor White
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTest completado" -ForegroundColor Yellow
