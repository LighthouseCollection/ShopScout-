# archived/

Files that are not part of the shipped extension and are not referenced by any
HTML, manifest, or build script — kept around as history but not loaded.

| File | Reason |
|---|---|
| `dev-log.js` | Self-described "NOT part of the consumer extension" developer-only logging helper. Not referenced by any HTML or by `scripts/build-extension.ps1`. |

If you ever want to re-enable one, move it back to the project root and add a
`<script src="...">` reference plus an entry in `scripts/build-extension.ps1`.
