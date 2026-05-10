import { App, PluginSettingTab, Setting } from "obsidian";
import ObsidianHexoBridgePlugin from "./main";

export type ImageMode = "local" | "picgo";

export interface HexoBridgeSettings {
	hexoRoot: string;
	postsDir: string;
	draftsDir: string;
	imageMode: ImageMode;
	localImageDir: string;
	imageNameTemplate: string;
	picgoCommand: string;
	gitCommitMessageTemplate: string;
	commitSourceMetadata: boolean;
}

export const DEFAULT_SETTINGS: HexoBridgeSettings = {
	hexoRoot: "/Users/merrier/repos/merrier.github.io",
	postsDir: "source/_posts",
	draftsDir: "source/_drafts",
	imageMode: "local",
	localImageDir: "source/images/obsidian",
	imageNameTemplate: "<slug>/<index>-<hash>.<ext>",
	picgoCommand: "picgo upload",
	gitCommitMessageTemplate: "chore(hexo): export <title>",
	commitSourceMetadata: true,
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
			.setName("Hexo root")
			.setDesc("Absolute path to the Hexo repository.")
			.addText((text) => text
				.setPlaceholder(DEFAULT_SETTINGS.hexoRoot)
				.setValue(this.plugin.settings.hexoRoot)
				.onChange(async (value) => {
					this.plugin.settings.hexoRoot = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Posts directory")
			.setDesc("Relative to Hexo root.")
			.addText((text) => text
				.setPlaceholder(DEFAULT_SETTINGS.postsDir)
				.setValue(this.plugin.settings.postsDir)
				.onChange(async (value) => {
					this.plugin.settings.postsDir = normalizeRelativeSetting(value, DEFAULT_SETTINGS.postsDir);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Drafts directory")
			.setDesc("Relative to Hexo root.")
			.addText((text) => text
				.setPlaceholder(DEFAULT_SETTINGS.draftsDir)
				.setValue(this.plugin.settings.draftsDir)
				.onChange(async (value) => {
					this.plugin.settings.draftsDir = normalizeRelativeSetting(value, DEFAULT_SETTINGS.draftsDir);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Image mode")
			.setDesc("Local copies images into the Hexo repo. PicGo uploads through your PicGo configuration.")
			.addDropdown((dropdown) => dropdown
				.addOption("local", "Local")
				.addOption("picgo", "PicGo")
				.setValue(this.plugin.settings.imageMode)
				.onChange(async (value) => {
					this.plugin.settings.imageMode = value as "local" | "picgo";
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Local image directory")
			.setDesc("Relative to Hexo root. Used when image mode is Local.")
			.addText((text) => text
				.setPlaceholder(DEFAULT_SETTINGS.localImageDir)
				.setValue(this.plugin.settings.localImageDir)
				.onChange(async (value) => {
					this.plugin.settings.localImageDir = normalizeRelativeSetting(value, DEFAULT_SETTINGS.localImageDir);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Image name template")
			.setDesc("Variables: <slug>, <index>, <hash>, <original>, <ext>, <date>.")
			.addText((text) => text
				.setPlaceholder(DEFAULT_SETTINGS.imageNameTemplate)
				.setValue(this.plugin.settings.imageNameTemplate)
				.onChange(async (value) => {
					this.plugin.settings.imageNameTemplate = value.trim() || DEFAULT_SETTINGS.imageNameTemplate;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("PicGo command")
			.setDesc("Used when image mode is PicGo. The image path is appended and shell-quoted.")
			.addText((text) => text
				.setPlaceholder(DEFAULT_SETTINGS.picgoCommand)
				.setValue(this.plugin.settings.picgoCommand)
				.onChange(async (value) => {
					this.plugin.settings.picgoCommand = value.trim() || DEFAULT_SETTINGS.picgoCommand;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Git commit message template")
			.setDesc("Variables: <title>, <slug>, <status>.")
			.addText((text) => text
				.setPlaceholder(DEFAULT_SETTINGS.gitCommitMessageTemplate)
				.setValue(this.plugin.settings.gitCommitMessageTemplate)
				.onChange(async (value) => {
					this.plugin.settings.gitCommitMessageTemplate = value.trim() || DEFAULT_SETTINGS.gitCommitMessageTemplate;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Commit source note metadata")
			.setDesc("Commit only the exported source note in the vault repo after writing hexoBridge metadata.")
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.commitSourceMetadata)
				.onChange(async (value) => {
					this.plugin.settings.commitSourceMetadata = value;
					await this.plugin.saveSettings();
				}));
	}
}

function normalizeRelativeSetting(value: string, fallback: string): string {
	const normalized = value.trim().replace(/^\/+/, "").replace(/\\/g, "/");
	return normalized || fallback;
}

