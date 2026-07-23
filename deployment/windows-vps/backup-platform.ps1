param(
  [string]$BackupRoot = "C:\trading-analysis-platform\backups",
  [string]$LogRoot = "C:\trading-analysis-platform\logs",
  [string]$RepoRoot = "C:\trading-analysis-platform",
  [string]$DatabaseName = "",
  [int]$RetentionDays = 14
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $BackupRoot, $LogRoot | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss-ffff"
$TranscriptPath = Join-Path $LogRoot ("backup-platform-{0}.log" -f $timestamp)
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
    throw "Missing required database backup configuration variable: $Name"
  }
  return $value
}

$previousPgPassword = [Environment]::GetEnvironmentVariable("PGPASSWORD", "Process")
$target = $null
$dumpFile = $null
$targetCreated = $false

try {
  $backendConfig = Get-DotEnvConfig -Path (Join-Path $RepoRoot "server\.env")
  $dbHost = Assert-ConfigValue -Name "DB_HOST" -LocalConfig $backendConfig
  $dbPort = Assert-ConfigValue -Name "DB_PORT" -LocalConfig $backendConfig
  $configuredDatabaseName = Assert-ConfigValue -Name "DB_NAME" -LocalConfig $backendConfig
  $dbUser = Assert-ConfigValue -Name "DB_USER" -LocalConfig $backendConfig
  $dbPassword = Assert-ConfigValue -Name "DB_PASSWORD" -LocalConfig $backendConfig
  if ([string]::IsNullOrWhiteSpace($DatabaseName)) {
    $DatabaseName = $configuredDatabaseName
  }

  Write-Host "Backup database configuration loaded from approved environment/server .env sources."

  $target = Join-Path $BackupRoot $timestamp
  if (Test-Path $target) {
    throw "Backup target already exists: $target"
  }
  New-Item -ItemType Directory -Path $target | Out-Null
  $targetCreated = $true

  $dumpFile = Join-Path $target "$DatabaseName.dump"
  if (Test-Path $dumpFile) {
    throw "Backup dump already exists: $dumpFile"
  }

  $env:PGPASSWORD = $dbPassword
  pg_dump --format=custom --no-owner --host $dbHost --port $dbPort --username $dbUser --dbname $DatabaseName --file $dumpFile
  if (-not (Test-Path $dumpFile) -or (Get-Item $dumpFile).Length -le 0) {
    throw "Backup dump was not created or is empty: $dumpFile"
  }

  $manifest = @{
    created_at = (Get-Date).ToUniversalTime().ToString("o")
    database = $DatabaseName
    host = $dbHost
    port = $dbPort
    user = $dbUser
    dump_file = Split-Path $dumpFile -Leaf
    note = "Secrets are not printed or committed. Store backups outside Git."
  }
  $manifest | ConvertTo-Json | Out-File -Encoding utf8 (Join-Path $target "backup-manifest.json")

  Get-ChildItem $BackupRoot -Directory | Where-Object { $_.CreationTime -lt (Get-Date).AddDays(-$RetentionDays) } | Remove-Item -Recurse -Force
  Get-ChildItem $LogRoot -File -Filter "backup-platform-*.log" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } | Remove-Item -Force
  Write-Host "PASS backup created: $target"
  Write-Host "Transcript: $TranscriptPath"
} catch {
  if ($targetCreated -and $target -and (Test-Path $target)) {
    Remove-Item -Path $target -Recurse -Force
  }
  Write-Host "FAIL backup failed: $($_.Exception.Message)"
  throw
} finally {
  if ($null -eq $previousPgPassword) {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  } else {
    $env:PGPASSWORD = $previousPgPassword
  }
  Stop-Transcript | Out-Null
}
