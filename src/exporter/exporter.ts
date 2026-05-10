import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { existsSync } from "node:fs";
import {
	ensureHexoDefaults,
	frontmatterString,
	joinFrontmatter,
	splitFrontmatter,
	updateBridgeMetadata,
} from "./frontmatter";
import { commitPaths, ensurePathClean, renderCommitMessage } from "./git";
import { processImages } from "./images";
import { relativeToRoot, safeJoin, slugify, toPosixPath } from "./path-utils";
import { ExportRequest, ExportResult } from "./types";

export async function exportCurrentNote(request: ExportRequest): Promise<ExportResult> {
	const now = new Date();
	const hexoRoot = resolve(request.settings.hexoRoot);
	if (!existsSync(hexoRoot)) {
		throw new Error(`Hexo root does not exist: ${hexoRoot}`);
	}

	const sourceMarkdown = await request.app.vault.cachedRead(request.file);
	const parts = splitFrontmatter(sourceMarkdown);
	const fallbackTitle = request.file.basename;
	const title = frontmatterString(parts.frontmatter.title) ?? fallbackTitle;
	const slug = slugify(frontmatterString(parts.frontmatter.urlname) ?? title);
	const targetDir = request.status === "post" ? request.settings.postsDir : request.settings.draftsDir;
	const targetRelPath = toPosixPath(join(targetDir, `${slug}.md`));
	const targetAbsPath = safeJoin(hexoRoot, targetRelPath);

	await ensurePathClean(hexoRoot, targetRelPath);

	const sourceAbsPath = join(request.vaultRoot, request.file.path);
	const processed = await processImages(parts.body, {
		app: request.app,
		settings: request.settings,
		vaultRoot: request.vaultRoot,
		hexoRoot,
		sourceFile: request.file,
		sourceAbsPath,
		slug,
		imageMode: request.settings.imageMode,
	});

	const hexoFrontmatter = ensureHexoDefaults(parts.frontmatter, title, now);
	const hexoMarkdown = joinFrontmatter(hexoFrontmatter, processed.markdown);
	await mkdir(dirname(targetAbsPath), { recursive: true });
	await writeFile(targetAbsPath, hexoMarkdown, "utf8");

	const hexoPaths = [targetRelPath, ...processed.writtenHexoPaths];
	const hexoCommit = await commitPaths(
		hexoRoot,
		hexoPaths,
		renderCommitMessage(request.settings.gitCommitMessageTemplate, {
			title,
			slug,
			status: request.status,
		})
	);

	const sourceFrontmatter = updateBridgeMetadata(hexoFrontmatter, {
		status: request.status,
		targetPath: targetRelPath,
		exportedAt: now.toISOString(),
		imageMode: request.settings.imageMode,
		commit: hexoCommit,
	});
	const updatedSourceMarkdown = joinFrontmatter(sourceFrontmatter, parts.body);
	await request.app.vault.modify(request.file, updatedSourceMarkdown);

	let sourceCommit: string | undefined;
	if (request.settings.commitSourceMetadata) {
		sourceCommit = await commitPaths(
			request.vaultRoot,
			[request.file.path],
			`chore(notes): record Hexo export for ${title}`
		);
	}

	return {
		title,
		slug,
		targetPath: relativeToRoot(hexoRoot, targetAbsPath),
		hexoCommit,
		sourceCommit,
	};
}

