param(
  [string]$RepoRoot = "C:\trading-analysis-platform",
  [string]$LogRoot = "C:\trading-analysis-platform\logs"
)

$ErrorActionPreference = "Stop"
$TaskKillExe = Join-Path $env:SystemRoot "System32\taskkill.exe"
$OwnedNames = @("backend", "frontend", "cloudflared")
$RequiredPorts = @(4173, 5000)
$pathSeparators = [char[]]@([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
$normalizedRepoRoot = [System.IO.Path]::GetFullPath($RepoRoot).TrimEnd($pathSeparators).Replace("/", "\")

function Get-ProcessSnapshot {
  @(Get-CimInstance Win32_Process -ErrorAction Stop)
}

function Get-DescendantProcessIds {
  param([int]$RootPid, [array]$Snapshot)
  $children = @{}
  foreach ($process in $Snapshot) {
    $parentKey = [string]$process.ParentProcessId
    if (-not $children.ContainsKey($parentKey)) { $children[$parentKey] = New-Object System.Collections.ArrayList }
    [void]$children[$parentKey].Add([int]$process.ProcessId)
  }
  $result = New-Object System.Collections.ArrayList
  $pending = New-Object System.Collections.Queue
  $pending.Enqueue($RootPid)
  while ($pending.Count -gt 0) {
    $parentPid = [int]$pending.Dequeue()
    $parentKey = [string]$parentPid
    if (-not $children.ContainsKey($parentKey)) { continue }
    foreach ($childPid in $children[$parentKey]) {
      if (-not $result.Contains($childPid)) {
        [void]$result.Add($childPid)
        $pending.Enqueue($childPid)
      }
    }
  }
  @($result)
}

function Test-RepositoryOwnedProcess {
  param($Process, [hashtable]$KnownOwnedIds)
  if (-not $Process) { return $false }
  if ($KnownOwnedIds.ContainsKey([string]$Process.ProcessId)) { return $true }
  $commandLine = [string]$Process.CommandLine
  if ($commandLine -like "*TradingAnalysisPlatform:*") { return $true }
  if ($commandLine.Replace("/", "\") -like "*$normalizedRepoRoot*") { return $true }
  return $false
}

function Invoke-PlatformTreeKill {
  param([int]$RootPid, [string]$Reason)
  $current = Get-CimInstance Win32_Process -Filter "ProcessId=$RootPid" -ErrorAction SilentlyContinue
  if (-not $current) { return }
  Write-Host "Stopping platform-owned process tree RootPID=$RootPid Reason=$Reason"
  $taskKillOutput = & $TaskKillExe /PID $RootPid /T /F
  $taskKillExitCode = $LASTEXITCODE
  if ($taskKillOutput) { $taskKillOutput | ForEach-Object { Write-Host "taskkill: $_" } }
  if ($taskKillExitCode -ne 0 -and (Get-CimInstance Win32_Process -Filter "ProcessId=$RootPid" -ErrorAction SilentlyContinue)) {
    Write-Host "WARN taskkill failed RootPID=$RootPid ExitCode=$taskKillExitCode"
  }
  $global:LASTEXITCODE = 0
}

function Get-PortOwners {
  param([int]$Port)
  @(
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique
  )
}

$tasks = Get-ScheduledTask -TaskName "TradingAnalysisPlatform-*" -ErrorAction SilentlyContinue
foreach ($task in $tasks) {
  if ($task.State -eq "Running") {
    Write-Host "Stopping platform-owned scheduled task $($task.TaskName)"
    Stop-ScheduledTask -TaskName $task.TaskName
  }
}

$snapshot = Get-ProcessSnapshot
$ownedRoots = @($snapshot | Where-Object { $_.CommandLine -like "*TradingAnalysisPlatform:*" })
foreach ($name in $OwnedNames) {
  $pidFile = Join-Path $LogRoot "$name.pid"
  if (-not (Test-Path $pidFile)) { continue }
  $recordedPidText = ([string](Get-Content $pidFile -Raw -ErrorAction SilentlyContinue)).Trim()
  $recordedPid = 0
  if (-not [int]::TryParse($recordedPidText, [ref]$recordedPid) -or $recordedPid -le 0) {
    Write-Host "WARN ignoring malformed ownership PID file: $pidFile"
    continue
  }
  $recordedProcess = $snapshot | Where-Object { $_.ProcessId -eq $recordedPid } | Select-Object -First 1
  if ($recordedProcess -and $recordedProcess.CommandLine -like "*TradingAnalysisPlatform:$name*") {
    $ownedRoots += $recordedProcess
  } elseif ($recordedProcess) {
    Write-Host "WARN refusing PID file ownership mismatch Name=$name PID=$recordedPid CommandLine=$($recordedProcess.CommandLine)"
  }
}

$ownedRoots = @($ownedRoots | Sort-Object ProcessId -Unique)
$knownOwnedIds = @{}
foreach ($root in $ownedRoots) {
  $descendantPids = @(Get-DescendantProcessIds -RootPid $root.ProcessId -Snapshot $snapshot)
  $knownOwnedIds[[string]$root.ProcessId] = $true
  foreach ($descendantPid in $descendantPids) { $knownOwnedIds[[string]$descendantPid] = $true }
  $descendantText = if ($descendantPids.Count -gt 0) { $descendantPids -join "," } else { "none" }
  Write-Host "Platform-owned tree RootPID=$($root.ProcessId) DescendantPIDs=$descendantText"
}

foreach ($root in $ownedRoots) {
  Invoke-PlatformTreeKill -RootPid $root.ProcessId -Reason "ownership marker"
}

$bridgeProcesses = @(Get-CimInstance Win32_Process | Where-Object {
  ($_.Name -eq "python.exe" -or $_.Name -eq "pythonw.exe") -and
  $_.CommandLine -like "*mt5_candle_bridge.py*" -and
  $_.CommandLine -like "*--run-continuous*"
})
foreach ($process in $bridgeProcesses) {
  $knownOwnedIds[[string]$process.ProcessId] = $true
  Invoke-PlatformTreeKill -RootPid $process.ProcessId -Reason "exact continuous MT5 bridge command"
}

if ($ownedRoots.Count -eq 0 -and -not $tasks -and @($bridgeProcesses).Count -eq 0) {
  Write-Host "No platform-owned processes or scheduled tasks found"
}

Start-Sleep -Seconds 2
$deadline = (Get-Date).AddSeconds(20)
do {
  $remainingSnapshot = Get-ProcessSnapshot
  $remainingOwned = @($remainingSnapshot | Where-Object { $knownOwnedIds.ContainsKey([string]$_.ProcessId) })
  foreach ($remainingProcess in $remainingOwned) {
    Write-Host "Remaining captured platform process PID=$($remainingProcess.ProcessId) ParentPID=$($remainingProcess.ParentProcessId) CommandLine=$($remainingProcess.CommandLine)"
    Invoke-PlatformTreeKill -RootPid $remainingProcess.ProcessId -Reason "captured platform descendant remained after root termination"
  }
  $remainingPortOwners = New-Object System.Collections.ArrayList
  foreach ($port in $RequiredPorts) {
    foreach ($ownerPid in @(Get-PortOwners -Port $port)) {
      $ownerProcess = $remainingSnapshot | Where-Object { $_.ProcessId -eq $ownerPid } | Select-Object -First 1
      [void]$remainingPortOwners.Add("Port=$port PID=$ownerPid")
      Write-Host "Remaining port owner Port=$port PID=$ownerPid CommandLine=$($ownerProcess.CommandLine)"
      if (Test-RepositoryOwnedProcess -Process $ownerProcess -KnownOwnedIds $knownOwnedIds) {
        $portDescendantPids = @(Get-DescendantProcessIds -RootPid $ownerPid -Snapshot $remainingSnapshot)
        $knownOwnedIds[[string]$ownerPid] = $true
        foreach ($descendantPid in $portDescendantPids) { $knownOwnedIds[[string]$descendantPid] = $true }
        $portDescendantText = if ($portDescendantPids.Count -gt 0) { $portDescendantPids -join "," } else { "none" }
        Write-Host "Repository-owned port tree RootPID=$ownerPid DescendantPIDs=$portDescendantText"
        Invoke-PlatformTreeKill -RootPid $ownerPid -Reason "repository-owned listener on port $port"
      }
    }
  }
  if ($remainingOwned.Count -eq 0 -and $remainingPortOwners.Count -eq 0) { break }
  if ((Get-Date) -lt $deadline) { Start-Sleep -Seconds 2 }
} while ((Get-Date) -lt $deadline)

$finalSnapshot = Get-ProcessSnapshot
$finalOwned = @($finalSnapshot | Where-Object { $knownOwnedIds.ContainsKey([string]$_.ProcessId) })
$failureReasons = New-Object System.Collections.ArrayList
if ($finalOwned.Count -gt 0) {
  $remainingIds = @($finalOwned | ForEach-Object { $_.ProcessId }) -join ","
  [void]$failureReasons.Add("platform-owned descendant processes remain: $remainingIds")
}
foreach ($port in $RequiredPorts) {
  $owners = @(Get-PortOwners -Port $port)
  if ($owners.Count -gt 0) {
    [void]$failureReasons.Add("port $port remains listening; owner PIDs: $($owners -join ',')")
  }
}
if ($failureReasons.Count -gt 0) {
  foreach ($reason in $failureReasons) { Write-Host "FAIL $reason" }
  throw "Platform shutdown could not complete: $($failureReasons -join '; ')"
}

foreach ($name in $OwnedNames) {
  Remove-Item (Join-Path $LogRoot "$name.pid") -Force -ErrorAction SilentlyContinue
}
$global:LASTEXITCODE = 0
Write-Host "PASS platform process trees stopped and ports 4173/5000 released"
