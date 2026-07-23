const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.join(__dirname, "..", "..");
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), "utf8");

test("MT5 continuous bridge runtime files stay outside the Git working tree by default", () => {
  const bridge = read("tools", "mt5_bridge", "mt5_candle_bridge.py");
  const gitignore = read(".gitignore");
  const taskRegistration = read("deployment", "windows-vps", "register-scheduled-tasks.ps1");
  const healthCheck = read("deployment", "windows-vps", "health-check.ps1");

  assert.match(bridge, /def default_runtime_dir\(\)/);
  assert.match(bridge, /C:\\ProgramData/);
  assert.match(bridge, /TradingAnalysisPlatform.+runtime/);
  assert.match(bridge, /TRADING_ANALYSIS_RUNTIME_DIR/);
  assert.doesNotMatch(bridge, /CONTINUOUS_LOCK_FILE = BASE_DIR \/ "mt5_continuous_bridge\.lock"/);
  assert.match(gitignore, /mt5_continuous_bridge\.lock\*/);
  assert.match(taskRegistration, /\$env:TRADING_ANALYSIS_RUNTIME_DIR = '\$RuntimeRoot'/);
  assert.match(healthCheck, /\$RuntimeRoot = "C:\\ProgramData\\TradingAnalysisPlatform\\runtime"/);
  assert.doesNotMatch(healthCheck, /tools\\mt5_bridge\\mt5_bridge_state\.json/);
});

test("deployment removes only approved legacy runtime lock drift and still fails real drift", () => {
  const deploy = read("deployment", "windows-vps", "deploy-production.ps1");

  assert.match(deploy, /function Remove-ApprovedRuntimeDrift/);
  assert.match(deploy, /tools\/mt5_bridge\/mt5_continuous_bridge\.lock/);
  assert.match(deploy, /Remove-Item -Path \$fullPath -Force/);
  assert.match(deploy, /\$drift = & git status --porcelain --untracked-files=normal/);
  assert.match(deploy, /throw "Local repository drift detected/);

  const cleanupIndex = deploy.indexOf("Remove-ApprovedRuntimeDrift -RepoRoot $RepoRoot");
  const driftIndex = deploy.indexOf("$drift = & git status --porcelain --untracked-files=normal", cleanupIndex);
  const throwIndex = deploy.indexOf('throw "Local repository drift detected', driftIndex);
  assert.ok(cleanupIndex > -1);
  assert.ok(driftIndex > cleanupIndex);
  assert.ok(throwIndex > driftIndex);
});

test("scheduled tasks are restartable, noninteractive, explicit, and duplicate-safe", () => {
  const taskRegistration = read("deployment", "windows-vps", "register-scheduled-tasks.ps1");
  const startPlatform = read("deployment", "windows-vps", "start-platform.ps1");

  assert.match(taskRegistration, /New-ScheduledTaskTrigger -AtStartup/);
  assert.match(taskRegistration, /New-ScheduledTaskTrigger -AtLogOn/);
  assert.match(taskRegistration, /RestartCount 999/);
  assert.match(taskRegistration, /RestartInterval \(New-TimeSpan -Minutes 1\)/);
  assert.match(taskRegistration, /MultipleInstances IgnoreNew/);
  assert.match(taskRegistration, /-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass/);
  assert.match(taskRegistration, /Set-Location '\$RepoRoot\\server'/);
  assert.match(taskRegistration, /Set-Location '\$RepoRoot'/);
  assert.match(taskRegistration, /validate-production-config\.ps1/);
  assert.doesNotMatch(taskRegistration, /DB_PASSWORD|MT5_BRIDGE_SECRET=|replace-with-shared-bridge-secret/);

  assert.match(startPlatform, /Duplicate continuous MT5 bridge Python processes detected/);
  assert.match(startPlatform, /TradingAnalysisPlatform-MT5ContinuousBridge/);
});

test("autonomous verification covers runtime ownership and console independence", () => {
  const verify = read("deployment", "windows-vps", "verify-autonomous-runtime.ps1");

  for (const check of [
    "backend-health",
    "frontend-http",
    "postgres-service",
    "mt5-process",
    "bridge-process-count",
    "latest-backup",
    "tailscale-service",
    "git-commit",
    "git-drift",
    "legacy-runtime-lock",
  ]) {
    assert.match(verify, new RegExp(check));
  }

  assert.match(verify, /TradingAnalysisPlatform-Backend/);
  assert.match(verify, /TradingAnalysisPlatform-MT5ContinuousBridge/);
  assert.match(verify, /TradingAnalysisPlatform-HealthCheck/);
  assert.match(verify, /TradingAnalysisPlatform-DailyBackup/);
  assert.match(verify, /-NonInteractive/);
  assert.match(verify, /RestartCount/);
  assert.doesNotMatch(verify, /MT5_BRIDGE_SECRET=|replace-with-shared-bridge-secret/);
});

test("Windows infrastructure scripts do not enable live automated trading execution", () => {
  const deploymentDir = path.join(repoRoot, "deployment", "windows-vps");
  const scriptText = fs
    .readdirSync(deploymentDir)
    .filter((name) => name.endsWith(".ps1"))
    .map((name) => fs.readFileSync(path.join(deploymentDir, name), "utf8"))
    .join("\n");

  assert.doesNotMatch(scriptText, /order_send|live execution|automated trading|place order|trade execution/i);
});
