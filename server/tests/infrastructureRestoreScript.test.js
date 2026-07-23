const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const restoreScriptPath = path.join(
  __dirname,
  "..",
  "..",
  "deployment",
  "windows-vps",
  "restore-platform.ps1",
);

test("Windows restore script avoids unsafe colon interpolation", () => {
  const script = fs.readFileSync(restoreScriptPath, "utf8");

  assert.doesNotMatch(script, /\$DatabaseName:/);
  assert.match(script, /Run verification queries against \{0\}:/);
});

test("Windows restore script retains production database protection", () => {
  const script = fs.readFileSync(restoreScriptPath, "utf8");

  assert.match(script, /\[switch\]\$ConfirmRestore/);
  assert.match(script, /\[switch\]\$AllowProductionTarget/);
  assert.match(script, /\[switch\]\$CreateTargetDatabase/);
  assert.match(script, /Restore is blocked until -ConfirmRestore is provided/);
  assert.match(script, /\$DatabaseName -eq \$productionDatabaseName -and -not \$AllowProductionTarget/);
  assert.match(script, /\$CreateTargetDatabase -and \$DatabaseName -eq \$productionDatabaseName/);
  assert.match(script, /Refusing to create production database/);
  assert.match(script, /Use a separate test database for restore verification/);
});

test("Windows restore script checks PostgreSQL command exit statuses", () => {
  const script = fs.readFileSync(restoreScriptPath, "utf8");

  assert.match(script, /function Assert-PostgresCommandSucceeded/);
  assert.match(script, /\$createdbExitCode = \$LASTEXITCODE/);
  assert.match(script, /Assert-PostgresCommandSucceeded -CommandName "createdb" -ExitCode \$createdbExitCode/);
  assert.match(script, /\$pgRestoreExitCode = \$LASTEXITCODE/);
  assert.match(script, /Assert-PostgresCommandSucceeded -CommandName "pg_restore" -ExitCode \$pgRestoreExitCode/);
  assert.match(script, /FAIL \$CommandName failed with exit code \$ExitCode/);

  const restoreCheckIndex = script.indexOf('Assert-PostgresCommandSucceeded -CommandName "pg_restore"');
  const passIndex = script.indexOf('Write-Host "PASS restore command completed"');
  const verificationIndex = script.indexOf("Run verification queries against {0}:");
  assert.ok(restoreCheckIndex > -1);
  assert.ok(passIndex > restoreCheckIndex);
  assert.ok(verificationIndex > restoreCheckIndex);
});

test("Windows restore script creates missing test targets only by explicit switch", () => {
  const script = fs.readFileSync(restoreScriptPath, "utf8");

  assert.match(script, /\[switch\]\$CreateTargetDatabase/);
  assert.match(script, /if \(\$CreateTargetDatabase\) \{/);
  assert.match(script, /createdb[\s\S]*--host \$dbHost[\s\S]*--port \$dbPort[\s\S]*--username \$dbUser[\s\S]*--maintenance-db \$MaintenanceDatabase[\s\S]*\$DatabaseName/);
  assert.match(script, /\$CreateTargetDatabase -and \$DatabaseName -eq \$productionDatabaseName/);
});

test("Windows restore script does not put the database password in command arguments", () => {
  const script = fs.readFileSync(restoreScriptPath, "utf8");

  for (const name of ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"]) {
    assert.match(script, new RegExp(`Assert-ConfigValue -Name "${name}"`));
  }

  assert.match(script, /createdb[\s\S]*--host \$dbHost[\s\S]*--port \$dbPort[\s\S]*--username \$dbUser[\s\S]*--maintenance-db \$MaintenanceDatabase[\s\S]*\$DatabaseName/);
  assert.match(script, /pg_restore[\s\S]*--host \$dbHost[\s\S]*--port \$dbPort[\s\S]*--username \$dbUser[\s\S]*--dbname \$DatabaseName[\s\S]*\$BackupFile/);
  assert.doesNotMatch(script, /createdb[\s\S]*--password/i);
  assert.doesNotMatch(script, /createdb[\s\S]*\$dbPassword/);
  assert.doesNotMatch(script, /pg_restore[\s\S]*--password/i);
  assert.doesNotMatch(script, /pg_restore[\s\S]*\$dbPassword/);
  assert.match(script, /\$env:PGPASSWORD = \$dbPassword/);
  assert.match(script, /Remove-Item Env:\\PGPASSWORD -ErrorAction SilentlyContinue/);
  assert.match(script, /\$env:PGPASSWORD = \$previousPgPassword/);
});
