import { ItemView, TFile, WorkspaceLeaf } from "obsidian";
import type ObsidianBlogBridgePlugin from "./main";
import type { SyncRecord } from "./main";
import { frontmatterString } from "./exporter/frontmatter";
import { getCurrentLanguage, t } from "./i18n";

export const VIEW_TYPE_BLOG_BRIDGE_STATUS = "blog-bridge-sync-status";
const PAGE_SIZE = 20;

type RowStatus = "synced" | "modified" | "failed" | "unsynced";
type StatusFilter = "all" | RowStatus;

interface ViewFilters {
	search: string;
	tags: string[];
	status: StatusFilter;
	page: number;
}

export class BlogBridgeStatusView extends ItemView {
	private draftSearch = "";
	private draftTag = "";
	private focusTagInputAfterRender = false;

	private filters: ViewFilters = {
		search: "",
		tags: [],
		status: "all",
		page: 1,
	};

	constructor(leaf: WorkspaceLeaf, private readonly plugin: ObsidianBlogBridgePlugin) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_BLOG_BRIDGE_STATUS;
	}

	getDisplayText(): string {
		return "Blog Bridge";
	}

	getIcon(): string {
		return "send";
	}

	async onOpen(): Promise<void> {
		this.render();
	}

	render(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("blog-bridge-view");

		containerEl.createEl("h2", { text: "Blog Bridge" });
		this.renderFilters(containerEl);
		this.renderList(containerEl);
	}

	private renderFilters(containerEl: HTMLElement): void {
		const controls = containerEl.createDiv({ cls: "blog-bridge-controls" });

		const search = controls.createEl("input", {
			type: "search",
			placeholder: t("statusSearchTitle"),
			value: this.draftSearch,
		});
		search.addEventListener("input", () => {
			this.draftSearch = search.value;
		});
		search.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				this.applyDraftFilters();
			}
		});

		const tagFilter = controls.createDiv({ cls: "blog-bridge-tag-filter" });
		for (const activeTag of this.filters.tags) {
			const chip = tagFilter.createEl("button", {
				cls: "blog-bridge-tag-chip",
				text: `${activeTag} ×`,
			});
			chip.setAttr("aria-label", t("statusRemoveTag", { tag: activeTag }));
			chip.addEventListener("click", () => this.removeTagFilter(activeTag));
		}

		const tag = tagFilter.createEl("input", {
			cls: "blog-bridge-tag-input",
			type: "search",
			placeholder: this.filters.tags.length === 0 ? t("statusFilterTag") : "",
			value: this.draftTag,
		});
		if (this.focusTagInputAfterRender) {
			this.focusTagInputAfterRender = false;
			window.setTimeout(() => tag.focus(), 0);
		}
		tag.addEventListener("input", () => {
			this.draftTag = tag.value;
		});
		tag.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				this.addDraftTags();
			}
			if (event.key === "Backspace" && this.draftTag === "" && this.filters.tags.length > 0) {
				event.preventDefault();
				this.removeTagFilter(this.filters.tags[this.filters.tags.length - 1]);
			}
		});

		const status = controls.createEl("select");
		for (const [value, label] of [
			["all", t("statusAll")],
			["unsynced", t("statusUnsynced")],
			["synced", t("statusSynced")],
			["modified", t("statusModified")],
			["failed", t("statusFailed")],
		] as Array<[StatusFilter, string]>) {
			status.createEl("option", { value, text: label });
		}
		status.value = this.filters.status;
		status.addEventListener("change", () => {
			this.filters.status = status.value as StatusFilter;
			this.filters.page = 1;
			this.render();
		});

		const searchButton = controls.createEl("button", { text: t("statusSearchButton") });
		searchButton.addEventListener("click", () => this.applyDraftFilters());
	}

	private applyDraftFilters(): void {
		this.filters.search = this.draftSearch;
		this.addDraftTags(false);
		this.filters.page = 1;
		this.render();
	}

	private addDraftTags(render = true): void {
		const nextTags = parseTagFilters(this.draftTag);
		if (nextTags.length === 0) {
			return;
		}

		const existing = new Set(this.filters.tags);
		for (const tag of nextTags) {
			if (!existing.has(tag)) {
				this.filters.tags.push(tag);
				existing.add(tag);
			}
		}
		this.draftTag = "";
		this.filters.page = 1;
		if (render) {
			this.focusTagInputAfterRender = true;
			this.render();
		}
	}

	private removeTagFilter(tag: string): void {
		this.filters.tags = this.filters.tags.filter((activeTag) => activeTag !== tag);
		this.filters.page = 1;
		this.focusTagInputAfterRender = true;
		this.render();
	}

	private renderList(containerEl: HTMLElement): void {
		const rows = this.filteredRows();
		const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
		this.filters.page = Math.min(Math.max(1, this.filters.page), totalPages);

		const pageRows = rows.slice((this.filters.page - 1) * PAGE_SIZE, this.filters.page * PAGE_SIZE);
		const summary = containerEl.createDiv({ cls: "blog-bridge-summary" });
		summary.setText(t("statusSummary", {
			count: rows.length,
			page: this.filters.page,
			totalPages,
		}));

		const list = containerEl.createDiv({ cls: "blog-bridge-list" });
		if (pageRows.length === 0) {
			list.createDiv({ cls: "blog-bridge-empty", text: t("statusEmpty") });
		}

		for (const row of pageRows) {
			this.renderRow(list, row);
		}

		const pager = containerEl.createDiv({ cls: "blog-bridge-pager" });
		const prev = pager.createEl("button", { text: t("statusPrevious") });
		prev.disabled = this.filters.page <= 1;
		prev.addEventListener("click", () => {
			this.filters.page -= 1;
			this.render();
		});

		const next = pager.createEl("button", { text: t("statusNext") });
		next.disabled = this.filters.page >= totalPages;
		next.addEventListener("click", () => {
			this.filters.page += 1;
			this.render();
		});
	}

	private renderRow(containerEl: HTMLElement, row: NoteRow): void {
		const record = row.record;
		const item = containerEl.createDiv({ cls: "blog-bridge-row" });
		const main = item.createDiv({ cls: "blog-bridge-row-main" });
		main.createDiv({ cls: "blog-bridge-title", text: row.title });
		main.createDiv({ cls: "blog-bridge-path", text: row.file.path });

		const meta = item.createDiv({ cls: "blog-bridge-meta" });
		meta.createSpan({ cls: `blog-bridge-status blog-bridge-status-${row.status}`, text: getStatusLabel(row.status) });
		if (record?.lastSyncedAt) {
			meta.createSpan({ text: t("statusLastSynced", { time: formatDateTime(record.lastSyncedAt) }) });
		} else if (record?.lastAttemptedAt) {
			meta.createSpan({ text: t("statusLastAttempted", { time: formatDateTime(record.lastAttemptedAt) }) });
		}
		if (row.status === "modified") {
			meta.createSpan({ text: t("statusModifiedSinceSync") });
		}
		if (record?.targetPath) {
			meta.createSpan({ text: record.targetPath });
		}
		if (record?.commitUrl && record.commitSha) {
			const commit = meta.createEl("a", {
				text: record.commitSha.slice(0, 7),
				href: record.commitUrl,
			});
			commit.setAttr("target", "_blank");
			commit.setAttr("rel", "noopener");
		}
		if (record?.pullRequestUrl && record.pullRequestNumber) {
			const pullRequest = meta.createEl("a", {
				text: t("statusPullRequest", { number: record.pullRequestNumber }),
				href: record.pullRequestUrl,
			});
			pullRequest.setAttr("target", "_blank");
			pullRequest.setAttr("rel", "noopener");
		}
		if (record?.errorMessage) {
			meta.createDiv({ cls: "blog-bridge-error", text: record.errorMessage });
		}

		const actions = item.createDiv({ cls: "blog-bridge-actions" });
		const syncing = this.plugin.syncingPaths.has(row.file.path);
		const post = actions.createEl("button", { text: syncing ? t("statusSyncing") : t("statusSync") });
		post.disabled = syncing;
		post.addEventListener("click", async () => {
			await this.plugin.syncFile(row.file);
			this.render();
		});
	}

	private filteredRows(): NoteRow[] {
		const search = this.filters.search.trim().toLowerCase();
		const tagFilters = this.filters.tags;
		return this.plugin.getSyncFiles()
			.map((file) => this.noteRow(file))
			.filter((row) => {
				if (this.filters.status !== "all" && row.status !== this.filters.status) {
					return false;
				}
				if (search && !row.title.toLowerCase().includes(search)) {
					return false;
				}
				if (tagFilters.length > 0 && !matchesAnyTag(row.tags, tagFilters)) {
					return false;
				}
				return true;
			});
	}

	private noteRow(file: TFile): NoteRow {
		const cache = this.app.metadataCache.getFileCache(file);
		const record = this.plugin.getSyncRecord(file.path);
		const title = frontmatterString(cache?.frontmatter?.title) ?? file.basename;
		return {
			file,
			title,
			tags: collectTags(cache?.frontmatter?.tags, cache?.tags?.map((tag) => tag.tag) ?? []),
			record,
			status: getRowStatus(file, record),
		};
	}
}

interface NoteRow {
	file: TFile;
	title: string;
	tags: string[];
	status: RowStatus;
	record?: SyncRecord;
}

function collectTags(frontmatterTags: unknown, inlineTags: string[]): string[] {
	const tags = new Set<string>();
	if (typeof frontmatterTags === "string") {
		for (const tag of frontmatterTags.split(/[\s,]+/)) {
			if (tag.trim()) {
				tags.add(tag.trim());
			}
		}
	}
	if (Array.isArray(frontmatterTags)) {
		for (const tag of frontmatterTags) {
			if (typeof tag === "string" && tag.trim()) {
				tags.add(tag.trim());
			}
		}
	}
	for (const tag of inlineTags) {
		if (tag.trim()) {
			tags.add(tag.trim());
		}
	}
	return Array.from(tags);
}

function normalizeTag(tag: string): string {
	return tag.trim().replace(/^#/, "").toLowerCase();
}

function parseTagFilters(value: string): string[] {
	return value
		.split(/[\s,，]+/)
		.map(normalizeTag)
		.filter(Boolean);
}

function matchesAnyTag(rowTags: string[], tagFilters: string[]): boolean {
	const normalizedTags = new Set(rowTags.map(normalizeTag));
	return tagFilters.some((tag) => normalizedTags.has(tag));
}

function getStatusLabel(status: StatusFilter): string {
	if (status === "all") {
		return t("statusAll");
	}
	if (status === "synced") {
		return t("statusSynced");
	}
	if (status === "modified") {
		return t("statusModified");
	}
	if (status === "failed") {
		return t("statusFailed");
	}
	return t("statusUnsynced");
}

function getRowStatus(file: TFile, record: SyncRecord | undefined): RowStatus {
	if (!record) {
		return "unsynced";
	}
	if (record.lastStatus === "synced" && isModifiedSinceSync(file, record)) {
		return "modified";
	}
	return record.lastStatus;
}

function isModifiedSinceSync(file: TFile, record: SyncRecord): boolean {
	if (typeof record.sourceMtime === "number") {
		return file.stat.mtime > record.sourceMtime;
	}
	if (!record.lastSyncedAt) {
		return false;
	}
	const lastSyncedAt = new Date(record.lastSyncedAt).getTime();
	return Number.isFinite(lastSyncedAt) && file.stat.mtime > lastSyncedAt;
}

function formatDateTime(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}
	return date.toLocaleString(getCurrentLanguage());
}
