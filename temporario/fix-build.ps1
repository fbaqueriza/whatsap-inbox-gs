# Script para arreglar el problema de build
Write-Host "🔧 Arreglando problema de build..." -ForegroundColor Yellow

# Agregar todos los cambios
git add .

# Hacer commit
git commit -m "fix: corregir archivo server.ts duplicado y usar serverClient"

# Hacer push
git push

Write-Host "✅ Cambios subidos exitosamente" -ForegroundColor Green
