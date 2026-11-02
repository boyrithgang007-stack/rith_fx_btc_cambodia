$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$configPath = Join-Path $projectRoot '.env.local'
if (-not (Test-Path -LiteralPath $configPath)) { throw 'Prepare .env.local first.' }
foreach ($line in Get-Content -LiteralPath $configPath) {
    if ($line -match '^(MT5_BRIDGE_TOKEN|MT5_TERMINAL_PATH)=(.*)$') {
        [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim().Trim('"').Trim("'"), 'Process')
    }
}
$pythonCommand = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCommand) { throw 'Install 64-bit Python and the official MetaTrader5 package first. See docs/real-account-setup.md.' }
& $pythonCommand.Source (Join-Path $PSScriptRoot 'bridge.py')
