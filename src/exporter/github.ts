import { CommitFile } from "./types";

const API_BASE = "https://api.github.com";
const API_VERSION = "2022-11-28";

interface GitHubRefResponse {
	object: {
		sha: string;
		type: string;
	};
}

interface GitHubCommitResponse {
	sha: string;
	html_url: string;
	tree: {
		sha: string;
	};
}

interface GitHubBlobResponse {
	sha: string;
}

interface GitHubTreeResponse {
	sha: string;
}

interface GitHubErrorResponse {
	message?: string;
	documentation_url?: string;
}

export interface GitHubTarget {
	owner: string;
	repo: string;
	branch: string;
	publishMode: "direct" | "pullRequest";
	pullRequestBranch: string;
	token: string;
}

export interface GitHubCommitResult {
	sha: string;
	url: string;
	pullRequestNumber?: number;
	pullRequestUrl?: string;
	pullRequestBranch?: string;
}

interface GitHubPullRequestResponse {
	number: number;
	html_url: string;
}

export async function commitFilesToGitHub(
	target: GitHubTarget,
	files: CommitFile[],
	message: string
): Promise<GitHubCommitResult> {
	const uniqueFiles = uniqueCommitFiles(files);
	if (uniqueFiles.length === 0) {
		throw new Error("No files were provided for GitHub commit.");
	}

	const client = new GitHubClient(target);
	if (target.publishMode === "pullRequest") {
		return await commitFilesToPullRequest(client, target, uniqueFiles, message);
	}

	return await commitFilesToBranch(client, target.branch, uniqueFiles, message);
}

async function commitFilesToBranch(
	client: GitHubClient,
	branch: string,
	files: CommitFile[],
	message: string
): Promise<GitHubCommitResult> {
	const ref = await client.getBranchRef(branch);
	if (ref.object.type !== "commit") {
		throw new Error(`GitHub ref heads/${branch} does not point to a commit.`);
	}

	const commit = await createCommitFromParent(client, ref.object.sha, files, message);
	await client.updateBranchRef(branch, commit.sha);

	return {
		sha: commit.sha,
		url: commit.html_url,
	};
}

async function commitFilesToPullRequest(
	client: GitHubClient,
	target: GitHubTarget,
	files: CommitFile[],
	message: string
): Promise<GitHubCommitResult> {
	const baseBranch = target.branch;
	const headBranch = target.pullRequestBranch.trim();
	if (!headBranch) {
		throw new Error("MR branch is required when sync mode is Pull Request / MR.");
	}
	if (headBranch === baseBranch) {
		throw new Error("MR branch must be different from the target branch.");
	}

	const baseRef = await client.getBranchRef(baseBranch);
	if (baseRef.object.type !== "commit") {
		throw new Error(`GitHub ref heads/${baseBranch} does not point to a commit.`);
	}

	const headRef = await client.getOptionalBranchRef(headBranch);
	if (headRef && headRef.object.type !== "commit") {
		throw new Error(`GitHub ref heads/${headBranch} does not point to a commit.`);
	}

	const parentSha = headRef?.object.sha ?? baseRef.object.sha;
	const commit = await createCommitFromParent(client, parentSha, files, message);
	if (headRef) {
		await client.updateBranchRef(headBranch, commit.sha);
	} else {
		await client.createBranchRef(headBranch, commit.sha);
	}

	const pullRequest = await client.getOrCreatePullRequest(
		headBranch,
		baseBranch,
		"Hexo Bridge sync",
		"Automated Hexo Bridge sync from Obsidian."
	);

	return {
		sha: commit.sha,
		url: commit.html_url,
		pullRequestNumber: pullRequest.number,
		pullRequestUrl: pullRequest.html_url,
		pullRequestBranch: headBranch,
	};
}

async function createCommitFromParent(
	client: GitHubClient,
	parentSha: string,
	files: CommitFile[],
	message: string
): Promise<GitHubCommitResponse> {
	const parentCommit = await client.getCommit(parentSha);
	const blobs = await Promise.all(files.map(async (file) => ({
		path: file.path,
		sha: await client.createBlob(file.content, file.encoding),
	})));

	const treeSha = await client.createTree(parentCommit.tree.sha, blobs.map((blob) => ({
		path: blob.path,
		mode: "100644",
		type: "blob",
		sha: blob.sha,
	})));
	return await client.createCommit(message, treeSha, parentCommit.sha);
}

class GitHubClient {
	constructor(private readonly target: GitHubTarget) {}

	async getBranchRef(branch: string): Promise<GitHubRefResponse> {
		return this.request("GET", `/git/ref/heads/${encodeRefPath(branch)}`);
	}

	async getOptionalBranchRef(branch: string): Promise<GitHubRefResponse | undefined> {
		try {
			return await this.getBranchRef(branch);
		} catch (error) {
			if (error instanceof GitHubApiError && error.status === 404) {
				return undefined;
			}
			throw error;
		}
	}

	async getCommit(sha: string): Promise<GitHubCommitResponse> {
		return this.request("GET", `/git/commits/${encodeURIComponent(sha)}`);
	}

	async createBlob(content: string, encoding: "utf-8" | "base64"): Promise<string> {
		const blob = await this.request<GitHubBlobResponse>("POST", "/git/blobs", {
			content,
			encoding,
		});
		return blob.sha;
	}

	async createTree(baseTree: string, tree: Array<{
		path: string;
		mode: "100644";
		type: "blob";
		sha: string;
	}>): Promise<string> {
		const result = await this.request<GitHubTreeResponse>("POST", "/git/trees", {
			base_tree: baseTree,
			tree,
		});
		return result.sha;
	}

	async createCommit(message: string, tree: string, parent: string): Promise<GitHubCommitResponse> {
		return this.request("POST", "/git/commits", {
			message,
			tree,
			parents: [parent],
		});
	}

	async createBranchRef(branch: string, sha: string): Promise<void> {
		await this.request("POST", "/git/refs", {
			ref: `refs/heads/${branch}`,
			sha,
		});
	}

	async updateBranchRef(branch: string, sha: string): Promise<void> {
		await this.request("PATCH", `/git/refs/heads/${encodeRefPath(branch)}`, {
			sha,
			force: false,
		});
	}

	async getOrCreatePullRequest(
		headBranch: string,
		baseBranch: string,
		title: string,
		body: string
	): Promise<GitHubPullRequestResponse> {
		const existing = await this.listOpenPullRequests(headBranch, baseBranch);
		if (existing[0]) {
			return existing[0];
		}
		return await this.request("POST", "/pulls", {
			title,
			head: headBranch,
			base: baseBranch,
			body,
			maintainer_can_modify: true,
		});
	}

	private async listOpenPullRequests(headBranch: string, baseBranch: string): Promise<GitHubPullRequestResponse[]> {
		const params = new URLSearchParams({
			state: "open",
			head: `${this.target.owner}:${headBranch}`,
			base: baseBranch,
		});
		return await this.request("GET", `/pulls?${params.toString()}`);
	}

	private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
		const response = await fetch(`${API_BASE}/repos/${encodeURIComponent(this.target.owner)}/${encodeURIComponent(this.target.repo)}${path}`, {
			method,
			headers: {
				Accept: "application/vnd.github+json",
				Authorization: `Bearer ${this.target.token}`,
				"Content-Type": "application/json",
				"X-GitHub-Api-Version": API_VERSION,
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		});

		if (!response.ok) {
			throw new GitHubApiError(response.status, await githubErrorMessage(response));
		}

		if (response.status === 204) {
			return undefined as T;
		}
		return await response.json() as T;
	}
}

class GitHubApiError extends Error {
	constructor(readonly status: number, message: string) {
		super(message);
		this.name = "GitHubApiError";
	}
}

function uniqueCommitFiles(files: CommitFile[]): CommitFile[] {
	const byPath = new Map<string, CommitFile>();
	for (const file of files.filter((candidate) => candidate.path)) {
		const existing = byPath.get(file.path);
		if (existing && (existing.content !== file.content || existing.encoding !== file.encoding)) {
			throw new Error(`Multiple files resolve to the same GitHub path: ${file.path}`);
		}
		byPath.set(file.path, file);
	}
	return Array.from(byPath.values());
}

function encodeRefPath(ref: string): string {
	return ref.split("/").map((part) => encodeURIComponent(part)).join("/");
}

async function githubErrorMessage(response: Response): Promise<string> {
	let detail = response.statusText;
	try {
		const data = await response.json() as GitHubErrorResponse;
		detail = data.message || detail;
	} catch {
		// Keep the HTTP status text when GitHub does not return JSON.
	}

	if (response.status === 401 || response.status === 403) {
		return `GitHub authentication failed: ${detail}. Check that the token has Contents read/write access.`;
	}
	if (response.status === 404) {
		return `GitHub repository or branch was not found: ${detail}.`;
	}
	if (response.status === 409) {
		return "GitHub branch changed while syncing. Please try again.";
	}
	return `GitHub API error ${response.status}: ${detail}`;
}
