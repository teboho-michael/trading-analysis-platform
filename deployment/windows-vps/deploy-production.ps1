param(
  [string]$RepoRoot = "C:\trading-analysis-platform",
  [string]$CommitSha = $env:GITHUB_SHA,
  [string]$ProductionBranch = "final-core-operational-release",
  [string]$LogRoot = "C:\trading-analysis-platform\logs"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Action
  )
  Write-Host "==> $Name"
  $global:LASTEXITCODE = 0
  & $Action
  if ($LASTEXITCODE -ne $null -and $LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE"
  }
}

if (-not (Test-Path $RepoRoot)) { throw "RepoRoot not found: $RepoRoot" }
$null = New-Item -ItemType Directory -Force -Path $LogRoot
$TranscriptPath = Join-Path $LogRoot ("deploy-production-{0}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
Start-Transcript -Path $TranscriptPath -Force | Out-Null
Push-Location $RepoRoot
try {
  $top = (& git rev-parse --show-toplevel).Trim()
  if ($top -ne $RepoRoot) { throw "Unexpected git root: $top" }
  if ($env:GITHUB_REF_NAME -and $env:GITHUB_REF_NAME -ne $ProductionBranch) { throw "Ref $env:GITHUB_REF_NAME is not approved production branch $ProductionBranch" }
  Invoke-Step "Fetch approved branch" { & git fetch --prune origin }
  if (-not $CommitSha) { $CommitSha = (& git rev-parse "origin/$ProductionBranch").Trim() }
  Invoke-Step "Checkout $CommitSha" { & git checkout --force $CommitSha }

  $lastFile = Join-Path $RepoRoot ".last-successful-deploy"
  if (Test-Path $lastFile) {
    Copy-Item $lastFile (Join-Path $RepoRoot ".previous-successful-deploy") -Force
  }

  Invoke-Step "Stop existing platform workers" { & (Join-Path $RepoRoot "deployment\windows-vps\stop-platform.ps1") -RepoRoot $RepoRoot }

  Push-Location (Join-Path $RepoRoot "server")
  try { Invoke-Step "Install server dependencies" { & npm ci --omit=dev } } finally { Pop-Location }

  Push-Location (Join-Path $RepoRoot "client")
  try {
    Invoke-Step "Install client dependencies" { & npm ci }
    Invoke-Step "Build client" { & npm run build }
  } finally { Pop-Location }

  $migrationScript = Join-Path $RepoRoot "server\scripts\runMigrations.js"
  if (Test-Path $migrationScript) {
    Invoke-Step "Apply migrations" {
      if ($env:POSTGRES_PASSWORD -and -not $env:PGPASSWORD) { $env:PGPASSWORD = $env:POSTGRES_PASSWORD }
      & node $migrationScript
    }
  } else {
    Write-Host "WARN no migration runner script found; run migrations through the existing VPS database process before promotion."
  }

  Invoke-Step "Start backend and exactly one bridge" { & (Join-Path $RepoRoot "deployment\windows-vps\start-platform.ps1") -RepoRoot $RepoRoot -LogRoot $LogRoot }
  Invoke-Step "Run health acceptance" { & (Join-Path $RepoRoot "deployment\windows-vps\health-check.ps1") -RepoRoot $RepoRoot -LogRoot $LogRoot }

  Set-Content -Path $lastFile -Value $CommitSha -Encoding ASCII
  Write-Host "PASS deployed $CommitSha"
  Write-Host "Transcript: $TranscriptPath"
} finally {
  Pop-Location
  Stop-Transcript | Out-Null
}
