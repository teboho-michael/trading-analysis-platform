param(
  [string]$RepoRoot = "C:\trading-analysis-platform",
  [string]$LogRoot = "C:\trading-analysis-platform\logs"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null
$TranscriptPath = Join-Path $LogRoot ("rollback-production-{0}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
Start-Transcript -Path $TranscriptPath -Force | Out-Null

try {
$previousFile = Join-Path $RepoRoot ".previous-successful-deploy"
if (-not (Test-Path $previousFile)) { throw "No previous successful deployment commit was recorded." }
$commit = (Get-Content $previousFile | Select-Object -First 1).Trim()
if (-not $commit) { throw "Previous successful deployment file is empty." }

Write-Host "INFO rolling back application code to previous successful commit $commit"
Write-Host "INFO database rollback is not automatic; production data is preserved."
& (Join-Path $RepoRoot "deployment\windows-vps\deploy-production.ps1") -RepoRoot $RepoRoot -CommitSha $commit -LogRoot $LogRoot
Write-Host "Transcript: $TranscriptPath"
} finally {
  Stop-Transcript | Out-Null
}
