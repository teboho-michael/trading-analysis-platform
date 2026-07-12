param(
  [string]$BackupRoot = "C:\TradingAnalysisPlatform\backups",
  [string]$DatabaseName = "trading_analysis",
  [int]$RetentionDays = 14
)

$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss-ffff"
$target = Join-Path $BackupRoot $timestamp
if (Test-Path $target) {
  throw "Backup target already exists: $target"
}
New-Item -ItemType Directory -Path $target | Out-Null

$dumpFile = Join-Path $target "$DatabaseName.dump"
if (Test-Path $dumpFile) {
  throw "Backup dump already exists: $dumpFile"
}
pg_dump --format=custom --no-owner --file $dumpFile $DatabaseName
if (-not (Test-Path $dumpFile) -or (Get-Item $dumpFile).Length -le 0) {
  throw "Backup dump was not created or is empty: $dumpFile"
}

$manifest = @{
  created_at = (Get-Date).ToUniversalTime().ToString("o")
  database = $DatabaseName
  dump_file = Split-Path $dumpFile -Leaf
  note = "Secrets are not printed or committed. Store backups outside Git."
}
$manifest | ConvertTo-Json | Out-File -Encoding utf8 (Join-Path $target "backup-manifest.json")

Get-ChildItem $BackupRoot -Directory | Where-Object { $_.CreationTime -lt (Get-Date).AddDays(-$RetentionDays) } | Remove-Item -Recurse -Force
Write-Host "PASS backup created: $target"
