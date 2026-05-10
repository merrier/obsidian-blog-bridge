import { App, TFile } from "obsidian";
import { HexoBridgeSettings, ImageMode } from "../settings";

export type ExportStatus = "post" | "draft";

export interface ExportRequest {
	app: App;
	file: TFile;
	settings: HexoBridgeSettings;
	vaultRoot: string;
	status: ExportStatus;
}

export interface ExportResult {
	title: string;
	slug: string;
	targetPath: string;
	hexoCommit: string;
	sourceCommit?: string;
}

export interface ImageContext {
	app: App;
	settings: HexoBridgeSettings;
	vaultRoot: string;
	hexoRoot: string;
	sourceFile: TFile;
	sourceAbsPath: string;
	slug: string;
	imageMode: ImageMode;
}

export interface ProcessedMarkdown {
	markdown: string;
	writtenHexoPaths: string[];
}

