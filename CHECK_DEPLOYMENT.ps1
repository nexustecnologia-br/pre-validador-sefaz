# PRE_VALIDADOR_SEFAZ - Deployment Status Check
# Verifica o status do deployment

param(
    [string]$URL = "https://prevalidadorsefaz-onevuw1zf-rodrigopaesrj-8422s-projects.vercel.app"
)

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "PRE_VALIDADOR_SEFAZ - Deployment Check" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check 1: Website loads
Write-Host "Check 1: Website HTML..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$URL/" -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ HTML loads (Status: 200 OK)" -ForegroundColor Green
        $check1 = $true
    } elseif ($response.StatusCode -eq 401) {
        Write-Host "⚠️  Protected by auth (Status: 401 Unauthorized)" -ForegroundColor Yellow
        Write-Host "   FIX: See FIX_DEPLOYMENT_PROTECTION.md" -ForegroundColor Yellow
        $check1 = $false
    } else {
        Write-Host "❌ Error (Status: $($response.StatusCode))" -ForegroundColor Red
        $check1 = $false
    }
} catch {
    Write-Host "❌ Connection failed: Protected or offline" -ForegroundColor Red
    $check1 = $false
}

# Check 2: API endpoint
Write-Host "`nCheck 2: API Endpoint..." -ForegroundColor Yellow
try {
    $body = @{
        xmlContent = '<?xml version="1.0"?><root><CFOP>5102</CFOP></root>'
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "$URL/api/validar" `
        -Method POST `
        -Headers @{'Content-Type'='application/json'} `
        -Body $body `
        -ErrorAction SilentlyContinue

    if ($response.StatusCode -eq 200) {
        Write-Host "✅ API responds (Status: 200 OK)" -ForegroundColor Green
        $result = $response.Content | ConvertFrom-Json
        Write-Host "   Response: $($result.status)" -ForegroundColor Green
        $check2 = $true
    } elseif ($response.StatusCode -eq 401) {
        Write-Host "⚠️  API protected (Status: 401 Unauthorized)" -ForegroundColor Yellow
        Write-Host "   FIX: See FIX_DEPLOYMENT_PROTECTION.md" -ForegroundColor Yellow
        $check2 = $false
    } else {
        Write-Host "❌ Error (Status: $($response.StatusCode))" -ForegroundColor Red
        $check2 = $false
    }
} catch {
    Write-Host "❌ API failed: $_" -ForegroundColor Red
    $check2 = $false
}

# Check 3: SSL/HTTPS
Write-Host "`nCheck 3: HTTPS/SSL..." -ForegroundColor Yellow
if ($URL.StartsWith("https://")) {
    Write-Host "✅ Using HTTPS" -ForegroundColor Green
    $check3 = $true
} else {
    Write-Host "❌ Not using HTTPS" -ForegroundColor Red
    $check3 = $false
}

# Check 4: Vercel CLI authenticated
Write-Host "`nCheck 4: Vercel CLI..." -ForegroundColor Yellow
try {
    $vercel = vercel whoami 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Vercel CLI authenticated" -ForegroundColor Green
        Write-Host "   User: $vercel" -ForegroundColor Green
        $check4 = $true
    } else {
        Write-Host "⚠️  Not authenticated. Run: vercel login" -ForegroundColor Yellow
        $check4 = $false
    }
} catch {
    Write-Host "❌ Vercel CLI not found" -ForegroundColor Red
    $check4 = $false
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$passed = 0
$check1 -and $passed++ > $null
$check2 -and $passed++ > $null
$check3 -and $passed++ > $null
$check4 -and $passed++ > $null

Write-Host "Website:       $(if ($check1) { '✅' } else { '❌' })" -ForegroundColor $(if ($check1) { 'Green' } else { 'Red' })
Write-Host "API:           $(if ($check2) { '✅' } else { '❌' })" -ForegroundColor $(if ($check2) { 'Green' } else { 'Red' })
Write-Host "HTTPS/SSL:     $(if ($check3) { '✅' } else { '❌' })" -ForegroundColor $(if ($check3) { 'Green' } else { 'Red' })
Write-Host "Vercel CLI:    $(if ($check4) { '✅' } else { '❌' })" -ForegroundColor $(if ($check4) { 'Green' } else { 'Red' })
Write-Host "`nPassed: $passed/4" -ForegroundColor Cyan

if ($passed -eq 4) {
    Write-Host "`n🎉 All checks passed! Ready for production! 🎉" -ForegroundColor Green
} else {
    Write-Host "`n⚠️  Some checks failed. See actions above." -ForegroundColor Yellow
}

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. If #1 or #2 shows 401: Fix with FIX_DEPLOYMENT_PROTECTION.md" -ForegroundColor Yellow
Write-Host "2. Once all pass: Follow ACOES_PROXIMAS.md for domain setup" -ForegroundColor Yellow
Write-Host ""
