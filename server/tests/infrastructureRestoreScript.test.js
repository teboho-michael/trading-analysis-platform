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
  assert.match(script, /Restore is blocked until -ConfirmRestore is provided/);
  assert.match(script, /\$DatabaseName -eq \$productionDatabaseName -and -not \$AllowProductionTarget/);
  assert.match(script, /Use a separate test database for restore verification/);
});

test("Windows restore script does not put the database password in command arguments", () => {
  const script = fs.readFileSync(restoreScriptPath, "utf8");

  for (const name of ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"]) {
    assert.match(script, new RegExp(`Assert-ConfigValue -Name "${name}"`));
  }

  assert.match(script, /pg_restore[\s\S]*--host \$dbHost[\s\S]*--port \$dbPort[\s\S]*--username \$dbUser[\s\S]*--dbname \$DatabaseName[\s\S]*\$BackupFile/);
  assert.doesNotMatch(script, /pg_restore[\s\S]*--password/i);
  assert.doesNotMatch(script, /pg_restore[\s\S]*\$dbPassword/);
  assert.match(script, /\$env:PGPASSWORD = \$dbPassword/);
  assert.match(script, /Remove-Item Env:\\PGPASSWORD -ErrorAction SilentlyContinue/);
  assert.match(script, /\$env:PGPASSWORD = \$previousPgPassword/);
});
