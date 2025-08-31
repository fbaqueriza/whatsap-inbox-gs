# Script de limpieza y reinicio para Gastronomy SaaS
Write-Host "🧹 Iniciando limpieza del sistema..." -ForegroundColor Yellow

# Detener procesos de Node.js
Write-Host "🛑 Deteniendo procesos de Node.js..." -ForegroundColor Red
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Limpiar caché de Next.js
Write-Host "🗑️ Limpiando caché de Next.js..." -ForegroundColor Yellow
if (Test-Path ".next") {
    Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "✅ Caché de Next.js eliminado" -ForegroundColor Green
}

# Limpiar node_modules (opcional, solo si hay problemas)
Write-Host "🗑️ Limpiando node_modules..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "✅ node_modules eliminado" -ForegroundColor Green
}

# Limpiar caché de npm
Write-Host "🗑️ Limpiando caché de npm..." -ForegroundColor Yellow
npm cache clean --force
Write-Host "✅ Caché de npm limpiado" -ForegroundColor Green

# Reinstalar dependencias
Write-Host "📦 Reinstalando dependencias..." -ForegroundColor Yellow
npm install
Write-Host "✅ Dependencias reinstaladas" -ForegroundColor Green

# Verificar puerto 3001
Write-Host "🔍 Verificando puerto 3001..." -ForegroundColor Yellow
$portCheck = netstat -ano | findstr :3001
if ($portCheck) {
    Write-Host "⚠️ Puerto 3001 ocupado, liberando..." -ForegroundColor Red
    $processId = ($portCheck -split '\s+')[-1]
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    Write-Host "✅ Puerto 3001 liberado" -ForegroundColor Green
}

# Iniciar servidor
Write-Host "🚀 Iniciando servidor de desarrollo..." -ForegroundColor Green
npm run dev

Write-Host "✅ Sistema limpio y reiniciado" -ForegroundColor Green
