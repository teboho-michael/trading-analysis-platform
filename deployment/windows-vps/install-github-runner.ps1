param(
  [string]$RunnerRoot = "C:\trading-analysis-platform\github-runner",
  [string]$RepoUrl,
  [string]$RunnerVersion = "2.328.0"
)

$ErrorActionPreference = "Stop"

if (-not $RepoUrl) {
  throw "RepoUrl is required. Example: -RepoUrl https://github.com/OWNER/REPO"
}

New-Item -ItemType Directory -Force -Path $RunnerRoot | Out-Null
$archive = Join-Path $RunnerRoot "actions-runner-win-x64-$RunnerVersion.zip"
$downloadUrl = "https://github.com/actions/runner/releases/download/v$RunnerVersion/actions-runner-win-x64-$RunnerVersion.zip"

if (-not (Test-Path $archive)) {
  Invoke-WebRequest -Uri $downloadUrl -OutFile $archive
}

Expand-Archive -Path $archive -DestinationPath $RunnerRoot -Force

Write-Host "Runner files installed at $RunnerRoot"
Write-Host "Next manual step, outside Git and without storing tokens:"
Write-Host "1. In GitHub, create a self-hosted runner registration token for this repository."
Write-Host "2. Run:"
Write-Host "   cd `"$RunnerRoot`""
Write-Host "   .\config.cmd --url $RepoUrl --token <TOKEN> --name TradingAnalysisPlatform-VPS --labels trading-analysis-platform,production,windows,vps --unattended"
Write-Host "   .\svc.cmd install"
Write-Host "   .\svc.cmd start"
