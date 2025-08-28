# Verificación simple de proveedores
Write-Host "Verificando proveedores..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/check-providers" -Method GET
    $data = $response.Content | ConvertFrom-Json
    
    Write-Host "Total proveedores: $($data.totalProviders)" -ForegroundColor Green
    
    # Buscar L'igiene y Baron de la Menta
    foreach ($provider in $data.analysis) {
        if ($provider.name -like "*L'igiene*" -or $provider.name -like "*ligiene*") {
            Write-Host "`nL'igiene encontrado:" -ForegroundColor Cyan
            Write-Host "  Nombre: $($provider.name)" -ForegroundColor White
            Write-Host "  Teléfono: $($provider.phone)" -ForegroundColor White
            Write-Host "  Válido: $($provider.phoneAnalysis.isValidFormat)" -ForegroundColor White
        }
        
        if ($provider.name -like "*Baron*" -or $provider.name -like "*Menta*") {
            Write-Host "`nBaron de la Menta encontrado:" -ForegroundColor Cyan
            Write-Host "  Nombre: $($provider.name)" -ForegroundColor White
            Write-Host "  Teléfono: $($provider.phone)" -ForegroundColor White
            Write-Host "  Válido: $($provider.phoneAnalysis.isValidFormat)" -ForegroundColor White
        }
    }
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
