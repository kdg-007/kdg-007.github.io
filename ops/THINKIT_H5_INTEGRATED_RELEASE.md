# ThinkIt H5 integrated release — 12 November 2026

The regular connected suite now selects the hierarchical ThinkIt editor. This release extends the current owner release, including its KeepIt reconnect and note-editing fixes, rather than replacing the host with the older H5 development shell.

The editor combines H1–H5 hierarchy and layout work with the current production Mind Map topic ordering, native KeepIt notes/file references, fullscreen exit, appearance styles and project-file adapter. Existing local project IDs, recovery journals and library bindings are retained. Prior immutable editor versions remain available for already-open tabs.

Validation completed locally:

- 92 hierarchy/placement/focus/routing/metadata checks passed against the actual integrated editor assets.
- Existing app-repository transaction, calendar and TravelIt dependency unit checks passed.
- All 192 owner-release file digests and the connected host/file-sync frame registry matched.
- Browser loaded the editor through the connected suite, restored the actual 385-object Lapuz project, collapsed it to 16 stages, saved it and reopened it with the collapsed state retained.
- The regular Apps menu includes ThinkIt files; its existing OneDrive connection prompt remains active. No real owner cloud account was used for acceptance and no cloud-data migration was performed.

The deployer overlays the full verified owner-release inventory after restoring the old compiled archive. This prevents an older archived connected entry from undoing this integration on the next deployment.

Rollback consists of returning the connected host and frame registry to the preceding owner release; immutable old assets and all stored project data remain present.
