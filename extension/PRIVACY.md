# Re:Mark – Privacy Policy

_Last updated: 2026-05-25_
This policy describes how the Re:Mark browser extension handles data. The extension is designed to keep your data private and under your control.

## What the extension accesses
- **Bookmarks content and structure**: Read and rebuild your bookmark tree to support upload, download/restore, clear, auto-sync, and AI enrich flows.
- **Local settings and credentials**: GitHub Token, optional Gist ID, AI API URL, AI API Key, AI model, optional Jina API Key, smart enrichment toggle, auto-sync toggle/delay, and local/remote bookmark counts.

## Where data is stored
- **Locally only**: Settings and credentials are stored in `browser.storage.local`. They are not sent to the developer.
- **Your own GitHub Gist**: Bookmarks are uploaded/downloaded only when you trigger sync (or auto-sync if enabled) using your GitHub Token to your private Gist `bookmarks.json`.
- **Your AI provider**: If you configure an AI API Key, the extension sends bookmark titles and URLs to your configured AI endpoint to generate concise titles.
- **Jina Reader**: If you configure a Jina API Key and enable Smart Enrich, the extension sends bookmark URLs to Jina Reader with your API Key to fetch page content for enrichment.

## How data is used
- **Sync**: Upload/download bookmarks between your browser and your Gist; preserves AI metadata if present.
- **Notifications**: Inform you when sync/clear/enrich starts, completes, or errors.
- **Title Cleanup (optional)**: Sends bookmark title and URL to your configured AI endpoint and writes concise titles back to browser bookmarks.
- **Smart Enrich (optional)**: Uses authenticated Jina Reader content plus your configured AI endpoint to generate title, summary, tags, and cover metadata.

## Data sharing and third parties
- The extension does **not** send data to the developer or any analytics/ads service.
- Data goes only to:
  - GitHub APIs for your Gist (with your token).
  - Your configured AI endpoint when title cleanup or smart enrichment is used.
  - Jina Reader when Smart Enrich is enabled.

## Permissions and necessity
- **bookmarks**: Needed to read and rebuild the bookmark tree for backup/restore/clear/auto-sync.
- **storage**: Needed to save your settings, credentials, and counts locally.
- **notifications**: Needed to show status of sync/clear/enrich actions.
- **Host permissions**: `https://api.github.com/*`, `https://gist.githubusercontent.com/*`, and `https://raw.githubusercontent.com/*` are required for Gist sync. Optional secure site access (`https://*/*`) is requested during a user action for the configured AI endpoint and, when Smart Enrich is enabled, Jina Reader. Local development builds may also allow `http://localhost:*/*`.

## Your choices and controls
- You choose whether to provide a GitHub Token/Gist ID, AI API Key, Jina API Key, and whether to enable Smart Enrich.
- You can disable auto-sync, clear bookmarks, or remove the extension at any time.
- Revoking the GitHub Token or deleting the Gist stops future sync. Removing the extension deletes its local storage.

## Security practices
- Tokens and secrets stay in `storage.local`.
- Jina Free is not used; Smart Enrich requires your Jina API Key.
- The extension does not load remote executable code.

## Changes to this policy
Updates will be published in this file. Continued use after changes constitutes acceptance.

## Contact
For privacy questions, please open an issue in the project repository.
