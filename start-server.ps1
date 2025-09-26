Write-Host "🚀 Iniciando servidor de desarrollo..." -ForegroundColor Green

# Verificar si hay procesos de Node.js ejecutándose
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "⚠️  Procesos de Node.js encontrados, terminando..." -ForegroundColor Yellow
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Verificar puerto 3001
$portInUse = netstat -an | Select-String ":3001"
if ($portInUse) {
    Write-Host "⚠️  Puerto 3001 en uso, liberando..." -ForegroundColor Yellow
}

# Iniciar servidor
Write-Host "📡 Iniciando servidor en puerto 3001..." -ForegroundColor Blue
Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WindowStyle Normal -PassThru

# Esperar y verificar
Start-Sleep -Seconds 5
$serverRunning = netstat -an | Select-String ":3001"

if ($serverRunning) {
    Write-Host "✅ Servidor iniciado exitosamente en puerto 3001" -ForegroundColor Green
    Write-Host "🌐 Abre http://localhost:3001 en tu navegador" -ForegroundColor Cyan
} else {
    Write-Host "❌ Error al iniciar el servidor" -ForegroundColor Red
}

