param(
  [Parameter(Mandatory = $true)][string]$BackupFile,
  [string]$DatabaseName = "trading_analysis",
  [switch]$ConfirmRestore
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path $BackupFile)) {
  throw "Backup file not found: $BackupFile"
}
if (-not $ConfirmRestore) {
  throw "Restore is blocked until -ConfirmRestore is provided. Review the target database before continuing."
}

Write-Host "Restoring $BackupFile into $DatabaseName"
pg_restore --clean --if-exists --no-owner --dbname $DatabaseName $BackupFile
Write-Host "PASS restore command completed"
