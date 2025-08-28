# Verificar proveedores
Write-Host "Verificando proveedores..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/check-providers" -Method GET
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    $data = $response.Content | ConvertFrom-Json
    
    if ($data.success) {
        Write-Host "Total proveedores: $($data.totalProviders)" -ForegroundColor White
        
        if ($data.ligieneProvider) {
            Write-Host "`nL'igiene:" -ForegroundColor Cyan
            Write-Host "  Nombre: $($data.ligieneProvider.name)" -ForegroundColor White
            Write-Host "  Teléfono: $($data.ligieneProvider.phone)" -ForegroundColor White
            Write-Host "  Válido: $($data.ligieneProvider.phoneAnalysis.isValidFormat)" -ForegroundColor White
        }
        
        if ($data.baronProvider) {
            Write-Host "`nBaron de la Menta:" -ForegroundColor Cyan
            Write-Host "  Nombre: $($data.baronProvider.name)" -ForegroundColor White
            Write-Host "  Teléfono: $($data.baronProvider.phone)" -ForegroundColor White
            Write-Host "  Válido: $($data.baronProvider.phoneAnalysis.isValidFormat)" -ForegroundColor White
        }
        
        if ($data.comparison) {
            Write-Host "`nComparación:" -ForegroundColor Yellow
            Write-Host "  L'igiene válido: $($data.comparison.difference.ligieneValid)" -ForegroundColor White
            Write-Host "  Baron válido: $($data.comparison.difference.baronValid)" -ForegroundColor White
            Write-Host "  L'igiene longitud: $($data.comparison.difference.ligieneLength)" -ForegroundColor White
            Write-Host "  Baron longitud: $($data.comparison.difference.baronLength)" -ForegroundColor White
        }
    } else {
        Write-Host "Error: $($data.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
