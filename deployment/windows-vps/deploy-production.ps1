param(
  [string]$RepoRoot = "C:\TradingAnalysisPlatform\repo",
  [string]$CommitSha = $env:GITHUB_SHA,
  [string]$ProductionBranch = "production",
  [string]$LogRoot = "C:\TradingAnalysisPlatform\logs"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $RepoRoot)) { throw "RepoRoot not found: $RepoRoot" }
Push-Location $RepoRoot
try {
  $top = (& git rev-parse --show-toplevel).Trim()
  if ($top -ne $RepoRoot) { throw "Unexpected git root: $top" }
  if ($env:GITHUB_REF_NAME -and $env:GITHUB_REF_NAME -ne $ProductionBranch) { throw "Ref $env:GITHUB_REF_NAME is not approved production branch $ProductionBranch" }
  & git fetch --prune origin
  if (-not $CommitSha) { $CommitSha = (& git rev-parse "origin/$ProductionBranch").Trim() }
  & git checkout --force $CommitSha

  $lastFile = Join-Path $RepoRoot ".last-successful-deploy"
  if (Test-Path $lastFile) {
    Copy-Item $lastFile (Join-Path $RepoRoot ".previous-successful-deploy") -Force
  }

  & (Join-Path $RepoRoot "deployment\windows-vps\stop-platform.ps1")

  Push-Location (Join-Path $RepoRoot "server")
  try { & npm ci --omit=dev } finally { Pop-Location }

  Push-Location (Join-Path $RepoRoot "client")
  try {
    & npm ci
    & npm run build
  } finally { Pop-Location }

  $migrationScript = Join-Path $RepoRoot "server\scripts\runMigrations.js"
  if (Test-Path $migrationScript) {
    & node $migrationScript
  } else {
    Write-Host "WARN no migration runner script found; run migrations through the existing VPS database process before promotion."
  }

  & (Join-Path $RepoRoot "deployment\windows-vps\start-platform.ps1") -RepoRoot $RepoRoot -LogRoot $LogRoot
  & (Join-Path $RepoRoot "deployment\windows-vps\health-check.ps1") -RepoRoot $RepoRoot
  if ($LASTEXITCODE -gt 0) { throw "Health check failed with exit code $LASTEXITCODE" }

  Set-Content -Path $lastFile -Value $CommitSha -Encoding ASCII
  Write-Host "PASS deployed $CommitSha"
} finally {
  Pop-Location
}
