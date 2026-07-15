param(
  [string]$RepoRoot = "C:\TradingAnalysisPlatform\repo",
  [string]$LogRoot = "C:\TradingAnalysisPlatform\logs"
)

$ErrorActionPreference = "Stop"
$previousFile = Join-Path $RepoRoot ".previous-successful-deploy"
if (-not (Test-Path $previousFile)) { throw "No previous successful deployment commit was recorded." }
$commit = (Get-Content $previousFile | Select-Object -First 1).Trim()
if (-not $commit) { throw "Previous successful deployment file is empty." }

& (Join-Path $RepoRoot "deployment\windows-vps\deploy-production.ps1") -RepoRoot $RepoRoot -CommitSha $commit -LogRoot $LogRoot
