# Trading Analysis Platform — Codex Instructions

## Mandatory project context

Before inspecting, planning, modifying, testing or creating any code, read:

1. `docs/constitution/PROJECT_CONSTITUTION.md`
2. The specification relevant to the assigned subsystem.
3. Any work-order document named in the current task.

The Project Constitution is the highest internal authority for this repository.

No implementation, refactor, dependency, architecture change or workaround may contradict the Constitution.

If a task conflicts with the Constitution:

1. Stop implementation.
2. Identify the conflicting requirement.
3. Explain the conflict clearly.
4. Wait for explicit project-owner approval.

Do not silently override, reinterpret or bypass constitutional rules.

## Project direction

- The platform is private and is not intended for sale.
- MT5 broker data is the exclusive source of production and research market data.
- Twelve Data or other providers must never be mixed with MT5 research evidence.
- Linux is the development environment.
- Windows VPS is the permanent production environment.
- Reliability and infrastructure integrity take priority over feature expansion.
- The platform must remain modular, observable, testable and recoverable.

## Scope control

For every task:

- Implement only the requested scope.
- Inspect existing code before modifying it.
- Do not refactor unrelated code.
- Do not redesign working architecture unless explicitly instructed.
- Do not create duplicate services, routes, models or configuration systems.
- Prefer extending existing components over replacing them.
- Preserve existing production behaviour unless the task explicitly changes it.
- Protect credentials, `.env` files, secrets and production data.
- Do not introduce mock, proxy or synthetic market data into production paths.

## Documentation hierarchy

Apply project documents in this order:

1. `docs/constitution/PROJECT_CONSTITUTION.md`
2. Relevant subsystem specification
3. Approved architecture decision records
4. Current work order
5. Existing implementation documentation
6. Source code and tests

A lower-level document may add detail but may not override a higher-level document.

## Required implementation process

Before changing code:

1. Read the mandatory documents.
2. Inspect the relevant implementation.
3. Identify affected files.
4. Confirm that the proposed change conforms to the Constitution and specification.
5. Implement the smallest complete solution.

After changing code:

1. List every changed or created file.
2. Explain the purpose of every change.
3. Report migrations or configuration changes.
4. Report risks, assumptions and unresolved blockers.
5. Provide one consolidated testing checklist.

## Testing requirements

Do not provide testing one step at a time.

Provide one complete checklist containing:

- commands to run
- API requests
- database checks
- service-status checks
- logs to inspect
- screenshots required
- dashboard evidence required
- expected results

Wait for the complete test evidence before diagnosing failures or proposing another implementation step.

## Production protection

Do not:

- delete production data
- reset the production database
- change production secrets
- alter MT5 symbol mappings
- modify deployment services
- change firewall, Tailscale or VPS configuration
- introduce automated trading execution

unless the current task explicitly authorises that action.

## Stop conditions

Stop and report instead of guessing when:

- requirements conflict
- a protected component must be changed outside scope
- credentials are unavailable
- database migration consequences are unclear
- production behaviour cannot be verified
- the specification does not define a required decision
- the requested change could cause data loss or service interruption
