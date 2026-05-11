import { App, TFile } from "obsidian";
import { HexoBridgeSettings } from "../settings";

export type CommitFileEncoding = "utf-8" | "base64";

export interface CommitFile {
	path: string;
	content: string;
	encoding: CommitFileEncoding;
}

export interface ExportRequest {
	app: App;
	file: TFile;
	settings: HexoBridgeSettings;
	vaultRoot: string;
	token: string;
}

export interface ExportResult {
	title: string;
	slug: string;
	targetPath: string;
	commitSha: string;
	commitUrl: string;
	pullRequestNumber?: number;
	pullRequestUrl?: string;
	pullRequestBranch?: string;
}

export interface ImageContext {
	app: App;
	settings: HexoBridgeSettings;
	vaultRoot: string;
	sourceFile: TFile;
	sourceAbsPath: string;
	slug: string;
}

export interface ProcessedMarkdown {
	markdown: string;
	files: CommitFile[];
}
