$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envFile = Join-Path $projectRoot '.env.local'
$nextCli = Join-Path $projectRoot 'node_modules\next\dist\bin\next'
$logDirectory = Join-Path $projectRoot '.tmp\local-ea'
$stdoutPath = Join-Path $logDirectory 'app.stdout.log'
$stderrPath = Join-Path $logDirectory 'app.stderr.log'
$pidPath = Join-Path $logDirectory 'app.pid'

if (-not (Test-Path -LiteralPath $envFile)) { throw 'Create .env.local with the app database and encryption settings first.' }
if (-not (Test-Path -LiteralPath $nextCli)) { throw 'Install the project dependencies with npm ci first.' }

$settings = @{}
foreach ($line in Get-Content -LiteralPath $envFile) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        $settings[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
    }
}
if (-not $settings['DATABASE_URL']) { throw 'DATABASE_URL is missing from .env.local.' }
if (-not $settings['AUTH_SECRET'] -or $settings['AUTH_SECRET'].Length -lt 32) { throw 'AUTH_SECRET must contain at least 32 characters.' }
if ($settings['EXCHANGE_ENCRYPTION_KEY'] -notmatch '^[a-fA-F0-9]{64}$') { throw 'EXCHANGE_ENCRYPTION_KEY must contain 64 hexadecimal characters.' }

$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) { throw 'Node.js 22 or newer is required.' }
$version = (& $node.Source --version).Trim()
if ($version -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 22) { throw 'Node.js 22 or newer is required.' }

$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
    try {
        $response = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/' -UseBasicParsing -TimeoutSec 3
        if ($response.Content -notmatch 'RFX BTC TEAM Cambodia') { throw 'Unexpected local page.' }
        Write-Output 'The local RFX app is already available at http://127.0.0.1:3000/'
        exit 0
    } catch {
        throw 'Port 3000 is already in use by another process. Stop that app or choose another port before starting RFX.'
    }
}

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$process = Start-Process -FilePath $node.Source `
    -ArgumentList @($nextCli, 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '3000') `
    -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
Set-Content -LiteralPath $pidPath -Value $process.Id -NoNewline

for ($attempt = 0; $attempt -lt 60; $attempt++) {
    Start-Sleep -Seconds 1
    if ($process.HasExited) {
        Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
        throw "The local app stopped during startup. Review .tmp\local-ea\app.stderr.log."
    }
    try {
        $response = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/' -UseBasicParsing -TimeoutSec 2
        if ($response.Content -notmatch 'RFX BTC TEAM Cambodia') { continue }
        Write-Output 'Local RFX app started at http://127.0.0.1:3000/'
        Write-Output 'The Binance Futures Testnet worker starts only for accounts that are verified and enabled in this local app.'
        Write-Output 'Keep this computer awake and connected while the worker is enabled.'
        exit 0
    } catch { }
}

throw 'The local app did not become ready within 60 seconds. Review .tmp\local-ea\app.stderr.log.'
