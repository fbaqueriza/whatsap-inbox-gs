# Script para desplegar la Edge Function de Kapso

Write-Host "🚀 Desplegando Edge Function de Kapso..." -ForegroundColor Green

# Verificar que Supabase CLI esté instalado
try {
    $supabaseVersion = supabase --version
    Write-Host "✅ Supabase CLI encontrado: $supabaseVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Supabase CLI no está instalado. Instálalo con:" -ForegroundColor Red
    Write-Host "npm install -g supabase" -ForegroundColor Yellow
    exit 1
}

# Verificar que estemos en el directorio correcto
if (-not (Test-Path "supabase/config.toml")) {
    Write-Host "❌ No se encontró supabase/config.toml. Asegúrate de estar en el directorio raíz del proyecto." -ForegroundColor Red
    exit 1
}

# Desplegar la función
Write-Host "📦 Desplegando función kapso-webhook..." -ForegroundColor Yellow
supabase functions deploy kapso-webhook

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Función desplegada correctamente" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔗 URL de la función:" -ForegroundColor Cyan
    Write-Host "https://jyalmdhyuftjldewbfzw.supabase.co/functions/v1/kapso-webhook" -ForegroundColor White
    Write-Host ""
    Write-Host "📝 Configura esta URL en Kapso como webhook:" -ForegroundColor Cyan
    Write-Host "URL: https://jyalmdhyuftjldewbfzw.supabase.co/functions/v1/kapso-webhook" -ForegroundColor White
    Write-Host "Método: POST" -ForegroundColor White
    Write-Host "Secreto: 2ea5549880d27417aa21fe65822bd24d01f2017a5a2bc114df9202940634c7eb" -ForegroundColor White
} else {
    Write-Host "❌ Error desplegando la función" -ForegroundColor Red
    exit 1
}
