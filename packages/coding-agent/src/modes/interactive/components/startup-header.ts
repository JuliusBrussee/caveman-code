import { Container, Text } from "@cave/tui";
import { theme } from "../theme/theme.js";
import { BannerComponent, type BannerSprite } from "./banner.js";
import { SessionPanelComponent } from "./session-panel.js";

export interface StartupHeaderOptions {
	version: string;
	instructions?: string;
	onboarding?: string;
	caveModeEnabled: boolean;
	caveModeIntensity?: string;
	model?: string;
	contextWindow?: string;
	effort?: string;
	cwd?: string;
	sprite?: BannerSprite;
	mode?: string;
	auth?: string;
}

export class StartupHeaderComponent extends Container {
	constructor({
		version,
		instructions: _instructions,
		onboarding: _onboarding,
		caveModeEnabled,
		caveModeIntensity,
		model,
		contextWindow,
		effort,
		cwd,
		sprite,
		mode,
		auth,
	}: StartupHeaderOptions) {
		super();

		this.addChild(
			new BannerComponent({
				version,
				model,
				contextWindow,
				effort,
				cwd,
				sprite,
			}),
		);

		this.addChild(new SessionPanelComponent({ mode, auth }));

		if (caveModeEnabled) {
			const compression = caveModeIntensity ?? "enabled";
			this.addChild(new Text(theme.fg("accent", `cave mode: active | compression: ${compression}`), 1, 0));
		}
	}
}
