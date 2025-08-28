# Test de template
Write-Host "Probando template..." -ForegroundColor Yellow

$body = '{"to": "+5491135562673", "template_name": "envio_de_orden"}'

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/test-template" -Method POST -ContentType "application/json" -Body $body
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    $data = $response.Content | ConvertFrom-Json
    Write-Host "Respuesta: $($data | ConvertTo-Json -Depth 3)" -ForegroundColor White
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Detalles: $responseBody" -ForegroundColor Red
    }
}
