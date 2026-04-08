import { Container, Spacer, Text } from "@cavepi/pi-tui";
import { theme } from "../theme/theme.js";
import { DynamicBorder } from "./dynamic-border.js";

export class EarendilAnnouncementComponent extends Container {
	constructor() {
		super();

		this.addChild(new DynamicBorder((text) => theme.fg("accent", text)));
		this.addChild(new Text(theme.bold(theme.fg("accent", "Caveman Code")), 1, 0));
		this.addChild(new Spacer(1));
		this.addChild(new Text(theme.fg("muted", "Cave Mode: active | Compression: enabled"), 1, 0));
		this.addChild(new Text(theme.fg("muted", "Token savings via cave compression are active."), 1, 0));
		this.addChild(new DynamicBorder((text) => theme.fg("accent", text)));
	}
}
