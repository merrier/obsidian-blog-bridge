import { execFile } from "node:child_process";

export async function gitStatusForPath(repoRoot: string, relativePath: string): Promise<string> {
	const output = await runGit(repoRoot, ["status", "--porcelain", "--", relativePath]);
	return output.trim();
}

export async function ensurePathClean(repoRoot: string, relativePath: string): Promise<void> {
	const status = await gitStatusForPath(repoRoot, relativePath);
	if (status) {
		throw new Error(`Refusing to overwrite dirty git path: ${relativePath}`);
	}
}

export async function commitPaths(repoRoot: string, paths: string[], message: string): Promise<string> {
	const uniquePaths = Array.from(new Set(paths)).filter(Boolean);
	if (uniquePaths.length === 0) {
		throw new Error("No paths were provided for git commit.");
	}

	await runGit(repoRoot, ["add", "--", ...uniquePaths]);
	const staged = (await runGit(repoRoot, ["diff", "--cached", "--name-only", "--", ...uniquePaths])).trim();
	if (!staged) {
		throw new Error("No staged changes to commit.");
	}

	await runGit(repoRoot, ["commit", "-m", message]);
	return (await runGit(repoRoot, ["rev-parse", "HEAD"])).trim();
}

export function renderCommitMessage(template: string, input: {
	title: string;
	slug: string;
	status: string;
}): string {
	return template
		.split("<title>").join(input.title)
		.split("<slug>").join(input.slug)
		.split("<status>").join(input.status);
}

export function runGit(repoRoot: string, args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile("git", args, { cwd: repoRoot }, (error, stdout, stderr) => {
			if (error) {
				reject(new Error((stderr || error.message).trim()));
				return;
			}
			resolve(stdout);
		});
	});
}
