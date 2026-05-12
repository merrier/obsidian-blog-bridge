<p align="center">
  <img src="assets/readme-header.svg" alt="Blog Bridge" width="100%">
</p>

# Blog Bridge

Blog Bridge 是一个 Obsidian 插件，用来把指定笔记手动同步到基于 GitHub 仓库的 Markdown 静态博客。

[English documentation](README.md)

## 截图

![Blog Bridge 状态页](assets/status-view.svg)

![Blog Bridge 设置页](assets/settings.svg)

## 支持的框架

Blog Bridge 聚焦“文件型 Markdown 静态站”：

| 框架 | 默认文章目录 | 默认图片目录 |
| --- | --- | --- |
| Hexo | `source/_posts` | `source/images/obsidian` |
| Hugo | `content/posts` | `static/images/obsidian` |
| Jekyll | `_posts` | `assets/images/obsidian` |
| Astro | `src/content/blog` | `public/images/obsidian` |
| VitePress | `docs/posts` | `docs/public/images/obsidian` |
| MkDocs | `docs/blog/posts` | `docs/assets/images/obsidian` |

这些路径都可以在设置里改，预设只是降低首次配置成本。

## 功能亮点

- 将当前 Markdown 笔记同步到 GitHub 仓库。
- 根据目标框架预设处理文章路径、图片 URL 和 frontmatter 约定。
- 使用 GitHub REST API 创建一次 commit，同时提交文章和本地图片。
- 支持两种同步方式：直接提交到目标分支，或提交到自定义 MR 分支并创建 Pull Request / MR。
- 保留已有 frontmatter，并自动补齐缺失的 `title` 和 `date`。
- 输出文件名优先使用 frontmatter 中的 `slug` 或 `urlname`，没有时使用标题生成 slug。
- 自动使用 Jekyll 的日期文章文件名规则。
- Ribbon 图标打开同步状态页，可按标题、标签、同步状态筛选，支持每页条数选择和批量同步。
- 已同步后如果本地笔记再次修改，状态页会显示“有修改”。
- 跟随 Obsidian 当前语言显示中文或英文界面。
- Token 使用 Obsidian SecretStorage 保存，插件数据中只保存 secret 名称，不保存 token 明文。

## 安装

推荐直接从 Obsidian 第三方插件市场安装：

1. 打开 Obsidian `设置`。
2. 进入 `第三方插件`，按需关闭 `安全模式`。
3. 点击 `浏览`，搜索 `Blog Bridge`，然后安装并启用。

如果你要从源码本地开发：

```bash
cd .obsidian/plugins
git clone https://github.com/merrier/obsidian-blog-bridge.git
cd obsidian-blog-bridge
npm install
npm run build
```

## 配置

在插件设置页中配置：

- `博客框架`: 目标 Markdown 静态站框架。
- `GitHub 所有者`: 博客仓库所属的用户或组织。
- `GitHub 仓库`: 不包含 owner 的仓库名。
- `GitHub 分支`: 目标分支，默认 `main`，需要已存在。
- `同步方式`: 选择 `直接提交` 或 `Pull Request / MR`。
- `MR 分支`: Pull Request / MR 模式使用的分支，默认 `blog-bridge/sync`，不能和目标分支相同。
- `GitHub token`: 选择一个 Obsidian SecretStorage 条目。当前只接受以 `ghp_` 开头的 token。
- `同步来源目录`: 状态页展示和同步的 Vault 目录。
- `博客笔记模板`: 可选，新建空笔记时使用的 Markdown 模板。
- `为新笔记套用模板`: 默认关闭。开启后，在同步来源目录中新建空 Markdown 文件时会自动复制模板内容。
- `文章目录`: GitHub 仓库中的文章路径。
- `本地图片目录`: GitHub 仓库中的图片路径。
- `图片命名模板`: 默认 `{{slug}}/{{filename}}`。
- `Git commit 消息模板`: 默认 `chore(blog): sync {{title}}`。

## Token 权限

建议使用 GitHub classic personal access token，因为插件会校验 token 以 `ghp_` 开头。

- 直接提交模式需要对目标仓库有内容读写权限。
- Pull Request / MR 模式还需要创建和更新 Pull Request 的权限。
- Token 明文由 Obsidian SecretStorage 保存，插件的 `data.json` 只保存 secret 名称。

## 使用方式

- 点击左侧 Ribbon 图标打开 Blog Bridge 状态页。
- 在状态页中筛选笔记，点击某一行的 `同步` 按钮；也可以多选后点击 `同步已选`。
- 或使用命令面板执行 `同步当前笔记到博客`。
- 同步成功后，状态页会记录目标路径、commit 链接和 Pull Request 链接。
- 如果同步成功后本地笔记又被修改，状态会变为“有修改”，可以再次同步。

## 图片处理

Blog Bridge 只处理本地图片，不依赖图床。

插件会解析 Markdown 图片链接和 Obsidian wiki 图片链接，将本地图片作为同一个 GitHub commit 中的 blob 提交，并根据所选框架把 Markdown 中的图片链接改写为站点公开路径。

图片命名模板支持：

```text
{{filename}} {{slug}} {{index}} {{hash}} {{original}} {{ext}} {{date}}
```

其中 `{{filename}}` 会保留 Obsidian 中的附件文件名。

## 模板变量

博客笔记模板支持：

```text
{{title}} {{slug}} {{date}} {{datetime}}
```

图片命名模板支持：

```text
{{filename}} {{slug}} {{index}} {{hash}} {{original}} {{ext}} {{date}}
```

commit 消息模板支持：

```text
{{title}} {{slug}} {{status}}
```

## 当前限制

- 只支持手动同步，不做自动监听、自动批量同步或定时同步。
- 只支持本地图片，不支持 PicGo 或其它图床。
- 第一版只支持 token，不支持 GitHub OAuth 登录。
- 暂未处理 MDX 特有语法转换，Markdown 会按 Markdown 同步。

## 开发

```bash
npm install
npm run build
```

构建后会生成 Obsidian 实际加载的 `main.js`。

## 赞助

如果 Blog Bridge 帮你节省了维护博客的时间，欢迎通过 GitHub Sponsors 支持作者：

[在 GitHub Sponsors 上赞助 merrier](https://github.com/sponsors/merrier)
