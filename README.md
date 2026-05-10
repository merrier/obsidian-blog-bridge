# Obsidian Hexo Bridge

Export the active Obsidian note into a local Hexo blog repository, process local images, and commit only the files produced by the export.

## Features

- Export the current Markdown note to a Hexo post or draft.
- Preserve existing Hexo frontmatter and fill missing `title` and `date`.
- Prefer `urlname` for the output filename, then fall back to a slugified title.
- Copy local images into the Hexo repository or upload them through a PicGo-compatible command.
- Write `hexoBridge` metadata back to the source note after a successful export.
- Commit only the generated Hexo article and image files.
- Optionally commit only the source note metadata update in the vault repository.

## Default Settings

- Hexo root: `/Users/merrier/repos/merrier.github.io`
- Posts directory: `source/_posts`
- Drafts directory: `source/_drafts`
- Image mode: `local`
- Local image directory: `source/images/obsidian`
- Image name template: `<slug>/<index>-<hash>.<ext>`
- PicGo command: `picgo upload`
- Hexo commit message: `chore(hexo): export <title>`

## Commands

- `Export current note to Hexo post`
- `Export current note to Hexo draft`
- `Open Hexo Bridge settings`

## Image Handling

Local image references are resolved relative to the current note, the vault root, and the vault `assets/` directory. In local mode, images are copied to the configured Hexo image directory and Markdown links are rewritten to public Hexo paths.

PicGo mode appends the image path to the configured command. If you need a custom command shape, use `<path>` as a placeholder.

## Development

```bash
npm install
npm run build
```

The build produces `main.js`, which Obsidian loads from the plugin directory.

