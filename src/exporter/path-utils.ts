import { createHash } from "node:crypto";
import { basename, dirname, extname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import { existsSync, readFileSync } from "node:fs";

export function slugify(value: string): string {
	const normalized = value
		.trim()
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[^\p{L}\p{N}]+/gu, "-")
		.replace(/^-+|-+$/g, "");
	return normalized || "untitled";
}

export function safeJoin(root: string, relativePath: string): string {
	const target = resolve(root, relativePath);
	const rootPath = resolve(root);
	if (target !== rootPath && !target.startsWith(rootPath + sep)) {
		throw new Error(`Path escapes configured root: ${relativePath}`);
	}
	return target;
}

export function toPosixPath(value: string): string {
	return value.split(sep).join("/");
}

export function relativeToRoot(root: string, absPath: string): string {
	return toPosixPath(relative(root, absPath));
}

export function renderImageNameTemplate(template: string, input: {
	slug: string;
	index: number;
	hash: string;
	filename: string;
	original: string;
	ext: string;
	date: Date;
}): string {
	const date = [
		input.date.getFullYear(),
		String(input.date.getMonth() + 1).padStart(2, "0"),
		String(input.date.getDate()).padStart(2, "0"),
	].join("");

	const rendered = renderTemplateVariables(template, {
		slug: input.slug,
		index: String(input.index).padStart(2, "0"),
		hash: input.hash,
		filename: input.filename,
		original: stripExtension(input.original),
		ext: input.ext,
		date,
	});

	return normalize(rendered).replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]+/, "");
}

export function renderTemplateVariables(template: string, variables: Record<string, string>): string {
	let rendered = template;
	for (const [key, value] of Object.entries(variables)) {
		rendered = rendered.split(`{{${key}}}`).join(value);
	}
	return rendered;
}

export function fileHash(absPath: string): string {
	return createHash("sha1").update(readFileSync(absPath)).digest("hex").slice(0, 10);
}

export function resolveLocalImagePath(input: {
	vaultRoot: string;
	sourceAbsPath: string;
	rawRef: string;
}): string | undefined {
	const ref = decodeImageRef(input.rawRef);
	if (!ref || isRemoteRef(ref)) {
		return undefined;
	}

	const candidates = new Set<string>();
	const sourceDir = dirname(input.sourceAbsPath);
	if (isAbsolute(ref)) {
		candidates.add(ref);
		candidates.add(join(input.vaultRoot, ref.replace(/^[/\\]+/, "")));
	} else {
		candidates.add(resolve(sourceDir, ref));
		candidates.add(resolve(input.vaultRoot, ref));
		candidates.add(resolve(input.vaultRoot, "assets", ref));
		candidates.add(resolve(input.vaultRoot, "assets", basename(ref)));
	}

	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			return candidate;
		}
	}
	return undefined;
}

export function isRemoteRef(ref: string): boolean {
	return /^(https?:|data:|mailto:|#)/i.test(ref);
}

export function decodeImageRef(rawRef: string): string {
	const trimmed = rawRef.trim().replace(/^<|>$/g, "");
	const withoutTitle = trimmed.match(/^([^"\s]+)(?:\s+".*")?$/)?.[1] ?? trimmed;
	try {
		return decodeURI(withoutTitle);
	} catch {
		return withoutTitle;
	}
}

function stripExtension(fileName: string): string {
	const ext = extname(fileName);
	return ext ? fileName.slice(0, -ext.length) : fileName;
}
