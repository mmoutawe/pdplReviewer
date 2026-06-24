# deploy.ps1 — Deploy PDPL Reviewer Azure infrastructure + Power Pages code
# Prerequisites: az CLI and pac CLI installed and authenticated
# Run from repo root: .\infra\deploy.ps1

param(
    [string]$ResourceGroup       = "rg-pdpl-reviewer",
    [string]$Location            = "westeurope",
    [string]$Environment         = "dev",
    [string]$OpenAiEndpoint      = "https://smartcampaigner.openai.azure.com/",
    [string]$OpenAiDeployment    = "gpt-5.1",
    [string]$OpenAiResourceName  = "SmartCampaigner",
    [string]$OpenAiResourceGroup = "rg-mmoutawe-2245",
    [string]$DataverseUrl        = "https://orgd19a3059.crm4.dynamics.com"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent

# ── 1. Fetch the OpenAI key securely from Azure ───────────────────────────────

Write-Host "Fetching Azure OpenAI key..." -ForegroundColor Cyan
$openAiKey = az cognitiveservices account keys list `
    --name $OpenAiResourceName `
    --resource-group $OpenAiResourceGroup `
    --query "key1" -o tsv

if (-not $openAiKey) {
    Write-Error "Could not retrieve OpenAI key. Verify --OpenAiResourceName and --OpenAiResourceGroup."
    exit 1
}
Write-Host "  Key retrieved." -ForegroundColor Green

# ── 2. Create resource group ──────────────────────────────────────────────────

Write-Host "Ensuring resource group '$ResourceGroup'..." -ForegroundColor Cyan
az group create --name $ResourceGroup --location $Location | Out-Null

# ── 3. Deploy Bicep (params passed on CLI to keep the key out of files) ───────

Write-Host "Deploying infrastructure..." -ForegroundColor Cyan
$resultJson = az deployment group create `
    --resource-group       $ResourceGroup `
    --template-file        "$PSScriptRoot\main.bicep" `
    --parameters           "environment=$Environment" `
    --parameters           "location=$Location" `
    --parameters           "openAiEndpoint=$OpenAiEndpoint" `
    --parameters           "openAiKey=$openAiKey" `
    --parameters           "openAiDeploymentName=$OpenAiDeployment" `
    --parameters           "dataverseUrl=$DataverseUrl" `
    --output               json

if ($LASTEXITCODE -ne 0) { Write-Error "Bicep deployment failed."; exit 1 }

$outputs  = ($resultJson | ConvertFrom-Json).properties.outputs
$afBaseUrl = $outputs.afBaseUrl.value

Write-Host ""
Write-Host "=== Infrastructure deployed ===" -ForegroundColor Green
Write-Host "  Azure Functions URL : $afBaseUrl"

# ── 4. Deploy Azure Functions code ────────────────────────────────────────────

$fnAppName = "pdplr-fn-$Environment"
Write-Host ""
Write-Host "Deploying Azure Functions code to '$fnAppName'..." -ForegroundColor Cyan
Push-Location "$repoRoot\azure-functions"
try {
    npm install --silent
    if (Test-Path "package.json") {
        $pkg = Get-Content "package.json" | ConvertFrom-Json
        if ($pkg.scripts.build) { npm run build }
    }
    func azure functionapp publish $fnAppName --node
} finally {
    Pop-Location
}

# ── 5. Update .env.local with live AF URL ─────────────────────────────────────

Write-Host ""
Write-Host "Updating .env.local with live AF URL..." -ForegroundColor Cyan
$envPath    = "$repoRoot\.env.local"
$envContent = Get-Content $envPath -Raw
$envContent = $envContent -replace 'VITE_AF_BASE_URL=.*', "VITE_AF_BASE_URL=$afBaseUrl"
Set-Content $envPath $envContent -Encoding utf8
Write-Host "  VITE_AF_BASE_URL set to $afBaseUrl"

# ── 6. Build React app for Power Pages ────────────────────────────────────────

Write-Host ""
Write-Host "Building React app..." -ForegroundColor Cyan
Push-Location $repoRoot
try {
    $env:VITE_BASE_URL = ""
    npm run build
} finally {
    Remove-Item Env:\VITE_BASE_URL -ErrorAction SilentlyContinue
    Pop-Location
}

# ── 7. Upload to Power Pages ──────────────────────────────────────────────────

Write-Host ""
Write-Host "Uploading to Power Pages..." -ForegroundColor Cyan
pac pages upload-code-site --siteName "PDPL Reviewer" --rootDirectory "$repoRoot\dist"

Write-Host ""
Write-Host "=== All done ===" -ForegroundColor Green
Write-Host ""
Write-Host "Power Pages site setting to verify/add:"
Write-Host "  PDPL/AfBaseUrl = $afBaseUrl"
