import { Container, Text } from "@cave/tui";
import { theme } from "../theme/theme.js";

export interface StartupHeaderOptions {
	version: string;
	instructions?: string;
	onboarding?: string;
	caveModeEnabled: boolean;
	caveModeIntensity?: string;
}

export class StartupHeaderComponent extends Container {
	constructor({
		version,
		instructions: _instructions,
		onboarding: _onboarding,
		caveModeEnabled,
		caveModeIntensity,
	}: StartupHeaderOptions) {
		super();

		const logo = [
			theme.bold(theme.fg("brand", "    /\\          Caveman Code")),
			`${theme.bold(theme.fg("brand", "   /  \\__"))}${theme.fg("dim", `       v${version}`)}`,
			theme.bold(theme.fg("brand", "  / /\\   \\__")),
			theme.bold(theme.fg("brand", " /_/  \\_____\\")),
		].join("\n");

		this.addChild(new Text(logo, 1, 0));
		if (caveModeEnabled) {
			const compression = caveModeIntensity ?? "enabled";
			this.addChild(new Text(theme.fg("accent", `cave mode: active | compression: ${compression}`), 1, 0));
		}
	}
}
