# Trading Analysis Platform

## Work Order INFRA-001

### Production Infrastructure Audit and Implementation Plan

---

## Document Information

| Item                | Value                                                           |
| ------------------- | --------------------------------------------------------------- |
| Work Order          | INFRA-001                                                       |
| Status              | Ready                                                           |
| Repository Location | `docs/work-orders/INFRA-001.md`                                 |
| Specification       | `docs/specifications/PERMANENT_INFRASTRUCTURE_SPECIFICATION.md` |
| Scope               | Audit and implementation planning only                          |

---

## 1. Mandatory Reading

Before beginning, read and follow:

1. `AGENTS.md`
2. `docs/constitution/PROJECT_CONSTITUTION.md`
3. `docs/constitution/ARCHITECTURE_OVERVIEW.md`
4. `docs/specifications/PERMANENT_INFRASTRUCTURE_SPECIFICATION.md`
5. `docs/testing/PERMANENT_INFRASTRUCTURE_TESTING.md`

---

## 2. Objective

Inspect the repository and current Windows VPS deployment assumptions, then produce the smallest accurate implementation plan for permanent autonomous runtime.

This work order does not authorize broad implementation yet.

Its purpose is to prevent Codex from guessing about existing scripts, service managers, ports, routes, environment files, or deployment behaviour.

---

## 3. Required Repository Inspection

Inspect at minimum:

- root `package.json` files
- `server/package.json`
- `client/package.json`
- server startup entry point
- frontend startup/build configuration
- existing health routes
- database connection configuration
- Python MT5 bridge entry point
- bridge environment variables
- existing deployment scripts
- existing Windows scripts
- existing PowerShell scripts
- existing backup scripts
- existing process-manager configuration
- `.gitignore`
- `.env.example` files
- documentation relevant to VPS deployment
- Git branch and working-tree state

Search before creating any new infrastructure file.

---

## 4. Required Current-State Findings

Report:

1. exact backend start command
2. exact frontend development and production commands
3. exact Python bridge command
4. backend port and bind address
5. frontend port and bind address
6. backend health endpoint, if present
7. bridge ingestion endpoint
8. required environment variables by component
9. current database connection method
10. current logging behaviour
11. current process-management behaviour
12. existing deployment behaviour
13. existing backup behaviour
14. current Tailscale-facing URLs or expected access pattern
15. missing infrastructure components
16. duplicate or conflicting infrastructure files
17. production risks
18. any mismatch between documentation and code

Do not reveal actual secret values.

---

## 5. Required Design Decision

Recommend one maintainable Windows runtime approach for:

- backend
- frontend
- Python bridge
- health monitoring

The recommendation must consider:

- automatic startup
- crash restart
- log persistence
- status inspection
- ease of maintenance
- prevention of duplicate processes
- Windows compatibility
- no commercial dependency

Do not implement the chosen manager in this work order unless a trivial documentation-only change is required.

---

## 6. Required Proposed File Plan

Provide a precise proposed list of:

- files to create
- files to modify
- purpose of each file
- commands each file will run
- services/tasks/processes that will be created
- implementation order

Do not propose duplicate scripts where an existing script can be safely extended.

---

## 7. Protected Scope

Do not modify:

- trading logic
- EMA200 logic
- supply/demand logic
- signal logic
- symbol mappings
- database schema
- broker credentials
- production secrets
- Tailscale/firewall configuration
- live execution controls

Do not install or configure software on the VPS during this work order.

---

## 8. Permitted Changes

Permitted changes are limited to:

- correcting clearly inaccurate infrastructure documentation
- adding the audit report
- adding an implementation plan document
- adding safe non-secret configuration inventory documentation

Source-code or runtime changes require the next approved work order.

---

## 9. Required Output

Return:

1. current-state audit
2. identified blockers
3. recommended runtime approach
4. exact proposed changed-file list
5. staged implementation sequence
6. risks and rollback considerations
7. one consolidated verification checklist for the audit findings

Do not begin INFRA-002 automatically.

---

## 10. Completion Condition

INFRA-001 is complete when the project owner can see exactly:

- what currently exists
- what is missing
- what Codex proposes to change
- why each change is needed
- how the implementation will be divided safely

---

**End of Work Order INFRA-001**
