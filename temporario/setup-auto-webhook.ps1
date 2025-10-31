# Script para configurar webhook automáticamente con ngrok
# Ejecutar desde PowerShell: .\temporario\setup-auto-webhook.ps1

Write-Host "🚀 Configurando webhook automáticamente con ngrok..." -ForegroundColor Green

# Obtener configuración de ngrok
Write-Host "📡 Obteniendo URL de ngrok..." -ForegroundColor Yellow
try {
    $ngrokResponse = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -Method GET
    $ngrokUrl = $ngrokResponse.tunnels[0].public_url
    
    if (-not $ngrokUrl) {
        Write-Host "❌ Ngrok no está ejecutándose. Ejecuta: ngrok http 3001" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ URL de ngrok obtenida: $ngrokUrl" -ForegroundColor Green
} catch {
    Write-Host "❌ No se pudo conectar con ngrok. Asegúrate de que esté ejecutándose." -ForegroundColor Red
    exit 1
}

# Configurar webhook
$webhookUrl = "$ngrokUrl/api/kapso/supabase-events"
$kapsoConfigId = "bae605ec-7674-40da-8787-1990cc42cbb3"

Write-Host "🔧 Configurando webhook en Kapso..." -ForegroundColor Yellow
Write-Host "   - URL del webhook: $webhookUrl" -ForegroundColor Cyan
Write-Host "   - Config ID: $kapsoConfigId" -ForegroundColor Cyan

# Configurar webhook usando la API de Kapso
$webhookConfig = @{
    webhook_url = $webhookUrl
    webhook_secret = if ($env:KAPSO_WEBHOOK_SECRET) { $env:KAPSO_WEBHOOK_SECRET } else { "2ea5549880d27417aa21fe65822bd24d01f2017a5a2bc114df9202940634c7eb" }
    events = @("message.received", "message.sent", "message.delivered", "message.read", "document.received", "media.received")
} | ConvertTo-Json

$kapsoApiKey = $env:KAPSO_API_KEY
$kapsoApiUrl = if ($env:KAPSO_API_URL) { $env:KAPSO_API_URL } else { "https://app.kapso.ai/api/v1" }

if (-not $kapsoApiKey) {
    Write-Host "❌ KAPSO_API_KEY no está configurada en las variables de entorno" -ForegroundColor Red
    exit 1
}

try {
    $response = Invoke-RestMethod -Uri "$kapsoApiUrl/whatsapp_configs/$kapsoConfigId/webhook" -Method PUT -Headers @{
        "Authorization" = "Bearer $kapsoApiKey"
        "Content-Type" = "application/json"
    } -Body $webhookConfig
    
    Write-Host "✅ ¡Webhook configurado exitosamente!" -ForegroundColor Green
    Write-Host "📊 Respuesta de Kapso: $($response | ConvertTo-Json -Depth 3)" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Error configurando webhook en Kapso:" -ForegroundColor Red
    Write-Host "   Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    Write-Host "   Message: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 ¡CONFIGURACIÓN COMPLETA!" -ForegroundColor Green
Write-Host "✅ Webhook configurado automáticamente en Kapso" -ForegroundColor Green
Write-Host "✅ Los mensajes de WhatsApp aparecerán en tiempo real" -ForegroundColor Green
Write-Host "✅ No es necesario configurar nada más" -ForegroundColor Green
Write-Host "✅ El sistema está listo para usar" -ForegroundColor Green
Write-Host ""
Write-Host "📱 Próximos pasos:" -ForegroundColor Yellow
Write-Host "   1. Envía un mensaje de WhatsApp al número configurado" -ForegroundColor White
Write-Host "   2. El mensaje aparecerá inmediatamente en el chat" -ForegroundColor White
Write-Host "   3. ¡El sistema de tiempo real está funcionando!" -ForegroundColor White
Write-Host ""
Write-Host "🔗 URLs importantes:" -ForegroundColor Yellow
Write-Host "   - Ngrok URL: $ngrokUrl" -ForegroundColor Cyan
Write-Host "   - Webhook URL: $webhookUrl" -ForegroundColor Cyan
Write-Host "   - Ngrok Dashboard: http://localhost:4040" -ForegroundColor Cyan
