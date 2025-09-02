# Script para limpiar caché y compilar
Write-Host "🧹 Limpiando caché de Next.js..." -ForegroundColor Yellow

# Eliminar carpeta .next si existe
if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
    Write-Host "✅ Caché eliminada" -ForegroundColor Green
} else {
    Write-Host "ℹ️ No hay caché para limpiar" -ForegroundColor Blue
}

Write-Host "🔨 Compilando proyecto..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Compilación exitosa!" -ForegroundColor Green
} else {
    Write-Host "❌ Error en la compilación" -ForegroundColor Red
}
