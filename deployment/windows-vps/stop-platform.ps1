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
$normalizedServerRoot = [System.IO.Path]::GetFullPath((Join-Path $RepoRoot "server")).TrimEnd($pathSeparators).Replace("/", "\")

function Get-WindowsProcessCurrentDirectory {
  param([int]$ProcessId)
  if (-not ("TradingAnalysisPlatformProcessInspector" -as [type])) {
    Add-Type -TypeDefinition @"
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

public static class TradingAnalysisPlatformProcessInspector
{
    private const uint PROCESS_QUERY_INFORMATION = 0x0400;
    private const uint PROCESS_VM_READ = 0x0010;

    [StructLayout(LayoutKind.Sequential)]
    private struct PROCESS_BASIC_INFORMATION
    {
        public IntPtr Reserved1;
        public IntPtr PebBaseAddress;
        public IntPtr Reserved2_0;
        public IntPtr Reserved2_1;
        public IntPtr UniqueProcessId;
        public IntPtr Reserved3;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr OpenProcess(uint access, bool inheritHandle, int processId);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr handle);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool ReadProcessMemory(IntPtr process, IntPtr address, byte[] buffer, int size, out IntPtr bytesRead);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool IsWow64Process(IntPtr process, out bool wow64Process);

    [DllImport("ntdll.dll")]
    private static extern int NtQueryInformationProcess(IntPtr process, int processInformationClass,
        ref PROCESS_BASIC_INFORMATION processInformation, int processInformationLength, out int returnLength);

    private static byte[] ReadBytes(IntPtr process, IntPtr address, int size)
    {
        var buffer = new byte[size];
        IntPtr bytesRead;
        if (!ReadProcessMemory(process, address, buffer, size, out bytesRead) || bytesRead.ToInt64() != size)
            throw new Win32Exception(Marshal.GetLastWin32Error(), "ReadProcessMemory failed");
        return buffer;
    }

    private static IntPtr ReadPointer(IntPtr process, IntPtr address)
    {
        var bytes = ReadBytes(process, address, IntPtr.Size);
        return IntPtr.Size == 8 ? new IntPtr(BitConverter.ToInt64(bytes, 0)) : new IntPtr(BitConverter.ToInt32(bytes, 0));
    }

    public static string GetCurrentDirectory(int processId)
    {
        var process = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, processId);
        if (process == IntPtr.Zero)
            throw new Win32Exception(Marshal.GetLastWin32Error(), "OpenProcess failed");
        try
        {
            bool targetWow64;
            bool currentWow64;
            using (var current = System.Diagnostics.Process.GetCurrentProcess())
            {
                if (!IsWow64Process(process, out targetWow64) || !IsWow64Process(current.Handle, out currentWow64))
                    throw new Win32Exception(Marshal.GetLastWin32Error(), "IsWow64Process failed");
            }
            if (targetWow64 != currentWow64)
                throw new InvalidOperationException("Cross-bitness process inspection is not supported");

            var basic = new PROCESS_BASIC_INFORMATION();
            int returnLength;
            var status = NtQueryInformationProcess(process, 0, ref basic, Marshal.SizeOf(typeof(PROCESS_BASIC_INFORMATION)), out returnLength);
            if (status != 0)
                throw new InvalidOperationException("NtQueryInformationProcess failed with NTSTATUS 0x" + status.ToString("X8"));

            var processParametersOffset = IntPtr.Size == 8 ? 0x20 : 0x10;
            var currentDirectoryOffset = IntPtr.Size == 8 ? 0x38 : 0x24;
            var unicodeBufferOffset = IntPtr.Size == 8 ? 0x08 : 0x04;
            var processParameters = ReadPointer(process, IntPtr.Add(basic.PebBaseAddress, processParametersOffset));
            if (processParameters == IntPtr.Zero)
                throw new InvalidOperationException("ProcessParameters is null");

            var unicodeString = IntPtr.Add(processParameters, currentDirectoryOffset);
            var lengthBytes = ReadBytes(process, unicodeString, 2);
            var length = BitConverter.ToUInt16(lengthBytes, 0);
            if (length == 0 || length > 32768 || (length % 2) != 0)
                throw new InvalidOperationException("Current directory length is invalid");
            var buffer = ReadPointer(process, IntPtr.Add(unicodeString, unicodeBufferOffset));
            if (buffer == IntPtr.Zero)
                throw new InvalidOperationException("Current directory buffer is null");
            return Encoding.Unicode.GetString(ReadBytes(process, buffer, length));
        }
        finally
        {
            CloseHandle(process);
        }
    }
}
"@
  }
  [TradingAnalysisPlatformProcessInspector]::GetCurrentDirectory($ProcessId)
}

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
  param($Process, [hashtable]$KnownOwnedIds, [int]$Port = 0)
  if (-not $Process) { return $false }
  if ($KnownOwnedIds.ContainsKey([string]$Process.ProcessId)) { return $true }
  $commandLine = [string]$Process.CommandLine
  if ($commandLine -like "*TradingAnalysisPlatform:*") { return $true }
  if ($commandLine.Replace("/", "\") -like "*$normalizedRepoRoot*") { return $true }
  if ($Port -eq 5000 -and $Process.Name -eq "node.exe" -and $commandLine -match '(?i)(^|[\\/"\s])node(?:\.exe)?"?\s+"?app\.js"?(?:\s|$)') {
    try {
      $workingDirectory = Get-WindowsProcessCurrentDirectory -ProcessId $Process.ProcessId
      $normalizedWorkingDirectory = [System.IO.Path]::GetFullPath($workingDirectory).TrimEnd($pathSeparators).Replace("/", "\")
      if ([System.StringComparer]::OrdinalIgnoreCase.Equals($normalizedWorkingDirectory, $normalizedServerRoot)) {
        Write-Host "Legacy backend ownership confirmed Port=5000 PID=$($Process.ProcessId) WorkingDirectory=$workingDirectory"
        return $true
      }
      Write-Host "Legacy backend ownership rejected Port=5000 PID=$($Process.ProcessId) WorkingDirectory=$workingDirectory Expected=$normalizedServerRoot"
    } catch {
      Write-Host "Legacy backend ownership could not be established Port=5000 PID=$($Process.ProcessId) Reason=$($_.Exception.Message)"
    }
  }
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
      if (Test-RepositoryOwnedProcess -Process $ownerProcess -KnownOwnedIds $knownOwnedIds -Port $port) {
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
