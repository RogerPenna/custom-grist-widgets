# Custom rules for this project

## Headless Widgets & TableLens
- All widgets have a standard "Grist" mode and a "Headless" mode.
- Headless modes are a BACKUP for a version of the system that will use Grist ONLY as a database, without Grist's UI/Frontend.
- `HeadlessTableLens` is used in headless mode, while `GristTableLens` is used in standard Grist mode.
- `TableRenderer` and other shared libraries are used by both standard and headless lens types. Always ensure any custom lens methods (such as `getRowRules`) have fallback checks (e.g. `typeof tableLens.method === 'function'`) to prevent crashes in headless/backup environments.
