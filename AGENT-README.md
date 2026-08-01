# Re:Mark Agent Notes

## Architecture

Re:Mark has two deployable parts:

- `extension/`: WXT browser extension. It owns native bookmark sync, title cleanup, smart enrichment, settings, and GitHub Gist writes.
- `web/`: Astro web viewer. It reads Gist data and displays bookmarks. It does not execute enrichment.

Extension enrichment is extension-first:

- No AI API Key: the popup cleanup/enrichment action is hidden.
- AI API Key only: the popup shows title cleanup and writes concise titles back to browser bookmarks.
- AI API Key + Jina API Key + Smart Enrich enabled: the popup shows smart enrichment, fetches content through authenticated Jina Reader, calls the configured AI endpoint, writes concise bookmark titles locally, and stores metadata for Gist sync.
- Title cleanup and smart enrichment run in configurable parallel batches. The default concurrency is 10, bounded to 1-50, with exponential backoff for 429/rate-limit errors.
- Individual fetch timeouts must stay below 30 seconds because Chrome extension service workers can terminate when a fetch response takes longer than 30 seconds.
- Jina Free is intentionally not used.

## Key Files

- `extension/src/entrypoints/background.ts`: sync actions, local title cleanup, smart enrichment job loop, Gist updates.
- `extension/src/entrypoints/options/App.tsx`: GitHub, AI, Jina, smart enrichment, auto-sync, and theme settings.
- `extension/src/entrypoints/popup/App.tsx`: action gating and job status display.
- `extension/src/utils/enrich.ts`: AI/Jina calls and enrichment prompts.
- `extension/src/utils/enrichmentMode.ts`: popup action mode rules.
- `extension/src/utils/canonicalUrl.ts`: URL normalization for matching and repeat protection.
- `extension/src/utils/titleCleaner.ts`: generated-title normalization and safety checks.
- `web/src/pages/index.astro`: Gist-backed bookmark viewer.
- `web/src/pages/api/bookmarks.ts`: Gist JSON proxy for the viewer.

## Commands

Use Node.js 22.12 or newer within the Node 22 release line. Both applications declare `>=22.12.0 <23` because Astro 7 requires Node 22.12 and Vercel Serverless Functions use Node 22.

From `extension/`:

```bash
bun test
bunx tsc --noEmit
bun run build
```

From `web/`:

```bash
bun run build
```

## Dependency Baseline

- Web: Astro 7 with the Vercel 11 adapter, Vercel Analytics 2, and Speed Insights 2.
- Extension: WXT 0.21, React 19.2, and TypeScript 7.
- `extension/tsconfig.json` extends WXT's generated `.wxt/tsconfig.json`; run a WXT build or prepare step before standalone type checking in a fresh checkout.
- Keep `web/bun.lock` and `extension/bun.lock` separate and update dependencies from the owning application directory.

## Data And Settings

Extension settings live in `browser.storage.local`. AI and Jina credentials are user-local. Bookmark enrichment state is stored under `enrichmentRecords` and keyed by canonical URL.

`enrichmentConcurrency` controls local cleanup/enrichment parallelism. Keep retry behavior in the extension background job so the popup can stop a running task through `stopEnrich`.

`titleLanguage` only controls generated bookmark titles. Smart enrichment summaries and tags remain Chinese unless product requirements change.

Gist data remains `bookmarks.json` with version `2.5`. Extension upload preserves existing AI metadata by ID, exact URL, and canonical URL.

## Constraints

- Do not reintroduce Web `/api/enrich`; enrichment belongs in the extension.
- Do not add unauthenticated Jina fallback.
- Do not rewrite bookmark URLs during cleanup or enrichment.
- Keep browser bookmark title writes guarded by repeat protection to avoid `bookmarks.onChanged` loops.
