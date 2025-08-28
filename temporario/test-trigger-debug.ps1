# Debug del error 400 en trigger-conversation
Write-Host "Debug del error 400 en trigger-conversation" -ForegroundColor Yellow

$testNumber = "+5491135562673"
$body = '{"to": "' + $testNumber + '", "template_name": "envio_de_orden"}'

Write-Host "Enviando payload: $body" -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/trigger-conversation" -Method POST -ContentType "application/json" -Body $body
    
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Content: $($response.Content)" -ForegroundColor White
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Detalles del error:" -ForegroundColor Red
        Write-Host $responseBody -ForegroundColor Red
    }
}

Write-Host "`nDebug completado" -ForegroundColor Yellow
