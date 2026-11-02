# FTU Hybrid UI v1 — Frontend-only overlay

**Target:** `Lloyd-29/ftu-dashboard`, baseline `m4-ok` (`6390205`).
**Branch to create locally:** `feature/hybrid-ftu-ui`. **Do not merge to main before demo.**

This package applies the approved Hybrid FTU visual direction to the authenticated Engineering Workbench. It is a visual/UX increment, **not a new milestone** and not a backend change.

## Delivered behavior

- FTU original user-supplied full artwork (`frontend/public/ftu-hybrid-logo.png`) displayed as a single, undistorted image in a permanent dark top header and on login screen.
- Sidebar expanded 256px / collapsed 72px, with SVG icons, labels, active location, keyboard focus and remembered toggle. On small screens, a Menu button opens navigation.
- Dark charcoal shell + warm-white working area + restrained FTU red/brass tokens. No global TV token changes.
- Proyek opens in view mode. `Edit proyek` enables the existing form; `Batal` reloads unmodified server data; `Simpan perubahan` keeps the existing API/versioning logic.
- Tugas is table-first; creation form opens in a right-side modal drawer and retains all required fields and availability rules.
- Dokumen is register-first; new upload, revision upload, and document type management open in separate right-side drawers. Review, PDF download, revision deletion, and pending indicator retain existing API routes.
- Existing Verifikasi, Riwayat, and Akun functionality is untouched but uses shared visual treatment.
- TV viewer `App.tsx`, `App.css`, TV tokens, and four slides are not modified. When management chooses Dashboard, the existing fullscreen slide view opens with a `Kembali ke sistem` control outside the slides.

## Full-file source manifest

```text
frontend/public/ftu-hybrid-logo.png
frontend/src/engineering/EngineeringRoot.tsx
frontend/src/engineering/ProjectWorkspace.tsx
frontend/src/engineering/TaskWorkspace.tsx
frontend/src/engineering/DocumentWorkspace.tsx
frontend/src/engineering/WorkspaceDrawer.tsx
frontend/src/engineering/ftu-hybrid-tokens.css
frontend/src/engineering/hybrid-workbench.css
```

All changed TSX files are **full replacements**, not snippets. Two unique documents under `docs/` are also included. Existing backend, `.env`, Docker files, database, PDF volumes, and TV CSS are excluded.

## Installing safely (Windows PowerShell)

Do not install over the verified branch. From `C:\Projects\ftu-dashboard`:

```powershell
$ErrorActionPreference = 'Stop'
cd C:\Projects\ftu-dashboard

if ((git branch --show-current).Trim() -ne 'feature/engineering-system') { throw 'STOP: wrong base branch' }
if ((git rev-parse HEAD).Trim() -ne (git rev-parse 'm4-ok^{commit}').Trim()) { throw 'STOP: HEAD differs from m4-ok' }

# Check changes before switching; do not overwrite personal/uncommitted files.
$protected = @('compose.yaml','backend/AGENTS.md','backend/CLAUDE.md')
$unexpected = @(git status --porcelain --untracked-files=all | Where-Object {
    $_.Substring(3).Trim('"') -notin $protected
})
if ($unexpected.Count -gt 0) {
    $unexpected
    throw 'STOP: unexpected local changes — inspect before overlay'
}
git status --short

git switch -c feature/hybrid-ftu-ui

# Place ftu-hybrid-ui-v1.zip in Downloads first.
Expand-Archive -Path "$HOME\Downloads\ftu-hybrid-ui-v1.zip" -DestinationPath . -Force

git diff --stat
git status --short
```

Do not include `compose.yaml`, `backend/AGENTS.md` or `backend/CLAUDE.md` in this overlay. If `feature/hybrid-ftu-ui` already exists, stop instead of overwriting it.

## Build and verify

```powershell
# Use an existing working Node container setup; DNS is sometimes problematic at FTU.
docker run --rm -v "${PWD}\frontend:/app" -w /app node:22-alpine sh -lc 'npm ci && npm run build'
if ($LASTEXITCODE -ne 0) { throw 'STOP: Vite build failed' }

# Nginx sometimes needs recreate to see the new frontend/dist.
docker compose up -d --force-recreate --no-deps nginx
if ($LASTEXITCODE -ne 0) { throw 'STOP: Nginx recreate failed' }

# Backend remains unchanged, but regression is still required.
docker compose exec -T -e APP_ENV=testing -e DB_CONNECTION=sqlite -e DB_DATABASE=:memory: app php artisan test
if ($LASTEXITCODE -ne 0) { throw 'STOP: PHPUnit regression failed' }

git diff --check
```

**Before staging:** verify `git status`, restrict `git add` to the eight manifest paths only, and check no `.env`, dump, upload, PDF, secrets, generated `dist`, `node_modules`, or `vendor` are staged.

## Browser acceptance (mandatory before demo)

1. Login and temporary password change still work; full original logo is displayed without duplicate typed wordmark.
2. Coordinator: dark header and responsive sidebar work; collapse remains after page navigation; navigation has no inaccessible route.
3. Coordinator: open PRJ-2417; view mode does not save; Edit/Batal restores unchanged data. Save a non-sensitive dummy change only if a rollback has been prepared.
4. Tugas: list visible first; create drawer opens, Batal closes, validation works; existing tasks and status workflow are preserved.
5. Dokumen: register visible first; upload and revision drawers open correctly; existing FTU-9101 rev A/B and private PDF still available.
6. Review and types: coordinator controls remain available, engineer cannot review, and audit/history still loads.
7. Account role: admin/coordinator see Akun, director does not, engineer sees only assigned modules; TV viewer sees fullscreen four-slide view with no sidebar.
8. All four slides, `?lite=1`, and layout on demo laptop resolution work. Check 200 health / 401 guest dashboard.

## Rollback for demo

Keep the branch and its source for later. On the office PC, after ensuring no uncommitted changes on the visual branch:

```powershell
git switch feature/engineering-system
# Rebuild frontend from verified M4 sources.
docker run --rm -v "${PWD}\frontend:/app" -w /app node:22-alpine sh -lc 'npm ci && npm run build'
docker compose up -d --force-recreate --no-deps nginx
```

Do not run `migrate:fresh`, reseed, delete named volumes, or reset MySQL. This package does not touch data.

## Validation status when delivered

The package was checked via TypeScript TSX syntax transpilation, CSS parsing, ZIP integrity and scope invariants. **Full `npm run build`, Laravel PHPUnit, and browser testing on the actual FTU PC were not executed here.** Do not assume M4 tests passing before this patch means this new UI is verified.
