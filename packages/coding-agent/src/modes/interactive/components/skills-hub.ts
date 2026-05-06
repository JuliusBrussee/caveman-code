import {
	type Component,
	Container,
	getKeybindings,
	type OverlayHandle,
	SelectList,
	type SelectListTheme,
	Spacer,
	Text,
	type TUI,
} from "@cave/tui";
import { theme } from "../theme/theme.js";

export type SkillSourceTag = "bundled" | "user" | "project" | "marketplace";

export interface SkillEntry {
	name: string;
	description?: string;
	source: SkillSourceTag;
	/** Optional path / install hint shown in the inspect view. */
	location?: string;
}

export interface SkillCategory {
	id: SkillSourceTag;
	label: string;
	skills: SkillEntry[];
}

export interface SkillAction {
	type: "inspect" | "install";
	skill: SkillEntry;
}

interface InternalOpts {
	categories: SkillCategory[];
	onAction: (action: SkillAction) => void;
	onClose: () => void;
}

type Stage = "categories" | "skills" | "actions";

const SOURCE_TAG: Record<SkillSourceTag, string> = {
	bundled: "[t]",
	user: "[u]",
	project: "[p]",
	marketplace: "[mkt]",
};

export class SkillsHubComponent extends Container {
	private stage: Stage = "categories";
	private currentCategory: SkillCategory | undefined;
	private currentSkill: SkillEntry | undefined;
	private listSlot: Container;
	private titleText: Text;
	private hintText: Text;

	constructor(private readonly opts: InternalOpts) {
		super();
		this.titleText = new Text("", 1, 0);
		this.addChild(this.titleText);
		this.addChild(new Spacer(1));
		this.listSlot = new Container();
		this.addChild(this.listSlot);
		this.addChild(new Spacer(1));
		this.hintText = new Text("", 1, 0);
		this.addChild(this.hintText);
		this.renderCategories();
	}

	handleInput(data: string): void {
		const child = this.listSlot.children[0];
		if (child && typeof (child as { handleInput?: (d: string) => void }).handleInput === "function") {
			(child as { handleInput: (d: string) => void }).handleInput(data);
		}
		const kb = getKeybindings();
		// Esc cascades back through stages.
		if (kb.matches(data, "tui.select.cancel")) {
			if (this.stage === "actions") {
				this.renderSkills(this.currentCategory!);
				return;
			}
			if (this.stage === "skills") {
				this.renderCategories();
				return;
			}
			this.opts.onClose();
		}
	}

	private renderCategories(): void {
		this.stage = "categories";
		this.currentCategory = undefined;
		this.currentSkill = undefined;
		this.titleText.setText(theme.bold(theme.fg("accent", "Skills hub")));
		this.hintText.setText(theme.fg("dim", "↑/↓ select · Enter open · Esc close"));
		const items = this.opts.categories.map((cat) => ({
			value: cat.id,
			label: `${cat.label}  ${theme.fg("dim", `(${cat.skills.length})`)}`,
		}));
		const list = new SelectList(items, 10, selectListTheme());
		list.onSelect = (item) => {
			const found = this.opts.categories.find((c) => c.id === item.value);
			if (found) this.renderSkills(found);
		};
		list.onCancel = () => this.opts.onClose();
		this.replaceList(list);
	}

	private renderSkills(category: SkillCategory): void {
		this.stage = "skills";
		this.currentCategory = category;
		this.titleText.setText(`${theme.bold(theme.fg("accent", "Skills"))}  ${theme.fg("dim", `· ${category.label}`)}`);
		this.hintText.setText(theme.fg("dim", "↑/↓ select · Enter actions · Esc back"));
		const items = category.skills.length
			? category.skills.map((s) => ({
					value: s.name,
					label: `${theme.fg("dim", SOURCE_TAG[s.source])} ${s.name}`,
					description: s.description,
				}))
			: [{ value: "__empty__", label: theme.fg("dim", "(no skills in this category)") }];
		const list = new SelectList(items, 10, selectListTheme());
		list.onSelect = (item) => {
			if (item.value === "__empty__") return;
			const skill = category.skills.find((s) => s.name === item.value);
			if (skill) this.renderActions(skill);
		};
		list.onCancel = () => this.renderCategories();
		this.replaceList(list);
	}

	private renderActions(skill: SkillEntry): void {
		this.stage = "actions";
		this.currentSkill = skill;
		this.titleText.setText(
			`${theme.bold(theme.fg("accent", skill.name))}  ${theme.fg("dim", SOURCE_TAG[skill.source])}`,
		);
		this.hintText.setText(theme.fg("dim", "i inspect · x install · Esc back"));
		const inspectLabel = `inspect  ${theme.fg("dim", "show metadata")}`;
		const installLabel = skill.source === "marketplace" ? "install" : `${theme.fg("dim", "install (already local)")}`;
		const items = [
			{ value: "inspect", label: inspectLabel, description: skill.description },
			{ value: "install", label: installLabel, description: skill.location },
		];
		const list = new SelectList(items, 6, selectListTheme());
		list.onSelect = (item) => {
			if (item.value === "inspect") this.opts.onAction({ type: "inspect", skill });
			else if (item.value === "install") this.opts.onAction({ type: "install", skill });
		};
		list.onCancel = () => this.renderSkills(this.currentCategory!);
		this.replaceList(list);
	}

	private replaceList(list: Component): void {
		this.listSlot.clear();
		this.listSlot.addChild(list);
	}
}

function selectListTheme(): SelectListTheme {
	return {
		selectedPrefix: (text) => theme.fg("accent", text),
		selectedText: (text) => theme.fg("accent", text),
		description: (text) => theme.fg("dim", text),
		scrollInfo: (text) => theme.fg("dim", text),
		noMatch: (text) => theme.fg("dim", text),
	};
}

export interface ShowSkillsHubOptions {
	categories: SkillCategory[];
	onAction?: (action: SkillAction) => void;
}

export async function showSkillsHub(tui: TUI, opts: ShowSkillsHubOptions): Promise<SkillAction | null> {
	return new Promise((resolve) => {
		let handle: OverlayHandle | null = null;
		const cleanup = (action: SkillAction | null): void => {
			handle?.hide();
			resolve(action);
		};
		const component = new SkillsHubComponent({
			categories: opts.categories,
			onAction: (action) => {
				opts.onAction?.(action);
				cleanup(action);
			},
			onClose: () => cleanup(null),
		});
		handle = tui.showOverlay(component, { anchor: "center" });
		handle.focus();
	});
}
