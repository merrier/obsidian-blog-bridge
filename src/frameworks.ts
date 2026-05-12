import { join } from "node:path";
import { toPosixPath } from "./exporter/path-utils";

export type BlogFrameworkId = "hexo" | "hugo" | "jekyll" | "astro" | "vitepress" | "mkdocs";

export interface BlogFrameworkPreset {
	id: BlogFrameworkId;
	name: string;
	postsDir: string;
	localImageDir: string;
	commitMessageTemplate: string;
}

export const BLOG_FRAMEWORKS: BlogFrameworkPreset[] = [
	{
		id: "hexo",
		name: "Hexo",
		postsDir: "source/_posts",
		localImageDir: "source/images/obsidian",
		commitMessageTemplate: "chore(blog): sync {{title}}",
	},
	{
		id: "hugo",
		name: "Hugo",
		postsDir: "content/posts",
		localImageDir: "static/images/obsidian",
		commitMessageTemplate: "chore(blog): sync {{title}}",
	},
	{
		id: "jekyll",
		name: "Jekyll",
		postsDir: "_posts",
		localImageDir: "assets/images/obsidian",
		commitMessageTemplate: "chore(blog): sync {{title}}",
	},
	{
		id: "astro",
		name: "Astro",
		postsDir: "src/content/blog",
		localImageDir: "public/images/obsidian",
		commitMessageTemplate: "chore(blog): sync {{title}}",
	},
	{
		id: "vitepress",
		name: "VitePress",
		postsDir: "docs/posts",
		localImageDir: "docs/public/images/obsidian",
		commitMessageTemplate: "chore(blog): sync {{title}}",
	},
	{
		id: "mkdocs",
		name: "MkDocs",
		postsDir: "docs/blog/posts",
		localImageDir: "docs/assets/images/obsidian",
		commitMessageTemplate: "chore(blog): sync {{title}}",
	},
];

export const DEFAULT_BLOG_FRAMEWORK: BlogFrameworkId = "hexo";

export function frameworkPreset(id: BlogFrameworkId): BlogFrameworkPreset {
	return BLOG_FRAMEWORKS.find((framework) => framework.id === id) ?? BLOG_FRAMEWORKS[0];
}

export function normalizeFrameworkId(value: unknown): BlogFrameworkId {
	return BLOG_FRAMEWORKS.some((framework) => framework.id === value)
		? value as BlogFrameworkId
		: DEFAULT_BLOG_FRAMEWORK;
}

export function getPostTargetPath(input: {
	framework: BlogFrameworkId;
	postsDir: string;
	slug: string;
	date: Date;
}): string {
	const fileName = input.framework === "jekyll"
		? `${formatDate(input.date)}-${input.slug}.md`
		: `${input.slug}.md`;
	return toPosixPath(join(input.postsDir, fileName));
}

export function getPublicImagePath(input: {
	framework: BlogFrameworkId;
	localImageDir: string;
	relativeImageName: string;
}): string {
	const pathInRepo = toPosixPath(join(input.localImageDir, input.relativeImageName));
	const publicPath = stripPublicRoot(input.framework, pathInRepo);
	return encodeURI(`/${publicPath}`).replace(/%2F/g, "/");
}

function stripPublicRoot(framework: BlogFrameworkId, pathInRepo: string): string {
	if (framework === "hexo" && pathInRepo.startsWith("source/")) {
		return pathInRepo.slice("source/".length);
	}
	if ((framework === "hugo" || framework === "astro") && pathInRepo.startsWith("static/")) {
		return pathInRepo.slice("static/".length);
	}
	if (framework === "astro" && pathInRepo.startsWith("public/")) {
		return pathInRepo.slice("public/".length);
	}
	if (framework === "vitepress" && pathInRepo.startsWith("docs/public/")) {
		return pathInRepo.slice("docs/public/".length);
	}
	if (framework === "vitepress" && pathInRepo.startsWith("public/")) {
		return pathInRepo.slice("public/".length);
	}
	if (framework === "mkdocs" && pathInRepo.startsWith("docs/")) {
		return pathInRepo.slice("docs/".length);
	}
	return pathInRepo;
}

function formatDate(date: Date): string {
	const pad = (value: number) => String(value).padStart(2, "0");
	return [
		date.getFullYear(),
		pad(date.getMonth() + 1),
		pad(date.getDate()),
	].join("-");
}
