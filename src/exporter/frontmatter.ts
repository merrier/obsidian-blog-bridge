import { parseYaml, stringifyYaml } from "obsidian";

export type Frontmatter = Record<string, unknown>;

export interface MarkdownParts {
	frontmatter: Frontmatter;
	body: string;
	hadFrontmatter: boolean;
}

export function splitFrontmatter(markdown: string): MarkdownParts {
	if (!markdown.startsWith("---")) {
		return {
			frontmatter: {},
			body: markdown,
			hadFrontmatter: false,
		};
	}

	const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	if (!match) {
		return {
			frontmatter: {},
			body: markdown,
			hadFrontmatter: false,
		};
	}

	const parsed = parseYaml(match[1]);
	return {
		frontmatter: isRecord(parsed) ? parsed : {},
		body: markdown.slice(match[0].length),
		hadFrontmatter: true,
	};
}

export function joinFrontmatter(frontmatter: Frontmatter, body: string): string {
	const yaml = stringifyYaml(frontmatter).trimEnd();
	const normalizedBody = body.startsWith("\n") ? body : `\n${body}`;
	return `---\n${yaml}\n---\n${normalizedBody}`;
}

export function frontmatterString(value: unknown): string | undefined {
	if (typeof value === "string" && value.trim()) {
		return value.trim();
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	return undefined;
}

export function ensureHexoDefaults(frontmatter: Frontmatter, title: string, now: Date): Frontmatter {
	const next = { ...frontmatter };
	if (!frontmatterString(next.title)) {
		next.title = title;
	}
	if (!frontmatterString(next.date)) {
		next.date = formatHexoDate(now);
	}
	return next;
}

export function updateBridgeMetadata(
	frontmatter: Frontmatter,
	metadata: {
		status: string;
		targetPath: string;
		exportedAt: string;
		imageMode: string;
		commit: string;
	}
): Frontmatter {
	return {
		...frontmatter,
		hexoBridge: metadata,
	};
}

export function formatHexoDate(date: Date): string {
	const pad = (value: number) => String(value).padStart(2, "0");
	return [
		date.getFullYear(),
		pad(date.getMonth() + 1),
		pad(date.getDate()),
	].join("-") + " " + [
		pad(date.getHours()),
		pad(date.getMinutes()),
		pad(date.getSeconds()),
	].join(":");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

