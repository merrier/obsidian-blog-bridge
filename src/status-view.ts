import { ItemView, TFile, WorkspaceLeaf } from "obsidian";
import type ObsidianBlogBridgePlugin from "./main";
import type { SyncRecord } from "./main";
import { frontmatterString } from "./exporter/frontmatter";
import { getCurrentLanguage, t } from "./i18n";

export const VIEW_TYPE_BLOG_BRIDGE_STATUS = "blog-bridge-sync-status";
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const DEFAULT_PAGE_SIZE: PageSize = 10;

type RowStatus = "synced" | "modified" | "failed" | "unsynced";
type StatusFilter = "all" | RowStatus;
type PageSize = typeof PAGE_SIZE_OPTIONS[number];

interface ViewFilters {
	search: string;
	tags: string[];
	status: StatusFilter;
	page: number;
	pageSize: PageSize;
}

export class BlogBridgeStatusView extends ItemView {
	private draftSearch = "";
	private draftTag = "";
	private focusTagInputAfterRender = false;
	private selectedPaths = new Set<string>();
	private batchSyncing = false;

	private filters: ViewFilters = {
		search: "",
		tags: [],
		status: "all",
		page: 1,
		pageSize: DEFAULT_PAGE_SIZE,
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
		if (!this.plugin.settings.syncSourceDir) {
			this.renderMissingSourceDir(containerEl);
			return;
		}
		this.renderFilters(containerEl);
		this.renderList(containerEl);
	}

	private renderMissingSourceDir(containerEl: HTMLElement): void {
		const empty = containerEl.createDiv({ cls: "blog-bridge-config-empty" });
		empty.createDiv({ cls: "blog-bridge-config-empty-title", text: t("statusSyncSourceDirRequired") });
		const button = empty.createEl("button", { text: t("statusOpenSettings") });
		button.addEventListener("click", () => {
			this.plugin.openSettings();
		});
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
		this.pruneSelectedPaths(rows);

		const pageSize = this.filters.pageSize;
		const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
		this.filters.page = Math.min(Math.max(1, this.filters.page), totalPages);

		const pageRows = rows.slice((this.filters.page - 1) * pageSize, this.filters.page * pageSize);
		const summary = containerEl.createDiv({ cls: "blog-bridge-summary" });
		summary.setText(t("statusSummary", {
			count: rows.length,
			page: this.filters.page,
			totalPages,
		}));

		this.renderBulkActions(containerEl, rows, pageRows);

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

		const pageSizeSelect = pager.createEl("select");
		for (const value of PAGE_SIZE_OPTIONS) {
			pageSizeSelect.createEl("option", {
				value: String(value),
				text: t("statusPageSize", { count: value }),
			});
		}
		pageSizeSelect.value = String(this.filters.pageSize);
		pageSizeSelect.addEventListener("change", () => {
			this.filters.pageSize = normalizePageSize(Number(pageSizeSelect.value));
			this.filters.page = 1;
			this.render();
		});

		const next = pager.createEl("button", { text: t("statusNext") });
		next.disabled = this.filters.page >= totalPages;
		next.addEventListener("click", () => {
			this.filters.page += 1;
			this.render();
		});
	}

	private renderBulkActions(containerEl: HTMLElement, rows: NoteRow[], pageRows: NoteRow[]): void {
		const selectedRows = this.selectedRows(rows);
		const selectedOnPage = pageRows.filter((row) => this.selectedPaths.has(row.file.path));
		const allPageSelected = pageRows.length > 0 && selectedOnPage.length === pageRows.length;
		const somePageSelected = selectedOnPage.length > 0 && !allPageSelected;

		const bulkActions = containerEl.createDiv({ cls: "blog-bridge-bulk-actions" });
		const selectPageLabel = bulkActions.createEl("label", { cls: "blog-bridge-select-page" });
		const selectPage = selectPageLabel.createEl("input", { type: "checkbox" });
		selectPage.checked = allPageSelected;
		selectPage.indeterminate = somePageSelected;
		selectPage.disabled = pageRows.length === 0 || this.batchSyncing;
		selectPage.addEventListener("change", () => {
			if (selectPage.checked) {
				for (const row of pageRows) {
					this.selectedPaths.add(row.file.path);
				}
			} else {
				for (const row of pageRows) {
					this.selectedPaths.delete(row.file.path);
				}
			}
			this.render();
		});
		selectPageLabel.createSpan({ text: t("statusSelectPage") });

		bulkActions.createSpan({
			cls: "blog-bridge-selected-count",
			text: t("statusSelectedCount", { count: selectedRows.length }),
		});

		const syncSelected = bulkActions.createEl("button", {
			text: this.batchSyncing ? t("statusBatchSyncing") : t("statusSyncSelected"),
		});
		syncSelected.disabled = this.batchSyncing || selectedRows.length === 0;
		syncSelected.addEventListener("click", () => {
			void this.syncSelectedRows(rows);
		});

		const clearSelection = bulkActions.createEl("button", {
			cls: "blog-bridge-secondary-button",
			text: t("statusClearSelection"),
		});
		clearSelection.disabled = this.batchSyncing || selectedRows.length === 0;
		clearSelection.addEventListener("click", () => {
			this.selectedPaths.clear();
			this.render();
		});
	}

	private renderRow(containerEl: HTMLElement, row: NoteRow): void {
		const record = row.record;
		const item = containerEl.createDiv({ cls: "blog-bridge-row" });
		if (this.selectedPaths.has(row.file.path)) {
			item.addClass("blog-bridge-row-selected");
		}

		const select = item.createEl("input", { cls: "blog-bridge-row-select", type: "checkbox" });
		select.checked = this.selectedPaths.has(row.file.path);
		select.disabled = this.batchSyncing;
		select.setAttr("aria-label", t("statusSelectNote", { title: row.title }));
		select.addEventListener("change", () => {
			if (select.checked) {
				this.selectedPaths.add(row.file.path);
			} else {
				this.selectedPaths.delete(row.file.path);
			}
			this.render();
		});

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
		post.disabled = syncing || this.batchSyncing;
		post.addEventListener("click", () => {
			void this.syncRow(row);
		});
	}

	private async syncRow(row: NoteRow): Promise<void> {
		await this.plugin.syncFile(row.file);
		this.render();
	}

	private async syncSelectedRows(rows: NoteRow[]): Promise<void> {
		if (this.batchSyncing) {
			return;
		}

		const selectedRows = this.selectedRows(rows);
		if (selectedRows.length === 0) {
			return;
		}

		this.batchSyncing = true;
		this.render();
		try {
			for (const row of selectedRows) {
				if (!this.selectedPaths.has(row.file.path)) {
					continue;
				}
				const result = await this.plugin.syncFile(row.file);
				if (result) {
					this.selectedPaths.delete(row.file.path);
				}
			}
		} finally {
			this.batchSyncing = false;
			this.render();
		}
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

	private selectedRows(rows: NoteRow[]): NoteRow[] {
		return rows.filter((row) => this.selectedPaths.has(row.file.path));
	}

	private pruneSelectedPaths(rows: NoteRow[]): void {
		const visiblePaths = new Set(rows.map((row) => row.file.path));
		for (const path of Array.from(this.selectedPaths)) {
			if (!visiblePaths.has(path)) {
				this.selectedPaths.delete(path);
			}
		}
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

function normalizePageSize(value: number): PageSize {
	return PAGE_SIZE_OPTIONS.includes(value as PageSize) ? value as PageSize : DEFAULT_PAGE_SIZE;
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
