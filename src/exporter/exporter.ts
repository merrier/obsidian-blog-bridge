import { join } from "node:path";
import {
	ensureHexoDefaults,
	frontmatterString,
	joinFrontmatter,
	splitFrontmatter,
} from "./frontmatter";
import { commitFilesToGitHub } from "./github";
import { renderCommitMessage } from "./git";
import { processImages } from "./images";
import { slugify, toPosixPath } from "./path-utils";
import { ExportRequest, ExportResult } from "./types";

export async function exportCurrentNote(request: ExportRequest): Promise<ExportResult> {
	const now = new Date();
	const sourceMarkdown = await request.app.vault.cachedRead(request.file);
	const parts = splitFrontmatter(sourceMarkdown);
	const fallbackTitle = request.file.basename;
	const title = frontmatterString(parts.frontmatter.title) ?? fallbackTitle;
	const slug = slugify(frontmatterString(parts.frontmatter.urlname) ?? title);
	const targetRelPath = toPosixPath(join(request.settings.postsDir, `${slug}.md`));

	const sourceAbsPath = join(request.vaultRoot, request.file.path);
	const processed = await processImages(parts.body, {
		app: request.app,
		settings: request.settings,
		vaultRoot: request.vaultRoot,
		sourceFile: request.file,
		sourceAbsPath,
		slug,
	});

	const hexoFrontmatter = ensureHexoDefaults(parts.frontmatter, title, now);
	const hexoMarkdown = joinFrontmatter(hexoFrontmatter, processed.markdown);
	const commit = await commitFilesToGitHub(
		{
			owner: request.settings.githubOwner,
			repo: request.settings.githubRepo,
			branch: request.settings.githubBranch,
			publishMode: request.settings.githubPublishMode,
			pullRequestBranch: request.settings.githubPullRequestBranch,
			token: request.token,
		},
		[
			{
				path: targetRelPath,
				content: hexoMarkdown,
				encoding: "utf-8",
			},
			...processed.files,
		],
		renderCommitMessage(request.settings.gitCommitMessageTemplate, {
			title,
			slug,
			status: "post",
		})
	);

	return {
		title,
		slug,
		targetPath: targetRelPath,
		commitSha: commit.sha,
		commitUrl: commit.url,
		pullRequestNumber: commit.pullRequestNumber,
		pullRequestUrl: commit.pullRequestUrl,
		pullRequestBranch: commit.pullRequestBranch,
	};
}
