# AGENTS.md

Guidance for coding agents working on Blog Bridge.

## Project

Blog Bridge is an Obsidian desktop plugin that syncs selected Markdown notes to GitHub-backed static-site blog repositories. It supports framework presets for Hexo, Hugo, Jekyll, Astro, VitePress, and MkDocs.

The plugin is TypeScript source bundled into `main.js` for Obsidian.

## Important Paths

- `src/main.ts`: plugin lifecycle, settings loading, sync orchestration, GitHub token validation.
- `src/settings.ts`: settings tab and default settings.
- `src/status-view.ts`: status page, filters, pagination, selection, and sync controls.
- `src/frameworks.ts`: supported blog framework presets and path/public URL conventions.
- `src/exporter/`: Markdown/frontmatter/image processing and GitHub commit helpers.
- `src/i18n.ts`: English and Chinese UI text.
- `styles.css`: Obsidian view styles.
- `manifest.json`: Obsidian plugin metadata.
- `versions.json`: Obsidian plugin version compatibility map.
- `main.js`: generated bundle loaded by Obsidian. It is committed on purpose.

## Commands

Use these from the repository root:

```bash
npm install
npm run build
```

Run `npm run build` after any TypeScript source change. This performs type checking and regenerates `main.js`.

When changing the plugin version:

```bash
npm run version
npm run build
```

`npm run version` updates `manifest.json` and `versions.json` from `package.json`.

## Development Rules

- Keep the plugin desktop-only unless the manifest and filesystem/GitHub assumptions are deliberately redesigned.
- Keep sync manual. Do not add automatic watchers, scheduled sync, or build/deploy orchestration unless explicitly requested.
- Batch sync should stay sequential so multiple GitHub commits do not race on the same branch ref.
- Preserve Obsidian note content as Markdown; do not introduce MDX-specific transforms without a framework-specific requirement.
- Prefer framework presets and small adapter helpers over hard-coded framework checks scattered through UI code.
- Keep local image handling in `src/exporter/images.ts`; do not add image hosting dependencies.
- Keep user-facing text in `src/i18n.ts` and provide both English and Chinese strings.
- Do not commit `node_modules/` or local `data.json`.
- Avoid changing generated `main.js` by hand. Change source files and run `npm run build`.

## Git Notes

- The repository tracks release artifacts: `main.js`, `manifest.json`, and `styles.css`.
- The usual remote is `git@github.com:merrier/obsidian-blog-bridge.git`.
- Check `git status` before editing; this repo is often used inside an Obsidian vault that may have unrelated parent-repo changes.
