# Hexo Bridge

Hexo Bridge is an Obsidian plugin for syncing selected notes to a GitHub-backed Hexo repository.

[Chinese documentation](README_ZH.md)

## Screenshots

![Hexo Bridge status view](assets/status-view.svg)

![Hexo Bridge settings](assets/settings.svg)

## Features

- Sync the current Markdown note to the Hexo posts directory.
- Create one GitHub commit for the generated Markdown and local images.
- Choose between direct commits to the target branch or Pull Request / MR sync from a custom branch.
- Preserve existing Hexo frontmatter and fill missing `title` and `date`.
- Prefer frontmatter `urlname` for the output file name, then fall back to a slugified title.
- Open a sync status page from the ribbon icon, with title, tag, and status filters.
- Mark notes as `Modified` when they changed locally after the last successful sync.
- Follow the current Obsidian app language for Chinese and English UI text.
- Store tokens through Obsidian SecretStorage; plugin data only stores the secret name.

## Installation

For a release install, copy these files into your vault plugin directory:

```text
.obsidian/plugins/obsidian-hexo-bridge/
  manifest.json
  main.js
  styles.css
```

For a source install:

```bash
cd .obsidian/plugins
git clone https://github.com/merrier/obsidian-hexo-bridge.git
cd obsidian-hexo-bridge
npm install
npm run build
```

Reload Obsidian plugins, then enable `Hexo Bridge`.

## Settings

Configure the plugin from the settings tab:

- `GitHub owner`: user or organization that owns the Hexo repository.
- `GitHub repository`: repository name without the owner.
- `GitHub branch`: target branch, defaults to `main`. The branch must already exist.
- `Sync mode`: choose `Direct commit` or `Pull Request / MR`.
- `MR branch`: branch used for Pull Request / MR sync, defaults to `hexo-bridge/sync`. It must differ from the target branch.
- `GitHub token`: select an Obsidian SecretStorage entry. The plugin currently accepts tokens that start with `ghp_`.
- `Sync source directory`: vault folder shown in the status page.
- `Hexo note template`: optional Markdown template for new notes.
- `Apply template to new notes`: off by default. When enabled, new empty Markdown files in the sync source directory receive the selected template content.
- `Posts directory`: Hexo posts path in the GitHub repository, defaults to `source/_posts`.
- `Local image directory`: image path in the GitHub repository, defaults to `source/images/obsidian`.
- `Image name template`: defaults to `{{slug}}/{{filename}}`.
- `Git commit message template`: defaults to `chore(hexo): export {{title}}`.

## Token Permissions

Use a GitHub classic personal access token because Hexo Bridge validates the `ghp_` prefix.

- Direct commit mode needs content read/write access to the target repository.
- Pull Request / MR mode also needs permission to create and update pull requests.
- The token value is stored by Obsidian SecretStorage. Hexo Bridge only stores the selected secret name in `data.json`.

## Usage

- Click the ribbon icon to open the Hexo Bridge status page.
- Filter notes from the status page and click `Sync` on a row.
- Or run `Sync current note to Hexo post` from the command palette.
- After a successful sync, the status page records the target path, commit link, and Pull Request link.
- If a note changes locally after a successful sync, its status becomes `Modified` and it can be synced again.

## Image Handling

Hexo Bridge only supports local images. It does not depend on image hosting services.

The plugin resolves Markdown image links and Obsidian wiki image links, commits local images as blobs in the same GitHub commit, and rewrites Markdown links to Hexo public paths.

Image name template variables:

```text
{{filename}} {{slug}} {{index}} {{hash}} {{original}} {{ext}} {{date}}
```

`{{filename}}` preserves the Obsidian attachment file name.

## Template Variables

Hexo note templates support:

```text
{{title}} {{slug}} {{date}} {{datetime}}
```

Image name templates support:

```text
{{filename}} {{slug}} {{index}} {{hash}} {{original}} {{ext}} {{date}}
```

Commit message templates support:

```text
{{title}} {{slug}} {{status}}
```

## Current Limitations

- Manual sync only. There is no automatic watcher, batch sync, or scheduled sync.
- Posts only. Draft sync is not supported.
- Local images only. PicGo and other image hosting workflows are not supported.
- Token authentication only. GitHub OAuth is not supported yet.

## Development

```bash
npm install
npm run build
```

The build produces `main.js`, which Obsidian loads from the plugin directory.

## Sponsor

If Hexo Bridge saves you time maintaining your blog, you can support the author through GitHub Sponsors:

[Sponsor merrier on GitHub](https://github.com/sponsors/merrier)
