import { Container, Spacer, Text } from "@cave/tui";
import { theme } from "../theme/theme.js";
import { keyText } from "./keybinding-hints.js";

export interface StartupHeaderOptions {
	version: string;
	instructions?: string;
	onboarding?: string;
	caveModeEnabled: boolean;
	caveModeIntensity?: string;
}

function capitalizeKeyPart(part: string): string {
	return part.charAt(0).toUpperCase() + part.slice(1);
}

function formatKeyLabel(key: string): string {
	return key
		.split("/")
		.map((binding) => binding.split("+").map(capitalizeKeyPart).join("+"))
		.join("/");
}

function formatHint(key: string, action: string): string {
	return `${theme.fg("dim", formatKeyLabel(key))}${theme.fg("muted", `: ${action}`)}`;
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
		const hints = [
			formatHint(keyText("app.interrupt"), "cancel"),
			formatHint(keyText("tui.input.submit"), "submit"),
			formatHint("/", "commands"),
			formatHint("!", "bash"),
		].join("\n");
		const onboarding = theme.fg(
			"dim",
			"Cave can explain its own features and look up its docs. Ask it how to use or extend Cave.",
		);

		this.addChild(new Text(logo, 1, 0));
		this.addChild(new Spacer(1));
		this.addChild(new Text(hints, 1, 0));
		this.addChild(new Spacer(1));
		this.addChild(new Text(onboarding, 1, 0));
		if (caveModeEnabled) {
			const compression = caveModeIntensity ?? "enabled";
			this.addChild(new Text(theme.fg("accent", `cave mode: active | compression: ${compression}`), 1, 0));
		}
	}
}
