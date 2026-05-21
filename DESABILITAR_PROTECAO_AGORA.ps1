# PRE_VALIDADOR_SEFAZ - Disable Deployment Protection
# Guide to disable protection on Vercel

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Disable Deployment Protection - Vercel" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Opening Vercel Dashboard..." -ForegroundColor Yellow
Start-Process "https://vercel.com/dashboard"

Start-Sleep -Seconds 3

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "FOLLOW THESE STEPS IN THE BROWSER" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

Write-Host "STEP 1: Open Project" -ForegroundColor Cyan
Write-Host "  - Click: pre_validador_sefaz" -ForegroundColor Gray

Write-Host "`nSTEP 2: Go to Settings" -ForegroundColor Cyan
Write-Host "  - Click: Settings (top menu)" -ForegroundColor Gray

Write-Host "`nSTEP 3: Find Deployment Protection" -ForegroundColor Cyan
Write-Host "  - Left sidebar: Security" -ForegroundColor Gray
Write-Host "  - Then: Deployment Protection" -ForegroundColor Gray

Write-Host "`nSTEP 4: Disable Protection" -ForegroundColor Cyan
Write-Host "  - Click the toggle/button to DISABLE" -ForegroundColor Gray
Write-Host "  - Confirm if dialog appears" -ForegroundColor Gray

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "After disabling (30 seconds)..." -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

Write-Host "Your site will be LIVE at:" -ForegroundColor Yellow
Write-Host "  https://prevalidador_sefaz.nexus-tecnolog.ia.br" -ForegroundColor Cyan

Write-Host "`nTest it:" -ForegroundColor Yellow
Write-Host "  1. Visit the URL above" -ForegroundColor Gray
Write-Host "  2. Click drag-drop area" -ForegroundColor Gray
Write-Host "  3. Select XML from testes/ folder" -ForegroundColor Gray
Write-Host "  4. Click Validar XML" -ForegroundColor Gray
Write-Host "  5. Result in < 300ms" -ForegroundColor Gray

Write-Host "`nPress ENTER when done..." -ForegroundColor Yellow
Read-Host ""

Write-Host "`nChecking status..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

$response = Invoke-WebRequest -Uri "https://prevalidador_sefaz.nexus-tecnolog.ia.br/" -ErrorAction SilentlyContinue

if ($response.StatusCode -eq 200) {
    Write-Host "SUCCESS! Site is live!" -ForegroundColor Green
} else {
    Write-Host "Still propagating (wait 30 min)" -ForegroundColor Yellow
}

Write-Host ""
