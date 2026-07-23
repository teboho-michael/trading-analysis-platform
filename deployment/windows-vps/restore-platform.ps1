param(
  [Parameter(Mandatory = $true)][string]$BackupFile,
  [Parameter(Mandatory = $true)][string]$DatabaseName,
  [string]$RepoRoot = "C:\trading-analysis-platform",
  [string]$LogRoot = "C:\trading-analysis-platform\logs",
  [switch]$ConfirmRestore,
  [switch]$AllowProductionTarget
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null
$TranscriptPath = Join-Path $LogRoot ("restore-platform-{0}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
Start-Transcript -Path $TranscriptPath -Force | Out-Null

function Get-DotEnvConfig {
  param([string]$Path)
  $result = @{}
  if (-not (Test-Path $Path)) { return $result }

  Get-Content $Path | ForEach-Object {
    $line = [string]$_
    $trimmed = $line.Trim()
    if ($trimmed.Length -gt 0 -and -not $trimmed.StartsWith("#")) {
      $separator = $line.IndexOf("=")
      if ($separator -gt 0) {
        $name = $line.Substring(0, $separator).Trim()
        $value = $line.Substring($separator + 1).Trim()
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
          $value = $value.Substring(1, $value.Length - 2)
        }
        if (-not [string]::IsNullOrWhiteSpace($name)) {
          $result[$name] = $value
        }
      }
    }
  }

  return $result
}

function Get-ConfigValue {
  param([string]$Name, [hashtable]$LocalConfig)

  $value = [Environment]::GetEnvironmentVariable($Name, "Process")
  if (-not $value) { $value = [Environment]::GetEnvironmentVariable($Name, "User") }
  if (-not $value) { $value = [Environment]::GetEnvironmentVariable($Name, "Machine") }
  if ($value) { return $value }
  if ($LocalConfig.ContainsKey($Name)) { return [string]$LocalConfig[$Name] }
  return $null
}

function Assert-ConfigValue {
  param([string]$Name, [hashtable]$LocalConfig)

  $value = Get-ConfigValue -Name $Name -LocalConfig $LocalConfig
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing required database restore configuration variable: $Name"
  }
  return $value
}

$previousPgPassword = [Environment]::GetEnvironmentVariable("PGPASSWORD", "Process")

try {
  if (-not (Test-Path $BackupFile)) {
    throw "Backup file not found: $BackupFile"
  }
  if (-not $ConfirmRestore) {
    throw "Restore is blocked until -ConfirmRestore is provided. Restore tests must target a separate test database."
  }

  $backendConfig = Get-DotEnvConfig -Path (Join-Path $RepoRoot "server\.env")
  $dbHost = Assert-ConfigValue -Name "DB_HOST" -LocalConfig $backendConfig
  $dbPort = Assert-ConfigValue -Name "DB_PORT" -LocalConfig $backendConfig
  $productionDatabaseName = Assert-ConfigValue -Name "DB_NAME" -LocalConfig $backendConfig
  $dbUser = Assert-ConfigValue -Name "DB_USER" -LocalConfig $backendConfig
  $dbPassword = Assert-ConfigValue -Name "DB_PASSWORD" -LocalConfig $backendConfig

  if ($DatabaseName -eq $productionDatabaseName -and -not $AllowProductionTarget) {
    throw "Refusing to restore into production database $productionDatabaseName without -AllowProductionTarget. Use a separate test database for restore verification."
  }

  Write-Host "Restore database configuration loaded from approved environment/server .env sources."
  Write-Host "Restoring $BackupFile into $DatabaseName"
  $env:PGPASSWORD = $dbPassword
  pg_restore --clean --if-exists --no-owner --host $dbHost --port $dbPort --username $dbUser --dbname $DatabaseName $BackupFile
  Write-Host "PASS restore command completed"
  Write-Host ("Run verification queries against {0}: SELECT current_database(); SELECT COUNT(*) FROM candles;" -f $DatabaseName)
  Write-Host "Transcript: $TranscriptPath"
} finally {
  if ($null -eq $previousPgPassword) {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  } else {
    $env:PGPASSWORD = $previousPgPassword
  }
  Stop-Transcript | Out-Null
}
