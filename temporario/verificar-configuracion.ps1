# Verificación de configuración de WhatsApp
Write-Host "=== VERIFICACIÓN DE CONFIGURACIÓN DE WHATSAPP ===" -ForegroundColor Yellow

Write-Host "`n1. Verificando variables de entorno..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/check-env" -Method GET
    $data = $response.Content | ConvertFrom-Json
    
    Write-Host "✅ Variables críticas configuradas: $($data.allConfigured)" -ForegroundColor White
    Write-Host "   API Key: $($data.envVars.WHATSAPP_API_KEY)" -ForegroundColor White
    Write-Host "   Phone Number ID: $($data.envVars.WHATSAPP_PHONE_NUMBER_ID)" -ForegroundColor White
    Write-Host "   Business Account ID: $($data.envVars.WHATSAPP_BUSINESS_ACCOUNT_ID)" -ForegroundColor White
} catch {
    Write-Host "❌ Error verificando variables: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n2. Verificando estado del servicio..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/service-status" -Method GET
    $data = $response.Content | ConvertFrom-Json
    
    Write-Host "✅ Servicio habilitado: $($data.status.isEnabled)" -ForegroundColor White
    Write-Host "   Modo simulación: $($data.status.isSimulationMode)" -ForegroundColor White
    Write-Host "   Mensaje: $($data.message)" -ForegroundColor White
} catch {
    Write-Host "❌ Error verificando servicio: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n3. Probando envío de template..." -ForegroundColor Cyan
try {
    $body = '{"to": "+5491135562673", "template_name": "envio_de_orden"}'
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/debug-template-send" -Method POST -ContentType "application/json" -Body $body
    $data = $response.Content | ConvertFrom-Json
    
    Write-Host "✅ Request exitoso: $($data.analysis.requestSuccessful)" -ForegroundColor White
    Write-Host "   Status Code: $($data.analysis.statusCode)" -ForegroundColor White
    Write-Host "   Tiene Error: $($data.analysis.hasError)" -ForegroundColor White
    
    if ($data.analysis.errorDetails) {
        Write-Host "   Error: $($data.analysis.errorDetails.message)" -ForegroundColor Red
        Write-Host "   Tipo: $($data.analysis.errorDetails.type)" -ForegroundColor Red
        Write-Host "   Código: $($data.analysis.errorDetails.code)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error probando template: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== RESUMEN ===" -ForegroundColor Yellow
Write-Host "Si ves errores de permisos o 'Object does not exist', necesitas:" -ForegroundColor White
Write-Host "1. Regenerar el token de acceso en Meta Business Manager" -ForegroundColor Cyan
Write-Host "2. Verificar que el Phone Number ID tenga permisos de envío" -ForegroundColor Cyan
Write-Host "3. Asegurar que la aplicación tenga los permisos correctos" -ForegroundColor Cyan

Write-Host "`n=== INSTRUCCIONES PARA CORREGIR ===" -ForegroundColor Yellow
Write-Host "1. Ve a Meta Business Manager" -ForegroundColor White
Write-Host "2. Navega a WhatsApp > API Setup" -ForegroundColor White
Write-Host "3. Regenera el token de acceso" -ForegroundColor White
Write-Host "4. Verifica que el Phone Number ID tenga permisos de 'Send Messages'" -ForegroundColor White
Write-Host "5. Actualiza las variables de entorno con el nuevo token" -ForegroundColor White
