import { App, PluginSettingTab, SecretComponent, Setting, TFile, TFolder } from "obsidian";
import { t } from "./i18n";
import type ObsidianHexoBridgePlugin from "./main";

export type GitHubPublishMode = "direct" | "pullRequest";

export interface HexoBridgeSettings {
	githubOwner: string;
	githubRepo: string;
	githubBranch: string;
	githubPublishMode: GitHubPublishMode;
	githubPullRequestBranch: string;
	githubTokenSecretName: string;
	syncSourceDir: string;
	applyTemplateOnNewNote: boolean;
	hexoTemplatePath: string;
	postsDir: string;
	localImageDir: string;
	imageNameTemplate: string;
	gitCommitMessageTemplate: string;
}

export const DEFAULT_SETTINGS: HexoBridgeSettings = {
	githubOwner: "",
	githubRepo: "",
	githubBranch: "main",
	githubPublishMode: "direct",
	githubPullRequestBranch: "hexo-bridge/sync",
	githubTokenSecretName: "",
	syncSourceDir: "",
	applyTemplateOnNewNote: false,
	hexoTemplatePath: "",
	postsDir: "source/_posts",
	localImageDir: "source/images/obsidian",
	imageNameTemplate: "{{slug}}/{{filename}}",
	gitCommitMessageTemplate: "chore(hexo): export {{title}}",
};

export class HexoBridgeSettingTab extends PluginSettingTab {
	plugin: ObsidianHexoBridgePlugin;

	constructor(app: App, plugin: ObsidianHexoBridgePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName(t("settingsGitHubOwnerName"))
			.setDesc(t("settingsGitHubOwnerDesc"))
			.addText((text) => text
				.setPlaceholder("merrier")
				.setValue(this.plugin.settings.githubOwner)
				.onChange(async (value) => {
					this.plugin.settings.githubOwner = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t("settingsGitHubRepoName"))
			.setDesc(t("settingsGitHubRepoDesc"))
			.addText((text) => text
				.setPlaceholder("merrier.github.io")
				.setValue(this.plugin.settings.githubRepo)
				.onChange(async (value) => {
					this.plugin.settings.githubRepo = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t("settingsGitHubBranchName"))
			.setDesc(t("settingsGitHubBranchDesc"))
			.addText((text) => text
				.setPlaceholder(DEFAULT_SETTINGS.githubBranch)
				.setValue(this.plugin.settings.githubBranch)
				.onChange(async (value) => {
					this.plugin.settings.githubBranch = value.trim() || DEFAULT_SETTINGS.githubBranch;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t("settingsGitHubPublishModeName"))
			.setDesc(t("settingsGitHubPublishModeDesc"))
			.addDropdown((dropdown) => dropdown
				.addOption("direct", t("settingsGitHubPublishModeDirect"))
				.addOption("pullRequest", t("settingsGitHubPublishModePullRequest"))
				.setValue(this.plugin.settings.githubPublishMode)
				.onChange(async (value) => {
					this.plugin.settings.githubPublishMode = value === "pullRequest" ? "pullRequest" : "direct";
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t("settingsGitHubPullRequestBranchName"))
			.setDesc(t("settingsGitHubPullRequestBranchDesc"))
			.addText((text) => text
				.setPlaceholder(DEFAULT_SETTINGS.githubPullRequestBranch)
				.setValue(this.plugin.settings.githubPullRequestBranch)
				.onChange(async (value) => {
					this.plugin.settings.githubPullRequestBranch = normalizeBranchSetting(value, DEFAULT_SETTINGS.githubPullRequestBranch);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t("settingsGitHubTokenName"))
			.setDesc(t("settingsGitHubTokenDesc"))
			.addComponent((el) => new SecretComponent(this.app, el)
				.setValue(this.plugin.settings.githubTokenSecretName)
				.onChange(async (value) => {
					this.plugin.settings.githubTokenSecretName = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t("settingsSyncSourceDirName"))
			.setDesc(t("settingsSyncSourceDirDesc"))
			.addDropdown((dropdown) => {
				const folders = getVaultFolderOptions(this.app);
				dropdown.addOption("", t("settingsAllMarkdownFiles"));
				for (const folder of folders) {
					dropdown.addOption(folder, folder);
				}
				if (this.plugin.settings.syncSourceDir && !folders.includes(this.plugin.settings.syncSourceDir)) {
					dropdown.addOption(this.plugin.settings.syncSourceDir, t("settingsMissingPath", { path: this.plugin.settings.syncSourceDir }));
				}
				return dropdown
					.setValue(this.plugin.settings.syncSourceDir)
					.onChange(async (value) => {
						this.plugin.settings.syncSourceDir = normalizeRelativeSetting(value, DEFAULT_SETTINGS.syncSourceDir);
						await this.plugin.saveSettings();
						this.plugin.refreshStatusViews();
					});
			});

		new Setting(containerEl)
			.setName(t("settingsHexoTemplateName"))
			.setDesc(t("settingsHexoTemplateDesc"))
			.addDropdown((dropdown) => {
				const files = getMarkdownFileOptions(this.app);
				dropdown.addOption("", t("settingsNoTemplate"));
				for (const file of files) {
					dropdown.addOption(file, file);
				}
				if (this.plugin.settings.hexoTemplatePath && !files.includes(this.plugin.settings.hexoTemplatePath)) {
					dropdown.addOption(this.plugin.settings.hexoTemplatePath, t("settingsMissingPath", { path: this.plugin.settings.hexoTemplatePath }));
				}
				return dropdown
					.setValue(this.plugin.settings.hexoTemplatePath)
					.onChange(async (value) => {
						this.plugin.settings.hexoTemplatePath = normalizeRelativeSetting(value, DEFAULT_SETTINGS.hexoTemplatePath);
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName(t("settingsApplyTemplateName"))
			.setDesc(t("settingsApplyTemplateDesc"))
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.applyTemplateOnNewNote)
				.onChange(async (value) => {
					this.plugin.settings.applyTemplateOnNewNote = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t("settingsPostsDirName"))
			.setDesc(t("settingsPostsDirDesc"))
			.addText((text) => text
				.setPlaceholder(DEFAULT_SETTINGS.postsDir)
				.setValue(this.plugin.settings.postsDir)
				.onChange(async (value) => {
					this.plugin.settings.postsDir = normalizeRelativeSetting(value, DEFAULT_SETTINGS.postsDir);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t("settingsLocalImageDirName"))
			.setDesc(t("settingsLocalImageDirDesc"))
			.addText((text) => text
				.setPlaceholder(DEFAULT_SETTINGS.localImageDir)
				.setValue(this.plugin.settings.localImageDir)
				.onChange(async (value) => {
					this.plugin.settings.localImageDir = normalizeRelativeSetting(value, DEFAULT_SETTINGS.localImageDir);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t("settingsImageNameTemplateName"))
			.setDesc(t("settingsImageNameTemplateDesc"))
			.addText((text) => text
				.setPlaceholder(DEFAULT_SETTINGS.imageNameTemplate)
				.setValue(this.plugin.settings.imageNameTemplate)
				.onChange(async (value) => {
					this.plugin.settings.imageNameTemplate = value.trim() || DEFAULT_SETTINGS.imageNameTemplate;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t("settingsCommitMessageName"))
			.setDesc(t("settingsCommitMessageDesc"))
			.addText((text) => text
				.setPlaceholder(DEFAULT_SETTINGS.gitCommitMessageTemplate)
				.setValue(this.plugin.settings.gitCommitMessageTemplate)
				.onChange(async (value) => {
					this.plugin.settings.gitCommitMessageTemplate = value.trim() || DEFAULT_SETTINGS.gitCommitMessageTemplate;
					await this.plugin.saveSettings();
				}));
	}
}

function getVaultFolderOptions(app: App): string[] {
	return app.vault.getAllLoadedFiles()
		.filter((file): file is TFolder => file instanceof TFolder && file.path !== "/" && file.path !== "")
		.map((folder) => folder.path)
		.sort((a, b) => a.localeCompare(b));
}

function getMarkdownFileOptions(app: App): string[] {
	return app.vault.getMarkdownFiles()
		.map((file: TFile) => file.path)
		.sort((a, b) => a.localeCompare(b));
}

function normalizeRelativeSetting(value: string, fallback: string): string {
	const normalized = value.trim().replace(/^\/+/, "").replace(/\\/g, "/").replace(/\/+/g, "/");
	if (!normalized || normalized === ".") {
		return fallback;
	}
	const segments = normalized.split("/").filter((segment) => segment && segment !== ".");
	if (segments.some((segment) => segment === "..")) {
		return fallback;
	}
	return segments.join("/");
}

function normalizeBranchSetting(value: string, fallback: string): string {
	const normalized = value
		.trim()
		.replace(/^refs\/heads\//, "")
		.replace(/\\/g, "/")
		.replace(/^\/+|\/+$/g, "")
		.replace(/\/+/g, "/");
	return normalized || fallback;
}
