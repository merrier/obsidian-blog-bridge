# Hexo Bridge

Hexo Bridge 是一个 Obsidian 插件，用来把指定笔记手动同步到基于 GitHub 的 Hexo 博客仓库。

[English documentation](README.md)

## 截图

![Hexo Bridge 状态页](assets/status-view.svg)

![Hexo Bridge 设置页](assets/settings.svg)

## 功能亮点

- 将当前 Markdown 笔记同步到 Hexo 的文章目录。
- 使用 GitHub REST API 创建一次 commit，同时提交文章和本地图片。
- 支持两种同步方式：直接提交到目标分支，或提交到自定义 MR 分支并创建 Pull Request / MR。
- 保留已有 Hexo frontmatter，并自动补齐缺失的 `title` 和 `date`。
- 输出文件名优先使用 frontmatter 中的 `urlname`，没有时使用标题生成 slug。
- Ribbon 图标打开同步状态页，可按标题、标签、同步状态筛选。
- 已同步后如果本地笔记再次修改，状态页会显示“有修改”。
- 跟随 Obsidian 当前语言显示中文或英文界面。
- Token 使用 Obsidian SecretStorage 保存，插件数据中只保存 secret 名称，不保存 token 明文。

## 安装

如果你从 Release 安装，复制以下文件到 Obsidian vault 的插件目录：

```text
.obsidian/plugins/obsidian-hexo-bridge/
  manifest.json
  main.js
  styles.css
```

如果你从源码安装：

```bash
cd .obsidian/plugins
git clone https://github.com/merrier/obsidian-hexo-bridge.git
cd obsidian-hexo-bridge
npm install
npm run build
```

然后在 Obsidian 中重新加载插件，并启用 `Hexo Bridge`。

## 配置

在插件设置页中配置：

- `GitHub 所有者`: Hexo 仓库所属的用户或组织。
- `GitHub 仓库`: 不包含 owner 的仓库名。
- `GitHub 分支`: 目标分支，默认 `main`，需要已存在。
- `同步方式`: 选择 `直接提交` 或 `Pull Request / MR`。
- `MR 分支`: Pull Request / MR 模式使用的分支，默认 `hexo-bridge/sync`，不能和目标分支相同。
- `GitHub token`: 选择一个 Obsidian SecretStorage 条目。当前只接受以 `ghp_` 开头的 token。
- `同步来源目录`: 状态页展示和同步的 Vault 目录。
- `Hexo 笔记模板`: 可选，新建空笔记时使用的 Markdown 模板。
- `为新笔记套用模板`: 默认关闭。开启后，在同步来源目录中新建空 Markdown 文件时会自动复制模板内容。
- `文章目录`: GitHub 仓库中的 Hexo posts 路径，默认 `source/_posts`。
- `本地图片目录`: GitHub 仓库中的图片路径，默认 `source/images/obsidian`。
- `图片命名模板`: 默认 `{{slug}}/{{filename}}`。
- `Git commit 消息模板`: 默认 `chore(hexo): export {{title}}`。

## Token 权限

建议使用 GitHub classic personal access token，因为插件会校验 token 以 `ghp_` 开头。

- 直接提交模式需要对目标仓库有内容读写权限。
- Pull Request / MR 模式还需要创建和更新 Pull Request 的权限。
- Token 明文由 Obsidian SecretStorage 保存，插件的 `data.json` 只保存 secret 名称。

## 使用方式

- 点击左侧 Ribbon 图标打开 Hexo Bridge 状态页。
- 在状态页中筛选笔记，点击某一行的 `同步` 按钮。
- 或使用命令面板执行 `同步当前笔记到 Hexo 文章`。
- 同步成功后，状态页会记录目标路径、commit 链接和 Pull Request 链接。
- 如果同步成功后本地笔记又被修改，状态会变为“有修改”，可以再次同步。

## 图片处理

Hexo Bridge 只处理本地图片，不依赖图床。

插件会解析 Markdown 图片链接和 Obsidian wiki 图片链接，将本地图片作为同一个 GitHub commit 中的 blob 提交，并把 Markdown 中的图片链接改写为 Hexo public path。

图片命名模板支持：

```text
{{filename}} {{slug}} {{index}} {{hash}} {{original}} {{ext}} {{date}}
```

其中 `{{filename}}` 会保留 Obsidian 中的附件文件名。

## 模板变量

Hexo 笔记模板支持：

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
- 只同步到 Hexo posts 目录，不支持 drafts。
- 只支持本地图片，不支持 PicGo 或其它图床。
- 第一版只支持 token，不支持 GitHub OAuth 登录。

## 开发

```bash
npm install
npm run build
```

构建后会生成 Obsidian 实际加载的 `main.js`。

## 赞助

如果 Hexo Bridge 帮你节省了维护博客的时间，欢迎通过 GitHub Sponsors 支持作者：

[在 GitHub Sponsors 上赞助 merrier](https://github.com/sponsors/merrier)
