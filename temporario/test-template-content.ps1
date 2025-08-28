# Test del endpoint template-content
Write-Host "Probando endpoint template-content..." -ForegroundColor Yellow

# Test 1: Obtener contenido del template envio_de_orden
Write-Host "`nTest 1: Obtener contenido del template envio_de_orden" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/template-content" -Method POST -ContentType "application/json" -Body '{"template_name": "envio_de_orden"}'
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor White
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Obtener contenido del template inicializador_de_conv
Write-Host "`nTest 2: Obtener contenido del template inicializador_de_conv" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/template-content" -Method POST -ContentType "application/json" -Body '{"template_name": "inicializador_de_conv"}'
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor White
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Template inexistente
Write-Host "`nTest 3: Template inexistente" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/template-content" -Method POST -ContentType "application/json" -Body '{"template_name": "template_inexistente"}'
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor White
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTests completados" -ForegroundColor Green
