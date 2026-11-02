# UI acceptance — FTU Hybrid v1

## Non-negotiable acceptance

- No change to Laravel routes, API requests, backend policy, migrations, seeded data, or internal document volume.
- Full FTU artwork comes from the attached image; do not redraw or separate the three-line wordmark.
- Desktop navigation: top header 104px; sidebar 256/72px; warm-white workbench.
- Viewer remains full-screen TV without management shell. Management dashboard uses existing slides; return action is outside the TV slide content.
- Project detail starts read-only. Edit toggles fieldset, Cancel discards local edits by reloading authoritative project.
- Task creation and both document upload forms appear only on explicit actions. No nested drawers; native modal accessibility and Escape support.
- Unsaved edits: drawer close asks before discarding. Saving keeps existing status/access paths.
- No tabular data made-up by UI; all records originate from original APIs.
- `/proyek`, `/tugas`, `/verifikasi`, `/dokumen`, `/riwayat`, `/akun` accessible only under original role conditions.
- Source baseline and rollback: `m4-ok`, no main merge.

## Scope exclusions

- Rearranging TV slides or touching TV CSS tokens.
- Backend and security-policy changes.
- Database/demo refresh, user account changes, LAN access setup.
- New frontend dependencies.
- Production deployment claims prior to full test on actual PC.
