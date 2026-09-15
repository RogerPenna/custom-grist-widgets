# Custom rules for this project

## Headless Widgets & TableLens
- All widgets have a standard "Grist" mode and a "Headless" mode.
- Headless modes are a BACKUP for a version of the system that will use Grist ONLY as a database, without Grist's UI/Frontend.
- `HeadlessTableLens` is used in headless mode, while `GristTableLens` is used in standard Grist mode.
- `TableRenderer` and other shared libraries are used by both standard and headless lens types. Always ensure any custom lens methods (such as `getRowRules`) have fallback checks (e.g. `typeof tableLens.method === 'function'`) to prevent crashes in headless/backup environments.

## Remote Server Deployment & Synchronization
- **Mandatory Requirement**: Whenever changes are committed or requested by the user, the agent MUST update/deploy the remote server (`192.168.0.95`). Do NOT assume the system runs on `localhost`.
- **Server Details**:
  - **Host IP**: `192.168.0.95`
  - **SSH User**: `homologacao`
  - **SSH Password**: `pavicon`
  - **PuTTY Tool**: `'C:\Program Files\PuTTY\plink.exe'`
  - **Remote Path**: `/home/homologacao/grist-assets/custom-grist-widgets`
  - **Remote Grist Application URL**: `http://192.168.0.95:8484`
  - **Remote Custom Widgets Assets URL**: `http://192.168.0.95:3000`
- **Deployment Execution Command**:
  ```powershell
  echo y | & 'C:\Program Files\PuTTY\plink.exe' -pw pavicon homologacao@192.168.0.95 "cd /home/homologacao/grist-assets/custom-grist-widgets && git fetch origin && git reset --hard origin/main"
  ```
- **Local Server Policy**: Do NOT launch or rely on a local dev server unless explicitly requested by the user. The primary system environment is always Grist at `http://192.168.0.95:8484` (assets on `:3000`).

