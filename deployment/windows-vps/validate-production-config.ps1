param(
  [ValidateSet("Backend", "Bridge", "All")]
  [string]$Component = "All",
  [string]$RepoRoot = "C:\trading-analysis-platform",
  [string]$LogRoot = "C:\trading-analysis-platform\logs"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null
$logPath = Join-Path $LogRoot ("config-validation-{0}.log" -f (Get-Date -Format "yyyyMMdd"))

function Write-ValidationLog {
  param([string]$Level, [string]$Message)
  $line = "{0} {1} config-validation - {2}" -f (Get-Date).ToUniversalTime().ToString("o"), $Level, $Message
  Add-Content -Path $logPath -Value $line -Encoding ASCII
  Write-Host "$Level $Message"
}

function Get-LocalJsonConfig {
  $localConfig = Join-Path $RepoRoot "tools\mt5_bridge\mt5_bridge.local.json"
  if (-not (Test-Path $localConfig)) { return @{} }
  try {
    $json = Get-Content $localConfig -Raw | ConvertFrom-Json
    $result = @{}
    $json.PSObject.Properties | ForEach-Object { $result[$_.Name] = $_.Value }
    return $result
  } catch {
    throw "Bridge local config is not valid JSON: $localConfig"
  }
}

function Get-DotEnvConfig {
  param([string]$Path)
  $result = @{}
  if (-not (Test-Path $Path)) { return $result }
  Get-Content $Path | ForEach-Object {
    $line = [string]$_
    if ($line.Trim().Length -gt 0 -and -not $line.TrimStart().StartsWith("#")) {
      $separator = $line.IndexOf("=")
      if ($separator -gt 0) {
        $name = $line.Substring(0, $separator).Trim()
        $value = $line.Substring($separator + 1)
        if (-not [string]::IsNullOrWhiteSpace($name)) {
          $result[$name] = $value
        }
      }
    }
  }
  return $result
}

function Test-EnvOrLocalConfig {
  param([string]$Name, [hashtable]$LocalConfig)
  $value = [Environment]::GetEnvironmentVariable($Name, "Process")
  if (-not $value) { $value = [Environment]::GetEnvironmentVariable($Name, "User") }
  if (-not $value) { $value = [Environment]::GetEnvironmentVariable($Name, "Machine") }
  if ($value) { return $true }
  return $LocalConfig.ContainsKey($Name) -and -not [string]::IsNullOrWhiteSpace([string]$LocalConfig[$Name])
}

function Assert-RequiredConfig {
  param([string]$Name, [hashtable]$LocalConfig = @{})
  if (-not (Test-EnvOrLocalConfig -Name $Name -LocalConfig $LocalConfig)) {
    throw "Missing required configuration variable: $Name"
  }
  Write-ValidationLog "PASS" "$Name is configured"
}

try {
  if ($Component -eq "Backend" -or $Component -eq "All") {
    $backendConfig = Get-DotEnvConfig -Path (Join-Path $RepoRoot "server\.env")
    foreach ($name in @("PORT", "DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD", "MT5_BRIDGE_SECRET", "MARKET_PROVIDER")) {
      Assert-RequiredConfig -Name $name -LocalConfig $backendConfig
    }
  }

  if ($Component -eq "Bridge" -or $Component -eq "All") {
    $bridgeConfig = Get-LocalJsonConfig
    foreach ($name in @("PLATFORM_API_BASE_URL", "MT5_BRIDGE_SECRET")) {
      Assert-RequiredConfig -Name $name -LocalConfig $bridgeConfig
    }
  }

  Write-ValidationLog "PASS" "$Component production configuration validation completed"
} catch {
  Write-ValidationLog "FAIL" $_.Exception.Message
  throw
}
