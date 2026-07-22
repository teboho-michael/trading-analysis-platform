param(
  [Parameter(Mandatory = $true)][string]$BackupFile,
  [Parameter(Mandatory = $true)][string]$DatabaseName,
  [string]$LogRoot = "C:\trading-analysis-platform\logs",
  [switch]$ConfirmRestore,
  [switch]$AllowProductionTarget
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null
$TranscriptPath = Join-Path $LogRoot ("restore-platform-{0}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
Start-Transcript -Path $TranscriptPath -Force | Out-Null

try {
if (-not (Test-Path $BackupFile)) {
  throw "Backup file not found: $BackupFile"
}
if (-not $ConfirmRestore) {
  throw "Restore is blocked until -ConfirmRestore is provided. Restore tests must target a separate test database."
}
if ($DatabaseName -eq "trading_analysis" -and -not $AllowProductionTarget) {
  throw "Refusing to restore into production database trading_analysis without -AllowProductionTarget. Use a separate test database for restore verification."
}

Write-Host "Restoring $BackupFile into $DatabaseName"
pg_restore --clean --if-exists --no-owner --dbname $DatabaseName $BackupFile
Write-Host "PASS restore command completed"
Write-Host "Run verification queries against $DatabaseName: SELECT current_database(); SELECT COUNT(*) FROM candles;"
Write-Host "Transcript: $TranscriptPath"
} finally {
  Stop-Transcript | Out-Null
}
