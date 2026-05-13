import { FileSystemAdapter, Notice, Plugin, TFile } from "obsidian";
import { exportCurrentNote } from "./exporter/exporter";
import { renderTemplateVariables } from "./exporter/path-utils";
import { ExportResult } from "./exporter/types";
import { frameworkPreset, normalizeFrameworkId } from "./frameworks";
import { t } from "./i18n";
import { BlogBridgeSettings, BlogBridgeSettingTab, DEFAULT_SETTINGS } from "./settings";
import { BlogBridgeStatusView, VIEW_TYPE_BLOG_BRIDGE_STATUS } from "./status-view";

const GITHUB_TOKEN_PREFIX = "ghp_";

export type SyncStatus = "synced" | "failed";

export interface SyncRecord {
	lastStatus: SyncStatus;
	lastAttemptedAt: string;
	lastSyncedAt?: string;
	targetKind?: "post";
	targetPath?: string;
	commitSha?: string;
	commitUrl?: string;
	errorMessage?: string;
	sourceMtime?: number;
	publishMode?: "direct" | "pullRequest";
	pullRequestNumber?: number;
	pullRequestUrl?: string;
	pullRequestBranch?: string;
}

interface BlogBridgePluginData {
	settings: BlogBridgeSettings;
	syncRecords: Record<string, SyncRecord>;
}

export default class ObsidianBlogBridgePlugin extends Plugin {
	settings: BlogBridgeSettings;
	syncRecords: Record<string, SyncRecord> = {};
	syncingPaths = new Set<string>();

	async onload() {
		await this.loadPluginData();

		this.registerView(VIEW_TYPE_BLOG_BRIDGE_STATUS, (leaf) => new BlogBridgeStatusView(leaf, this));

		const ribbonIcon = this.addRibbonIcon("send", t("ribbonOpenStatus"), async () => {
			await this.activateStatusView();
		});
		ribbonIcon.addClass("blog-bridge-ribbon-icon");

		this.addCommand({
			id: "sync-current-note-to-blog-post",
			name: t("commandSyncCurrentNote"),
			callback: async () => {
				await this.syncActiveNote();
			},
		});

		this.addCommand({
			id: "open-settings",
			name: t("commandOpenSettings"),
			callback: () => {
				(this.app as unknown as { setting: { open(): void; openTabById(id: string): void } }).setting.open();
				(this.app as unknown as { setting: { open(): void; openTabById(id: string): void } }).setting.openTabById(this.manifest.id);
			},
		});

		this.addSettingTab(new BlogBridgeSettingTab(this.app, this));
		this.registerEvent(this.app.vault.on("create", (file) => {
			void this.applyTemplateToNewNote(file);
		}));
		this.registerEvent(this.app.vault.on("modify", (file) => {
			if (file instanceof TFile && file.extension === "md" && this.isInSyncSourceDir(file.path)) {
				this.refreshStatusViews();
			}
		}));
	}

	async loadPluginData() {
		const raw = await this.loadData() as Partial<BlogBridgePluginData & BlogBridgeSettings> | null;
		const rawSettings = raw && isRecord(raw.settings) ? raw.settings : raw;
		this.settings = normalizeSettings(rawSettings);
		this.syncRecords = raw && isSyncRecordMap(raw.syncRecords) ? raw.syncRecords : {};
	}

	async saveSettings() {
		await this.savePluginData();
	}

	async savePluginData() {
		await this.saveData({
			settings: this.settings,
			syncRecords: this.syncRecords,
		} satisfies BlogBridgePluginData);
	}

	async activateStatusView() {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_BLOG_BRIDGE_STATUS);
		const leaf = leaves[0] ?? this.app.workspace.getLeaf(true);
		await leaf.setViewState({
			type: VIEW_TYPE_BLOG_BRIDGE_STATUS,
			active: true,
		});
		await this.app.workspace.revealLeaf(leaf);
	}

	refreshStatusViews() {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_BLOG_BRIDGE_STATUS)) {
			if (leaf.view instanceof BlogBridgeStatusView) {
				leaf.view.render();
			}
		}
	}

	getSyncFiles(): TFile[] {
		return this.app.vault.getMarkdownFiles()
			.filter((file) => this.isInSyncSourceDir(file.path))
			.sort((a, b) => a.path.localeCompare(b.path));
	}

	getSyncRecord(path: string): SyncRecord | undefined {
		return this.syncRecords[path];
	}

	async syncFile(file: TFile): Promise<ExportResult | undefined> {
		if (this.syncingPaths.has(file.path)) {
			new Notice(t("noticeAlreadySyncing"));
			return undefined;
		}

		const attemptedAt = new Date().toISOString();
		this.syncingPaths.add(file.path);
		this.refreshStatusViews();

		try {
			this.validateGitHubSettings();
			const token = await this.getGitHubToken();
			const adapter = this.app.vault.adapter;
			if (!(adapter instanceof FileSystemAdapter)) {
				throw new Error(t("errorDesktopVault"));
			}

			const sourceMtime = file.stat.mtime;
			const result = await exportCurrentNote({
				app: this.app,
				file,
				settings: this.settings,
				vaultRoot: adapter.getBasePath(),
				token,
			});

			this.syncRecords[file.path] = {
				lastStatus: "synced",
				lastAttemptedAt: attemptedAt,
				lastSyncedAt: new Date().toISOString(),
				targetKind: "post",
				targetPath: result.targetPath,
				commitSha: result.commitSha,
				commitUrl: result.commitUrl,
				sourceMtime,
				publishMode: this.settings.githubPublishMode,
				pullRequestNumber: result.pullRequestNumber,
				pullRequestUrl: result.pullRequestUrl,
				pullRequestBranch: result.pullRequestBranch,
			};
			await this.savePluginData();
			if (result.pullRequestNumber) {
				new Notice(t("noticeSyncedWithPullRequest", {
					title: result.title,
					sha: result.commitSha.slice(0, 7),
					number: result.pullRequestNumber,
				}));
			} else {
				new Notice(t("noticeSynced", {
					title: result.title,
					sha: result.commitSha.slice(0, 7),
				}));
			}
			return result;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error(error);
			this.syncRecords[file.path] = {
				...this.syncRecords[file.path],
				lastStatus: "failed",
				lastAttemptedAt: attemptedAt,
				targetKind: "post",
				errorMessage: message,
			};
			await this.savePluginData();
			new Notice(t("noticeSyncFailed", { message }));
			return undefined;
		} finally {
			this.syncingPaths.delete(file.path);
			this.refreshStatusViews();
		}
	}

	private async syncActiveNote() {
		const file = this.app.workspace.getActiveFile();
		if (!file || !(file instanceof TFile) || file.extension !== "md") {
			new Notice(t("noticeOpenMarkdown"));
			return;
		}

		await this.syncFile(file);
	}

	private async applyTemplateToNewNote(file: unknown): Promise<void> {
		if (!(file instanceof TFile) || file.extension !== "md") {
			return;
		}
		if (!this.settings.applyTemplateOnNewNote || !this.settings.templatePath || file.path === this.settings.templatePath) {
			return;
		}
		if (!this.isInSyncSourceDir(file.path)) {
			return;
		}

		await delay(100);
		const target = this.app.vault.getAbstractFileByPath(file.path);
		if (!(target instanceof TFile)) {
			return;
		}
		const existingContent = await this.app.vault.read(target);
		if (existingContent.trim()) {
			return;
		}

		const template = this.app.vault.getAbstractFileByPath(this.settings.templatePath);
		if (!(template instanceof TFile)) {
			new Notice(t("noticeTemplateNotFound", { path: this.settings.templatePath }));
			return;
		}
		const templateContent = await this.app.vault.read(template);
		await this.app.vault.modify(target, renderTemplate(templateContent, target));
	}

	private isInSyncSourceDir(path: string): boolean {
		const sourceDir = normalizeVaultPrefix(this.settings.syncSourceDir);
		return !sourceDir || path === sourceDir || path.startsWith(`${sourceDir}/`);
	}

	private validateGitHubSettings() {
		if (!this.settings.githubOwner.trim()) {
			throw new Error(t("errorOwnerRequired"));
		}
		if (!this.settings.githubRepo.trim()) {
			throw new Error(t("errorRepoRequired"));
		}
		if (!this.settings.githubBranch.trim()) {
			throw new Error(t("errorBranchRequired"));
		}
		if (this.settings.githubPublishMode === "pullRequest") {
			if (!this.settings.githubPullRequestBranch.trim()) {
				throw new Error(t("errorPullRequestBranchRequired"));
			}
			if (this.settings.githubPullRequestBranch.trim() === this.settings.githubBranch.trim()) {
				throw new Error(t("errorPullRequestBranchMatchesBase"));
			}
		}
	}

	private async getGitHubToken(): Promise<string> {
		const secretName = this.settings.githubTokenSecretName.trim();
		if (!secretName) {
			throw new Error(t("errorTokenSecretRequired"));
		}

		const token = await Promise.resolve(this.app.secretStorage.getSecret(secretName));
		if (!token) {
			throw new Error(t("errorTokenSecretMissing", { secretName }));
		}
		const trimmedToken = token.trim();
		if (!trimmedToken.startsWith(GITHUB_TOKEN_PREFIX)) {
			throw new Error(t("errorTokenPrefix", { prefix: GITHUB_TOKEN_PREFIX }));
		}
		return trimmedToken;
	}
}

function normalizeSettings(rawSettings: Partial<BlogBridgeSettings> | null | undefined): BlogBridgeSettings {
	const raw = rawSettings ?? {};
	const settings = Object.assign({}, DEFAULT_SETTINGS, raw);
	const framework = normalizeFrameworkId(settings.blogFramework);
	const preset = frameworkPreset(framework);
	return {
		blogFramework: framework,
		githubOwner: stringSetting(settings.githubOwner),
		githubRepo: stringSetting(settings.githubRepo),
		githubBranch: stringSetting(settings.githubBranch) || DEFAULT_SETTINGS.githubBranch,
		githubPublishMode: normalizePublishMode(settings.githubPublishMode),
		githubPullRequestBranch: normalizeBranchSetting(settings.githubPullRequestBranch, DEFAULT_SETTINGS.githubPullRequestBranch),
		githubTokenSecretName: stringSetting(settings.githubTokenSecretName),
		syncSourceDir: normalizeRelativeSetting(settings.syncSourceDir, DEFAULT_SETTINGS.syncSourceDir),
		applyTemplateOnNewNote: settings.applyTemplateOnNewNote === true,
		templatePath: normalizeRelativeSetting(raw.templatePath, DEFAULT_SETTINGS.templatePath),
		postsDir: normalizeRelativeSetting(raw.postsDir, preset.postsDir),
		localImageDir: normalizeRelativeSetting(raw.localImageDir, preset.localImageDir),
		imageNameTemplate: stringSetting(settings.imageNameTemplate) || DEFAULT_SETTINGS.imageNameTemplate,
		gitCommitMessageTemplate: stringSetting(raw.gitCommitMessageTemplate) || preset.commitMessageTemplate,
	};
}

function normalizeVaultPrefix(value: string): string {
	return normalizeRelativeSetting(value, "").replace(/\/+$/, "");
}

function normalizeRelativeSetting(value: string | undefined, fallback: string): string {
	const normalized = stringSetting(value).replace(/^\/+/, "").replace(/\\/g, "/").replace(/\/+/g, "/");
	if (!normalized || normalized === ".") {
		return fallback;
	}
	const segments = normalized.split("/").filter((segment) => segment && segment !== ".");
	if (segments.some((segment) => segment === "..")) {
		return fallback;
	}
	return segments.join("/");
}

function normalizePublishMode(value: unknown): "direct" | "pullRequest" {
	return value === "pullRequest" ? "pullRequest" : "direct";
}

function normalizeBranchSetting(value: unknown, fallback: string): string {
	const normalized = stringSetting(value)
		.replace(/^refs\/heads\//, "")
		.replace(/\\/g, "/")
		.replace(/^\/+|\/+$/g, "")
		.replace(/\/+/g, "/");
	return normalized || fallback;
}

function stringSetting(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSyncRecordMap(value: unknown): value is Record<string, SyncRecord> {
	if (!isRecord(value)) {
		return false;
	}
	return Object.values(value).every((record) => isRecord(record) && (
		record.lastStatus === "synced" || record.lastStatus === "failed"
	) && typeof record.lastAttemptedAt === "string");
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function renderTemplate(template: string, file: TFile): string {
	const now = new Date();
	return renderTemplateVariables(template, {
		title: file.basename,
		slug: slugify(file.basename),
		date: formatDate(now),
		datetime: formatDateTime(now),
	});
}

function slugify(value: string): string {
	const normalized = value
		.trim()
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[^\p{L}\p{N}]+/gu, "-")
		.replace(/^-+|-+$/g, "");
	return normalized || "untitled";
}

function formatDate(date: Date): string {
	const pad = (value: number) => String(value).padStart(2, "0");
	return [
		date.getFullYear(),
		pad(date.getMonth() + 1),
		pad(date.getDate()),
	].join("-");
}

function formatDateTime(date: Date): string {
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${formatDate(date)} ${[
		pad(date.getHours()),
		pad(date.getMinutes()),
		pad(date.getSeconds()),
	].join(":")}`;
}
