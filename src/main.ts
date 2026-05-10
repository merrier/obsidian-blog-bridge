import { FileSystemAdapter, Notice, Plugin, TFile } from "obsidian";
import { exportCurrentNote } from "./exporter/exporter";
import { DEFAULT_SETTINGS, HexoBridgeSettings, HexoBridgeSettingTab } from "./settings";

export default class ObsidianHexoBridgePlugin extends Plugin {
	settings: HexoBridgeSettings;

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon("send", "Export current note to Hexo post", async () => {
			await this.exportActiveNote("post");
		});

		this.addCommand({
			id: "export-current-note-to-hexo-post",
			name: "Export current note to Hexo post",
			callback: async () => {
				await this.exportActiveNote("post");
			},
		});

		this.addCommand({
			id: "export-current-note-to-hexo-draft",
			name: "Export current note to Hexo draft",
			callback: async () => {
				await this.exportActiveNote("draft");
			},
		});

		this.addCommand({
			id: "open-hexo-bridge-settings",
			name: "Open Hexo Bridge settings",
			callback: () => {
				(this.app as unknown as { setting: { open(): void; openTabById(id: string): void } }).setting.open();
				(this.app as unknown as { setting: { open(): void; openTabById(id: string): void } }).setting.openTabById(this.manifest.id);
			},
		});

		this.addSettingTab(new HexoBridgeSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<HexoBridgeSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async exportActiveNote(status: "post" | "draft") {
		try {
			const file = this.app.workspace.getActiveFile();
			if (!file || !(file instanceof TFile) || file.extension !== "md") {
				new Notice("Open a Markdown note before exporting.");
				return;
			}

			const adapter = this.app.vault.adapter;
			if (!(adapter instanceof FileSystemAdapter)) {
				new Notice("Hexo Bridge requires a desktop vault backed by the local file system.");
				return;
			}

			const result = await exportCurrentNote({
				app: this.app,
				file,
				settings: this.settings,
				vaultRoot: adapter.getBasePath(),
				status,
			});

			const noteCommit = result.sourceCommit ? `, note ${result.sourceCommit.slice(0, 7)}` : "";
			new Notice(`Exported ${result.title} (${result.hexoCommit.slice(0, 7)}${noteCommit}).`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error(error);
			new Notice(`Hexo export failed: ${message}`);
		}
	}
}

