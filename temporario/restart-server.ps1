# Script para reiniciar el servidor de desarrollo
Write-Host "🔄 Reiniciando servidor de desarrollo..." -ForegroundColor Yellow

# Terminar procesos de Node.js
Write-Host "📋 Terminando procesos de Node.js..." -ForegroundColor Cyan
taskkill /F /IM node.exe 2>$null

# Limpiar cache
Write-Host "🧹 Limpiando cache..." -ForegroundColor Cyan
if (Test-Path ".next") {
    Remove-Item -Recurse -Force .next
    Write-Host "✅ Cache limpiado" -ForegroundColor Green
}

# Instalar dependencias si es necesario
Write-Host "📦 Verificando dependencias..." -ForegroundColor Cyan
if (!(Test-Path "node_modules")) {
    npm install
}

# Iniciar servidor
Write-Host "🚀 Iniciando servidor en puerto 3001..." -ForegroundColor Green
npm run dev
