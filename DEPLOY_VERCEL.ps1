# VERCEL DEPLOYMENT SCRIPT - PRE_VALIDADOR_SEFAZ
# Usage: .\DEPLOY_VERCEL.ps1

param(
    [string]$Token = "",
    [string]$ProjectName = "pre-validador-sefaz",
    [string]$Domain = "prevalidador_sefaz.nexus-tecnolog.ia.br"
)

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Vercel Deployment - PRE_VALIDADOR_SEFAZ" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Checking Vercel CLI..." -ForegroundColor Yellow
$vercelVersion = vercel --version 2>&1
if ($vercelVersion -match "error|not found") {
    Write-Host "ERROR: Vercel CLI not found. Install with: npm install -g vercel" -ForegroundColor Red
    exit 1
}
Write-Host "OK: Vercel CLI $vercelVersion" -ForegroundColor Green

if (-not (Test-Path "vercel.json")) {
    Write-Host "ERROR: vercel.json not found. Run this in the project root." -ForegroundColor Red
    exit 1
}
Write-Host "OK: Project structure validated`n" -ForegroundColor Green

Write-Host "Starting Vercel login..." -ForegroundColor Yellow
Write-Host "A browser window should open. Follow the login prompts.`n" -ForegroundColor Yellow

Read-Host "Press ENTER to continue"

vercel login

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Authentication failed" -ForegroundColor Red
    exit 1
}

Write-Host "`nDeploying to Vercel..." -ForegroundColor Yellow
Write-Host "Project: $ProjectName" -ForegroundColor Gray
Write-Host "Domain: $Domain`n" -ForegroundColor Gray

vercel --prod

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "SUCCESS: Deployment completed!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

Write-Host "NEXT STEPS:" -ForegroundColor Cyan
Write-Host "1. Visit: https://vercel.com/dashboard" -ForegroundColor Gray
Write-Host "2. Open project: $ProjectName" -ForegroundColor Gray
Write-Host "3. Go to Settings -> Domains" -ForegroundColor Gray
Write-Host "4. Add Domain: $Domain" -ForegroundColor Gray
Write-Host "5. Configure DNS as instructed" -ForegroundColor Gray
Write-Host "6. Wait 10-30 minutes for DNS propagation" -ForegroundColor Gray
Write-Host "7. Test: https://$Domain`n" -ForegroundColor Gray

Write-Host "See VERCEL_DEPLOYMENT_GUIDE.md for detailed instructions." -ForegroundColor Yellow
