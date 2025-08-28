# Verificación del token de acceso
Write-Host "=== VERIFICACIÓN DEL TOKEN DE ACCESO ===" -ForegroundColor Yellow

Start-Sleep -Seconds 3

Write-Host "`n1. Verificando configuración actual..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/check-env" -Method GET
    $data = $response.Content | ConvertFrom-Json
    
    Write-Host "✅ Configuración:" -ForegroundColor White
    Write-Host "   API Key: $($data.envVars.WHATSAPP_API_KEY)" -ForegroundColor White
    Write-Host "   Phone Number ID: $($data.envVars.WHATSAPP_PHONE_NUMBER_ID)" -ForegroundColor White
    Write-Host "   Business Account ID: $($data.envVars.WHATSAPP_BUSINESS_ACCOUNT_ID)" -ForegroundColor White
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    exit
}

Write-Host "`n2. Probando envío de template..." -ForegroundColor Cyan
try {
    $body = '{"to": "+5491135562673", "template_name": "envio_de_orden"}'
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/debug-template-send" -Method POST -ContentType "application/json" -Body $body
    $data = $response.Content | ConvertFrom-Json
    
    Write-Host "✅ Resultado:" -ForegroundColor White
    Write-Host "   Status Code: $($data.analysis.statusCode)" -ForegroundColor White
    Write-Host "   Tiene Error: $($data.analysis.hasError)" -ForegroundColor White
    
    if ($data.analysis.errorDetails) {
        Write-Host "   Error: $($data.analysis.errorDetails.message)" -ForegroundColor Red
        Write-Host "   Tipo: $($data.analysis.errorDetails.type)" -ForegroundColor Red
        Write-Host "   Código: $($data.analysis.errorDetails.code)" -ForegroundColor Red
        
        if ($data.analysis.errorDetails.code -eq 100) {
            Write-Host "`n🔍 DIAGNÓSTICO: Token de acceso expirado o inválido" -ForegroundColor Yellow
            Write-Host "   Código 100 = GraphMethodException = Problema de permisos/token" -ForegroundColor White
        }
    } else {
        Write-Host "   ✅ Template enviado exitosamente!" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== SOLUCIÓN RECOMENDADA ===" -ForegroundColor Yellow
Write-Host "Si el token está expirado, necesitas:" -ForegroundColor White
Write-Host "1. Ir a Meta Business Manager > WhatsApp > API Setup" -ForegroundColor Cyan
Write-Host "2. Hacer clic en 'Regenerate' en el token de acceso" -ForegroundColor Cyan
Write-Host "3. Copiar el nuevo token" -ForegroundColor Cyan
Write-Host "4. Actualizar la variable WHATSAPP_API_KEY en .env.local" -ForegroundColor Cyan
Write-Host "5. Reiniciar el servidor" -ForegroundColor Cyan
