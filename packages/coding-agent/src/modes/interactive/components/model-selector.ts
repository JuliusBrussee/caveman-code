import { getProviderAuthStatus, type Model, modelsAreEqual, type ProviderAuthStatus } from "@juliusbrussee/caveman-ai";
import {
	Container,
	type Focusable,
	fuzzyMatch,
	GroupedSelectList,
	getKeybindings,
	Input,
	Key,
	matchesKey,
	Spacer,
	Text,
	type TUI,
} from "@juliusbrussee/caveman-tui";
import type { ModelRegistry } from "../../../core/model-registry.js";
import { applyModelPredicates, parseModelQuery } from "../../../core/model-search-tokens.js";
import type { ModelRef, SettingsManager } from "../../../core/settings-manager.js";
import { theme } from "../theme/theme.js";
import { DynamicBorder } from "./dynamic-border.js";

interface ModelItem {
	provider: string;
	id: string;
	model: Model<any>;
	available: boolean;
	favorite: boolean;
}

interface ScopedModelItem {
	model: Model<any>;
	thinkingLevel?: string;
}

const RECENT_GROUP_ID = "__recent__";
const FAVORITES_GROUP_ID = "__favorites__";
const CYCLING_GROUP_ID = "__cycling__";

function formatContext(window: number | undefined): string {
	if (!window || window <= 0) return "";
	if (window >= 1_000_000) return `${(window / 1_000_000).toFixed(window % 1_000_000 === 0 ? 0 : 1)}M`;
	if (window >= 1_000) return `${Math.round(window / 1_000)}k`;
	return `${window}`;
}

function formatCost(cost: number | undefined): string | null {
	if (cost === undefined || cost === null || Number.isNaN(cost)) return null;
	if (cost === 0) return "free";
	if (cost < 1) return `$${cost.toFixed(2)}`;
	if (cost < 10) return `$${cost.toFixed(2)}`;
	return `$${cost.toFixed(0)}`;
}

function badgeForStatus(status: ProviderAuthStatus): string {
	switch (status.kind) {
		case "env":
			return theme.fg("success", "✓");
		case "oauth":
			return status.configured ? theme.fg("success", "🔑") : theme.fg("warning", "🔑");
		case "file":
			return status.configured ? theme.fg("success", "✓") : theme.fg("warning", "⚙");
		case "needs-region":
			return theme.fg("warning", "⚙");
		default:
			return theme.fg("error", "✗");
	}
}

/**
 * Component that renders a grouped, capability-aware model selector.
 *
 * Replaces the older flat fuzzy list. Scales to ~900 models across ~20+
 * providers via collapsible provider groups, "Recent" and "★ Favorites"
 * pseudo-groups, credential-state badges, and capability tokens
 * (`r:`, `$:`, `ctx:`, `v:`, `p:`) parsed inside the search input.
 */
export class ModelSelectorComponent extends Container implements Focusable {
	private searchInput: Input;
	private listView: GroupedSelectList<ModelItem>;
	private listContainer: Container;
	private statusText: Text;
	private hintText: Text;

	private _focused = false;
	get focused(): boolean {
		return this._focused;
	}
	set focused(value: boolean) {
		this._focused = value;
		this.searchInput.focused = value;
	}

	private currentModel?: Model<any>;
	private settingsManager: SettingsManager;
	private modelRegistry: ModelRegistry;
	private onSelectCallback: (model: Model<any>) => void;
	private onCancelCallback: () => void;
	private tui: TUI;
	private scopedModels: ReadonlyArray<ScopedModelItem>;

	private allModels: Model<any>[] = [];
	private authByProvider: Map<string, ProviderAuthStatus> = new Map();
	private favoriteRefs: ModelRef[] = [];
	private recentRefs: ModelRef[] = [];
	private hideUnavailable = false;
	private errorMessage?: string;

	constructor(
		tui: TUI,
		currentModel: Model<any> | undefined,
		settingsManager: SettingsManager,
		modelRegistry: ModelRegistry,
		scopedModels: ReadonlyArray<ScopedModelItem>,
		onSelect: (model: Model<any>) => void,
		onCancel: () => void,
		initialSearchInput?: string,
	) {
		super();

		this.tui = tui;
		this.currentModel = currentModel;
		this.settingsManager = settingsManager;
		this.modelRegistry = modelRegistry;
		this.scopedModels = scopedModels;
		this.onSelectCallback = onSelect;
		this.onCancelCallback = onCancel;

		this.addChild(new DynamicBorder());
		this.addChild(new Spacer(1));

		this.statusText = new Text("", 0, 0);
		this.addChild(this.statusText);
		this.addChild(new Spacer(1));

		this.searchInput = new Input();
		if (initialSearchInput) this.searchInput.setValue(initialSearchInput);
		this.searchInput.onSubmit = () => this.confirmSelection();
		this.addChild(this.searchInput);
		this.addChild(new Spacer(1));

		this.listContainer = new Container();
		this.addChild(this.listContainer);

		this.addChild(new Spacer(1));
		this.hintText = new Text(this.renderHints(), 0, 0);
		this.addChild(this.hintText);
		this.addChild(new DynamicBorder());

		this.listView = new GroupedSelectList<ModelItem>({
			maxVisible: 14,
			renderHeader: (group, isSelected, expanded) =>
				this.renderGroupHeader(group.id, group.header, isSelected, expanded),
			renderItem: (item, _group, isSelected) => this.renderModelLine(item, isSelected),
			renderEmpty: (group) => theme.fg("muted", `    ${group.emptyHint ?? "(no models)"}`),
			noMatch: theme.fg("muted", "  No matching models"),
		});
		this.listView.onSelect = (selection) => {
			if (selection.kind === "item") this.handleSelect(selection.item);
		};
		this.listView.onCancel = () => this.onCancelCallback();
		this.listView.onSelectionChange = () => this.refreshList();

		this.refreshList();

		this.loadAndRebuild().then(() => {
			this.tui.requestRender();
		});
	}

	getSearchInput(): Input {
		return this.searchInput;
	}

	private async loadAndRebuild(): Promise<void> {
		this.modelRegistry.refresh();
		this.errorMessage = this.modelRegistry.getError();

		try {
			this.allModels = this.modelRegistry.getSelectable();
			// Keep deliberate choices visible, including favorites and session history.
			const savedRefs = [
				...this.settingsManager.getFavoriteModels(),
				...this.settingsManager.getRecentModels(),
				...this.scopedModels.map((sc) => sc.model),
				...(this.currentModel ? [this.currentModel] : []),
			];
			for (const ref of savedRefs) {
				const model = this.modelRegistry.find(ref.provider, ref.id);
				if (model && !this.allModels.includes(model)) this.allModels.push(model);
			}
		} catch (error) {
			this.allModels = [];
			this.errorMessage = error instanceof Error ? error.message : String(error);
		}

		this.authByProvider.clear();
		const seenProviders = new Set<string>();
		for (const model of this.allModels) seenProviders.add(model.provider);
		for (const provider of seenProviders) {
			this.authByProvider.set(provider, getProviderAuthStatus(provider));
		}

		this.favoriteRefs = this.settingsManager.getFavoriteModels();
		this.recentRefs = this.settingsManager.getRecentModels();

		this.rebuildGroups();
	}

	private isAvailable(model: Model<any>): boolean {
		// `hasConfiguredAuth` is the registry-level fast check; supplement with the
		// auth-status helper for OAuth-bridge providers like github-copilot.
		if (this.modelRegistry.hasConfiguredAuth(model)) return true;
		const status = this.authByProvider.get(model.provider);
		return status?.configured === true;
	}

	private isFavorite(provider: string, id: string): boolean {
		return this.favoriteRefs.some((r) => r.provider === provider && r.id === id);
	}

	private toItem(model: Model<any>): ModelItem {
		return {
			provider: model.provider,
			id: model.id,
			model,
			available: this.isAvailable(model),
			favorite: this.isFavorite(model.provider, model.id),
		};
	}

	private rebuildGroups(): void {
		const query = this.searchInput.getValue();
		const parsed = parseModelQuery(query);
		const text = parsed.residualQuery.trim();

		const matchesText = (model: Model<any>): boolean => {
			if (!text) return true;
			const haystack = `${model.id} ${model.provider} ${model.provider}/${model.id}`;
			const tokens = text.split(/\s+/).filter(Boolean);
			return tokens.every((tok) => fuzzyMatch(tok, haystack).matches);
		};

		const matchesPredicates = (model: Model<any>) => applyModelPredicates([model], parsed.predicates).length > 0;

		const allMatching = this.allModels.filter((m) => matchesText(m) && matchesPredicates(m));

		const visible = this.hideUnavailable ? allMatching.filter((m) => this.isAvailable(m)) : allMatching;

		// Favorites pseudo-group — order follows favoriteRefs.
		const favoriteItems: ModelItem[] = [];
		for (const ref of this.favoriteRefs) {
			const model = visible.find((m) => m.provider === ref.provider && m.id === ref.id);
			if (model) favoriteItems.push(this.toItem(model));
		}

		// Recents pseudo-group — order follows recentRefs (LRU-most-recent first),
		// but skip anything already pinned in favorites to avoid duplicates.
		const favoriteKeys = new Set(favoriteItems.map((i) => `${i.provider}/${i.id}`));
		const recentItems: ModelItem[] = [];
		for (const ref of this.recentRefs) {
			const key = `${ref.provider}/${ref.id}`;
			if (favoriteKeys.has(key)) continue;
			const model = visible.find((m) => m.provider === ref.provider && m.id === ref.id);
			if (model) recentItems.push(this.toItem(model));
		}

		// Cycling (Ctrl+P) pseudo-group — only when scopedModels is non-empty.
		const cyclingItems: ModelItem[] = [];
		const cyclingKeys = new Set<string>();
		for (const sc of this.scopedModels) {
			const key = `${sc.model.provider}/${sc.model.id}`;
			if (favoriteKeys.has(key)) continue;
			const model = visible.find((m) => m.provider === sc.model.provider && m.id === sc.model.id);
			if (model) {
				cyclingItems.push(this.toItem(model));
				cyclingKeys.add(key);
			}
		}

		// Per-provider groups: include providers that have any model (configured
		// or not) so the user can discover xAI/Cerebras/etc. even without keys.
		const providerOrder = this.sortedProviders();
		const byProvider = new Map<string, ModelItem[]>();
		for (const provider of providerOrder) byProvider.set(provider, []);
		for (const model of visible) {
			const list = byProvider.get(model.provider);
			if (list) list.push(this.toItem(model));
		}

		const groups = [];

		if (favoriteItems.length > 0) {
			groups.push({
				id: FAVORITES_GROUP_ID,
				header: this.renderPseudoHeader("★", "Favorites", favoriteItems.length, "accent"),
				items: favoriteItems,
			});
		}
		if (recentItems.length > 0) {
			groups.push({
				id: RECENT_GROUP_ID,
				header: this.renderPseudoHeader("⏱", "Recent", recentItems.length, "accent"),
				items: recentItems,
			});
		}
		if (cyclingItems.length > 0) {
			groups.push({
				id: CYCLING_GROUP_ID,
				header: this.renderPseudoHeader("⟳", "Cycling (Ctrl+P)", cyclingItems.length, "accent"),
				items: cyclingItems,
			});
		}

		const currentProvider = this.currentModel?.provider;
		for (const provider of providerOrder) {
			const items = byProvider.get(provider) ?? [];
			const status = this.authByProvider.get(provider) ?? { kind: "missing", configured: false };
			const totalForProvider = this.allModels.filter((m) => m.provider === provider).length;
			// Collapse big providers and unconfigured providers by default; expand
			// the active model's provider so the user always lands somewhere useful.
			const isCurrent = provider === currentProvider;
			const initiallyCollapsed = !isCurrent && (totalForProvider > 25 || !status.configured);
			groups.push({
				id: `provider:${provider}`,
				header: this.renderProviderHeader(provider, status, totalForProvider, items.length),
				items,
				initiallyCollapsed,
				disabled: items.length === 0 && totalForProvider > 0 && !!text,
				emptyHint: status.configured
					? "(no matches in this provider)"
					: status.hint
						? `(${status.hint})`
						: "(unavailable)",
			});
		}

		this.listView.setGroups(groups, true);
		this.refreshStatus(parsed.predicates.length, visible.length);
		this.refreshList();
	}

	private sortedProviders(): string[] {
		const all = new Set<string>();
		for (const model of this.allModels) all.add(model.provider);
		const list = Array.from(all);
		list.sort((a, b) => {
			const aConf = this.authByProvider.get(a)?.configured ? 0 : 1;
			const bConf = this.authByProvider.get(b)?.configured ? 0 : 1;
			if (aConf !== bConf) return aConf - bConf;
			if (a === this.currentModel?.provider) return -1;
			if (b === this.currentModel?.provider) return 1;
			return a.localeCompare(b);
		});
		return list;
	}

	private renderPseudoHeader(icon: string, label: string, count: number, color: "accent" | "muted"): string {
		const head = `${theme.fg(color, icon)} ${theme.fg("accent", label)}`;
		return `${head} ${theme.fg("muted", `(${count})`)}`;
	}

	private renderProviderHeader(provider: string, status: ProviderAuthStatus, total: number, matching: number): string {
		const badge = badgeForStatus(status);
		const name = status.configured ? theme.fg("accent", provider) : theme.fg("dim", provider);
		const counts = matching === total ? theme.fg("muted", `(${total})`) : theme.fg("muted", `(${matching}/${total})`);
		const hint = !status.configured && status.hint ? theme.fg("warning", `  — ${status.hint}`) : "";
		return `${badge} ${name} ${counts}${hint}`;
	}

	private renderGroupHeader(_groupId: string, headerText: string, isSelected: boolean, expanded: boolean): string {
		const arrow = expanded ? "▼" : "▶";
		const arrowText = isSelected ? theme.fg("accent", `${arrow} `) : theme.fg("muted", `${arrow} `);
		const prefix = isSelected ? theme.fg("accent", "→") : " ";
		return `${prefix} ${arrowText}${headerText}`;
	}

	private renderModelLine(item: ModelItem, isSelected: boolean): string {
		const isCurrent = modelsAreEqual(this.currentModel, item.model);
		const star = item.favorite ? theme.fg("accent", "★") : " ";
		const indent = "    ";
		const dim = !item.available;

		const colorize = (text: string): string => {
			if (dim) return theme.fg("dim", text);
			if (isSelected) return theme.fg("accent", text);
			return text;
		};

		const idLabel = colorize(item.id);
		const ctx = formatContext(item.model.contextWindow);
		const reasoning = item.model.reasoning ? "🧠" : " ";
		const vision = item.model.input?.includes("image") ? "👁" : " ";
		const inputCost = formatCost(item.model.cost?.input);
		const outputCost = formatCost(item.model.cost?.output);
		const costStr = inputCost && outputCost ? `${inputCost}/${outputCost}` : inputCost || "";

		const badges: string[] = [];
		if (ctx) badges.push(theme.fg("muted", ctx.padStart(5)));
		badges.push(reasoning);
		badges.push(vision);
		if (costStr) badges.push(theme.fg("muted", costStr));
		const check = isCurrent ? theme.fg("success", " ✓") : "";
		const prefix = isSelected ? theme.fg("accent", "→") : " ";

		return `${prefix} ${indent}${star} ${idLabel}  ${badges.join(" ")}${check}`;
	}

	private refreshList(): void {
		this.listContainer.clear();
		for (const line of this.listView.render(120)) {
			this.listContainer.addChild(new Text(line, 0, 0));
		}
		const sel = this.listView.currentSelection();
		if (sel?.kind === "item") {
			const m = sel.item.model;
			const detailPieces: string[] = [`Provider: ${m.provider}`, `Name: ${m.name}`];
			if (m.contextWindow) detailPieces.push(`Context: ${formatContext(m.contextWindow)}`);
			if (!sel.item.available) {
				const hint = this.authByProvider.get(m.provider)?.hint;
				if (hint) detailPieces.push(theme.fg("warning", `Unavailable — ${hint}`));
				else detailPieces.push(theme.fg("warning", "Unavailable"));
			}
			this.listContainer.addChild(new Spacer(1));
			this.listContainer.addChild(new Text(theme.fg("muted", `  ${detailPieces.join(" · ")}`), 0, 0));
		}
		if (this.errorMessage) {
			for (const line of this.errorMessage.split("\n")) {
				this.listContainer.addChild(new Text(theme.fg("error", line), 0, 0));
			}
		}
	}

	private refreshStatus(predicateCount: number, totalMatching: number): void {
		const totalAll = this.allModels.length;
		const filterHint =
			predicateCount > 0 ? theme.fg("muted", ` · ${predicateCount} filter${predicateCount === 1 ? "" : "s"}`) : "";
		const availabilityHint = this.hideUnavailable ? theme.fg("warning", "  · only configured") : "";
		this.statusText.setText(
			theme.fg("muted", `Pick a model — ${totalMatching} of ${totalAll}`) + filterHint + availabilityHint,
		);
	}

	private renderHints(): string {
		const parts = [
			theme.fg("dim", "↑↓") + theme.fg("muted", " move"),
			theme.fg("dim", "↩") + theme.fg("muted", " pick"),
			theme.fg("dim", "←/→") + theme.fg("muted", " fold"),
			theme.fg("dim", "^F") + theme.fg("muted", " fav"),
			theme.fg("dim", "tab") + theme.fg("muted", " hide-unavail"),
			theme.fg("dim", "r: $: ctx: v: p:") + theme.fg("muted", " filters"),
			theme.fg("dim", "esc") + theme.fg("muted", " cancel"),
		];
		return parts.join(theme.fg("muted", " · "));
	}

	handleInput(keyData: string): void {
		const kb = getKeybindings();

		if (matchesKey(keyData, Key.ctrl("f"))) {
			this.handleToggleFavorite();
			return;
		}
		if (kb.matches(keyData, "tui.input.tab")) {
			this.hideUnavailable = !this.hideUnavailable;
			this.rebuildGroups();
			return;
		}

		// Fold/unfold + arrows + page nav routed to the list.
		if (
			matchesKey(keyData, "left") ||
			matchesKey(keyData, "right") ||
			kb.matches(keyData, "tui.select.up") ||
			kb.matches(keyData, "tui.select.down") ||
			kb.matches(keyData, "tui.select.pageUp") ||
			kb.matches(keyData, "tui.select.pageDown")
		) {
			if (this.listView.handleInput(keyData)) {
				this.refreshList();
				return;
			}
		}
		if (kb.matches(keyData, "tui.select.confirm")) {
			this.confirmSelection();
			return;
		}
		if (kb.matches(keyData, "tui.select.cancel")) {
			this.onCancelCallback();
			return;
		}

		// Anything else is search input.
		this.searchInput.handleInput(keyData);
		this.rebuildGroups();
	}

	private confirmSelection(): void {
		const sel = this.listView.currentSelection();
		if (!sel) return;
		if (sel.kind === "header") {
			this.listView.toggleGroup(sel.group.id);
			this.refreshList();
			return;
		}
		this.handleSelect(sel.item);
	}

	private handleSelect(item: ModelItem): void {
		if (!item.available) {
			const status = this.authByProvider.get(item.provider);
			const hint = status?.hint ?? "configure auth and try again";
			this.statusText.setText(theme.fg("error", `${item.provider}/${item.id} unavailable — ${hint}`));
			this.tui.requestRender();
			return;
		}
		this.settingsManager.setDefaultModelAndProvider(item.provider, item.id);
		this.settingsManager.pushRecentModel(item.provider, item.id);
		this.onSelectCallback(item.model);
	}

	private handleToggleFavorite(): void {
		const sel = this.listView.currentSelection();
		if (!sel || sel.kind !== "item") return;
		this.settingsManager.toggleFavoriteModel(sel.item.provider, sel.item.id);
		this.favoriteRefs = this.settingsManager.getFavoriteModels();
		this.rebuildGroups();
	}
}
