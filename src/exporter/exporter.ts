import { join } from "node:path";
import {
	ensureBlogDefaults,
	frontmatterDate,
	frontmatterString,
	joinFrontmatter,
	splitFrontmatter,
} from "./frontmatter";
import { getPostTargetPath } from "../frameworks";
import { commitFilesToGitHub } from "./github";
import { renderCommitMessage } from "./git";
import { processImages } from "./images";
import { slugify } from "./path-utils";
import { ExportRequest, ExportResult } from "./types";

export async function exportCurrentNote(request: ExportRequest): Promise<ExportResult> {
	const now = new Date();
	const sourceMarkdown = await request.app.vault.cachedRead(request.file);
	const parts = splitFrontmatter(sourceMarkdown);
	const fallbackTitle = request.file.basename;
	const title = frontmatterString(parts.frontmatter.title) ?? fallbackTitle;
	const slug = slugify(
		frontmatterString(parts.frontmatter.slug)
		?? frontmatterString(parts.frontmatter.urlname)
		?? title
	);
	const postDate = frontmatterDate(parts.frontmatter.date) ?? now;
	const targetRelPath = getPostTargetPath({
		framework: request.settings.blogFramework,
		postsDir: request.settings.postsDir,
		slug,
		date: postDate,
	});

	const sourceAbsPath = join(request.vaultRoot, request.file.path);
	const processed = await processImages(parts.body, {
		app: request.app,
		settings: request.settings,
		vaultRoot: request.vaultRoot,
		sourceFile: request.file,
		sourceAbsPath,
		slug,
	});

	const blogFrontmatter = ensureBlogDefaults(parts.frontmatter, title, now, request.settings.blogFramework);
	const blogMarkdown = joinFrontmatter(blogFrontmatter, processed.markdown);
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
				content: blogMarkdown,
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
