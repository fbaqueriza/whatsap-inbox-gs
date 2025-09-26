# 🔍 TEST: Verificar configuración del webhook
# Este script verifica si el webhook está funcionando correctamente

Write-Host "TEST: Verificando configuracion del webhook..." -ForegroundColor Yellow
Write-Host ""

# URL del webhook
$webhookUrl = "https://f7e3caa406f2.ngrok-free.app/api/whatsapp/webhook"
Write-Host "URL del webhook: $webhookUrl" -ForegroundColor Cyan

# Verificar que el webhook responde
Write-Host ""
Write-Host "Verificando que el webhook responde..." -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri $webhookUrl -Method GET -TimeoutSec 10
    Write-Host "Webhook responde correctamente" -ForegroundColor Green
    Write-Host "   Status Code: $($response.StatusCode)" -ForegroundColor White
} catch {
    Write-Host "Error conectando al webhook: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "CONFIGURACION REQUERIDA EN META DEVELOPER CONSOLE:" -ForegroundColor Yellow
Write-Host "   1. Webhook URL: $webhookUrl" -ForegroundColor White
Write-Host "   2. Verify Token: (el que esta en .env como WHATSAPP_VERIFY_TOKEN)" -ForegroundColor White
Write-Host "   3. Suscribirse a: messages" -ForegroundColor White
Write-Host "   4. Suscribirse a: message_deliveries" -ForegroundColor White

Write-Host ""
Write-Host "🔍 DIAGNÓSTICO:" -ForegroundColor Yellow
Write-Host "   - Si el webhook no recibe mensajes, verifica la configuracion en Meta" -ForegroundColor White
Write-Host "   - Asegurate de que el numero de WhatsApp este verificado" -ForegroundColor White
Write-Host "   - Verifica que el proveedor este respondiendo al numero correcto" -ForegroundColor White
