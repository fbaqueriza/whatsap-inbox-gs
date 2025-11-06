# Script para consultar usuarios activos y mostrar configuraciones antes de setup de templates

$supabaseUrl = $env:NEXT_PUBLIC_SUPABASE_URL
$supabaseServiceKey = $env:SUPABASE_SERVICE_ROLE_KEY

if (-not $supabaseUrl -or -not $supabaseServiceKey) {
    Write-Host "❌ Error: Variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configuradas" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔍 Consultando usuarios activos con WhatsApp configurado..." -ForegroundColor Cyan
Write-Host ""

# Consultar usuarios activos con configuración de WhatsApp usando REST API
$headers = @{
    "apikey" = $supabaseServiceKey
    "Authorization" = "Bearer $supabaseServiceKey"
    "Content-Type" = "application/json"
}

try {
    # Construir URL con parámetros escapados
    $baseUrl = "$supabaseUrl/rest/v1/user_whatsapp_config"
    $select = "user_id,phone_number_id,kapso_config_id,whatsapp_phone_number,waba_id,is_active,created_at"
    $amp = [char]38  # & character
    $fullUrl = "${baseUrl}?is_active=eq.true${amp}select=${select}${amp}order=created_at.desc"
    
    $configs = Invoke-RestMethod -Uri $fullUrl -Method Get -Headers $headers -ErrorAction Stop
    
    if ($configs.Count -eq 0) {
        Write-Host "⚠️ No se encontraron usuarios con WhatsApp configurado" -ForegroundColor Yellow
        exit 0
    }
    
    Write-Host "✅ Encontrados $($configs.Count) usuario(s) con WhatsApp configurado:" -ForegroundColor Green
    Write-Host ""
    
    foreach ($config in $configs) {
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
        Write-Host "👤 USER_ID: $($config.user_id)" -ForegroundColor White
        Write-Host "📱 WhatsApp Phone: $($config.whatsapp_phone_number)" -ForegroundColor Cyan
        Write-Host "🆔 Phone Number ID: $($config.phone_number_id)" -ForegroundColor Cyan
        Write-Host "🔑 Kapso Config ID: $($config.kapso_config_id)" -ForegroundColor Cyan
        
        if ($config.waba_id) {
            Write-Host "🏢 WABA_ID (guardado): $($config.waba_id)" -ForegroundColor Green
        } else {
            Write-Host "🏢 WABA_ID (guardado): NO CONFIGURADO" -ForegroundColor Yellow
        }
        
        Write-Host "✅ Activo: $($config.is_active)" -ForegroundColor Green
        Write-Host "📅 Creado: $($config.created_at)" -ForegroundColor Gray
        Write-Host ""
    }
    
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host ""
    Write-Host "📋 TEMPLATES QUE SE CREARÁN (si no existen):" -ForegroundColor Cyan
    Write-Host "   1. inicializador_de_conv (es_AR)" -ForegroundColor White
    Write-Host "      Texto: 'Hola! Te puedo comentar algo?'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   2. evio_orden (es_AR)" -ForegroundColor White
    Write-Host "      Header: 'Nueva orden {{company_name}}'" -ForegroundColor Gray
    Write-Host "      Body: 'Buen día {{contact_name}}! Espero que andes bien!" -ForegroundColor Gray
    Write-Host "            En cuanto me confirmes, paso el pedido de esta semana.'" -ForegroundColor Gray
    Write-Host ""
    
} catch {
    Write-Host "❌ Error consultando Supabase: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Respuesta del servidor: $responseBody" -ForegroundColor Red
    }
    exit 1
}
