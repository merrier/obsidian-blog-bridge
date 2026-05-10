import { exec } from "node:child_process";
import { copyFile, mkdir } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { ensurePathClean } from "./git";
import {
	decodeImageRef,
	fileHash,
	isRemoteRef,
	relativeToRoot,
	renderImageNameTemplate,
	resolveLocalImagePath,
	safeJoin,
	toPosixPath,
} from "./path-utils";
import { ImageContext, ProcessedMarkdown } from "./types";

const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(([^)\n]+)\)/g;
const WIKI_IMAGE_RE = /!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

export async function processImages(markdown: string, context: ImageContext): Promise<ProcessedMarkdown> {
	const writtenHexoPaths: string[] = [];
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

		const nextUrl = context.imageMode === "picgo"
			? await uploadWithPicGo(sourceImagePath, context.settings.picgoCommand)
			: await copyLocalImage(sourceImagePath, context, imageIndex, writtenHexoPaths);

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
		writtenHexoPaths,
	};
}

async function copyLocalImage(
	sourceImagePath: string,
	context: ImageContext,
	index: number,
	writtenHexoPaths: string[]
): Promise<string> {
	const ext = extname(sourceImagePath).replace(/^\./, "") || "bin";
	const hash = fileHash(sourceImagePath);
	const relativeImageName = renderImageNameTemplate(context.settings.imageNameTemplate, {
		slug: context.slug,
		index,
		hash,
		original: basename(sourceImagePath),
		ext,
		date: new Date(),
	});

	const imageRelToHexoRoot = toPosixPath(join(context.settings.localImageDir, relativeImageName));
	const targetPath = safeJoin(context.hexoRoot, imageRelToHexoRoot);

	if (existsSync(targetPath)) {
		const targetHash = fileHash(targetPath);
		if (targetHash !== hash) {
			await ensurePathClean(context.hexoRoot, imageRelToHexoRoot);
		}
	}

	await mkdir(dirname(targetPath), { recursive: true });
	if (!existsSync(targetPath) || readFileSync(targetPath).compare(readFileSync(sourceImagePath)) !== 0) {
		await copyFile(sourceImagePath, targetPath);
	}

	writtenHexoPaths.push(relativeToRoot(context.hexoRoot, targetPath));
	const publicPath = `/${toPosixPath(join(context.settings.localImageDir.replace(/^source\//, ""), relativeImageName))}`;
	return encodeURI(publicPath).replace(/%2F/g, "/");
}

async function uploadWithPicGo(sourceImagePath: string, command: string): Promise<string> {
	const fullCommand = command.includes("<path>")
		? command.split("<path>").join(shellQuote(sourceImagePath))
		: `${command} ${shellQuote(sourceImagePath)}`;

	const output = await execShell(fullCommand);
	const urls = output.match(/https?:\/\/[^\s"'<>]+/g);
	if (!urls || urls.length === 0) {
		throw new Error("PicGo did not return an uploaded image URL.");
	}
	return urls[urls.length - 1];
}

function execShell(command: string): Promise<string> {
	return new Promise((resolve, reject) => {
		exec(command, (error, stdout, stderr) => {
			if (error) {
				const detail = (stderr || stdout || error.message).trim();
				reject(new Error(detail || "PicGo command failed."));
				return;
			}
			resolve(`${stdout}\n${stderr}`);
		});
	});
}

function shellQuote(value: string): string {
	return `'${value.replace(/'/g, "'\\''")}'`;
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
