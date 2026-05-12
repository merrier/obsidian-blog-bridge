import { Buffer } from "node:buffer";
import { basename, extname, join } from "node:path";
import { readFileSync } from "node:fs";
import { getPublicImagePath } from "../frameworks";
import {
	decodeImageRef,
	fileHash,
	isRemoteRef,
	renderImageNameTemplate,
	resolveLocalImagePath,
	toPosixPath,
} from "./path-utils";
import { ImageContext, ProcessedMarkdown } from "./types";

const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(([^)\n]+)\)/g;
const WIKI_IMAGE_RE = /!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

export async function processImages(markdown: string, context: ImageContext): Promise<ProcessedMarkdown> {
	const files: ProcessedMarkdown["files"] = [];
	const refToUrl = new Map<string, string>();
	let imageIndex = 1;

	async function resolveReplacement(rawRef: string): Promise<string | undefined> {
		const decoded = decodeImageRef(rawRef);
		if (!decoded || isRemoteRef(decoded)) {
			return undefined;
		}

		const cached = refToUrl.get(decoded);
		if (cached) {
			return cached;
		}

		const sourceImagePath = resolveLocalImagePath({
			vaultRoot: context.vaultRoot,
			sourceAbsPath: context.sourceAbsPath,
			rawRef: decoded,
		});
		if (!sourceImagePath) {
			throw new Error(`Could not resolve local image: ${rawRef}`);
		}

		const nextUrl = localImageCommitFile(sourceImagePath, context, imageIndex, files);

		refToUrl.set(decoded, nextUrl);
		imageIndex += 1;
		return nextUrl;
	}

	let nextMarkdown = await replaceAsync(markdown, MARKDOWN_IMAGE_RE, async (match, alt: string, rawRef: string) => {
		const nextUrl = await resolveReplacement(rawRef);
		return nextUrl ? `![${alt}](${nextUrl})` : match;
	});

	nextMarkdown = await replaceAsync(nextMarkdown, WIKI_IMAGE_RE, async (match, rawRef: string) => {
		const nextUrl = await resolveReplacement(rawRef);
		return nextUrl ? `![](${nextUrl})` : match;
	});

	return {
		markdown: nextMarkdown,
		files,
	};
}

function localImageCommitFile(
	sourceImagePath: string,
	context: ImageContext,
	index: number,
	files: ProcessedMarkdown["files"]
): string {
	const ext = extname(sourceImagePath).replace(/^\./, "") || "bin";
	const hash = fileHash(sourceImagePath);
	const relativeImageName = renderImageNameTemplate(context.settings.imageNameTemplate, {
		slug: context.slug,
		index,
		hash,
		filename: basename(sourceImagePath),
		original: basename(sourceImagePath),
		ext,
		date: new Date(),
	});

	const imageRelToRepoRoot = toPosixPath(join(context.settings.localImageDir, relativeImageName));
	const content = Buffer.from(readFileSync(sourceImagePath)).toString("base64");
	const existing = files.find((file) => file.path === imageRelToRepoRoot);
	if (existing && existing.content !== content) {
		throw new Error(`Two images resolve to the same blog repository path: ${imageRelToRepoRoot}`);
	}
	if (!existing) {
		files.push({
			path: imageRelToRepoRoot,
			content,
			encoding: "base64",
		});
	}

	return getPublicImagePath({
		framework: context.settings.blogFramework,
		localImageDir: context.settings.localImageDir,
		relativeImageName,
	});
}

async function replaceAsync(
	input: string,
	regex: RegExp,
	replacer: (match: string, ...groups: string[]) => Promise<string>
): Promise<string> {
	const matches = Array.from(input.matchAll(regex));
	let output = "";
	let lastIndex = 0;

	for (const match of matches) {
		const index = match.index ?? 0;
		output += input.slice(lastIndex, index);
		output += await replacer(match[0], ...match.slice(1));
		lastIndex = index + match[0].length;
	}

	return output + input.slice(lastIndex);
}
