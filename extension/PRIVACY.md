# Re:Mark – Privacy Policy

_Last updated: 2025-12-19
This policy describes how the Re:Mark browser extension handles data. The extension is designed to keep your data private and under your control.

## What the extension accesses
- **Bookmarks content and structure**: Read and rebuild your bookmark tree to support upload, download/restore, clear, auto-sync, and AI enrich flows.
- **Local settings and credentials**: GitHub Token, optional Gist ID, optional Web URL, optional API Secret, auto-sync toggle/delay, and local/remote bookmark counts.

## Where data is stored
- **Locally only**: Settings and credentials are stored in `browser.storage.local`. They are not sent to the developer.
- **Your own GitHub Gist**: Bookmarks are uploaded/downloaded only when you trigger sync (or auto-sync if enabled) using your GitHub Token to your private Gist `bookmarks.json`.
- **Your optional Web endpoint**: If you enable Web Integration, the extension calls `https://your-web-url/api/enrich` with a signed request using your API Secret. No other sites are contacted.

## How data is used
- **Sync**: Upload/download bookmarks between your browser and your Gist; preserves AI metadata if present.
- **Notifications**: Inform you when sync/clear/enrich starts, completes, or errors.
- **AI Enrich (optional)**: Sends signed empty payloads to your configured `/api/enrich`; the remote service you host decides how to enrich bookmarks stored in Gist.

## Data sharing and third parties
- The extension does **not** send data to the developer or any analytics/ads service.
- Data goes only to:
  - GitHub APIs for your Gist (with your token).
  - Your configured Web URL (if enabled) for enrich requests.

## Permissions and necessity
- **bookmarks**: Needed to read and rebuild the bookmark tree for backup/restore/clear/auto-sync.
- **storage**: Needed to save your settings, credentials, and counts locally.
- **notifications**: Needed to show status of sync/clear/enrich actions.
- **Host permissions**: `https://api.github.com/*`, `https://gist.githubusercontent.com/*`, `https://raw.githubusercontent.com/*`, and `http://localhost:*/*` are required for Gist sync and local testing. Optional site access (`https://*/*`, `http://*/*`) is requested only for the specific Web URL you configure to call `/api/enrich`.

## Your choices and controls
- You choose whether to provide a GitHub Token/Gist ID and whether to enable Web Integration.
- You can disable auto-sync, clear bookmarks, or remove the extension at any time.
- Revoking the GitHub Token or deleting the Gist stops future sync. Removing the extension deletes its local storage.

## Security practices
- Tokens and secrets stay in `storage.local`.
- Requests to your Web URL are signed with HMAC using your API Secret.
- The extension does not load remote executable code.

## Changes to this policy
Updates will be published in this file. Continued use after changes constitutes acceptance.

## Contact
For privacy questions, please open an issue in the project repository.
