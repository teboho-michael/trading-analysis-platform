const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const backupScriptPath = path.join(
  __dirname,
  "..",
  "..",
  "deployment",
  "windows-vps",
  "backup-platform.ps1",
);

test("Windows backup script uses explicit database credentials safely", () => {
  const script = fs.readFileSync(backupScriptPath, "utf8");

  for (const name of ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"]) {
    assert.match(script, new RegExp(`Assert-ConfigValue -Name "${name}"`));
  }

  assert.match(script, /pg_dump[\s\S]*--host \$dbHost[\s\S]*--port \$dbPort[\s\S]*--username \$dbUser[\s\S]*--dbname \$DatabaseName[\s\S]*--file \$dumpFile/);
  assert.doesNotMatch(script, /pg_dump[\s\S]*--password/i);
  assert.doesNotMatch(script, /pg_dump[\s\S]*\$dbPassword/);
  assert.match(script, /\$env:PGPASSWORD = \$dbPassword/);
});

test("Windows backup script restores PGPASSWORD and cleans failed targets", () => {
  const script = fs.readFileSync(backupScriptPath, "utf8");

  assert.match(script, /\$previousPgPassword = \[Environment\]::GetEnvironmentVariable\("PGPASSWORD", "Process"\)/);
  assert.match(script, /Remove-Item Env:\\PGPASSWORD -ErrorAction SilentlyContinue/);
  assert.match(script, /\$env:PGPASSWORD = \$previousPgPassword/);
  assert.match(script, /\$targetCreated = \$true/);
  assert.match(script, /Remove-Item -Path \$target -Recurse -Force/);
});
