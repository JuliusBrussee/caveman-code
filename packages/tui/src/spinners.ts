export interface SpinnerVariant {
	readonly frames: readonly string[];
	readonly interval: number;
}

const dots: SpinnerVariant = {
	frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
	interval: 80,
};

const helix: SpinnerVariant = {
	frames: ["⠁", "⠂", "⠄", "⡀", "⢀", "⠠", "⠐", "⠈"],
	interval: 90,
};

const breathe: SpinnerVariant = {
	frames: ["·", "•", "●", "•"],
	interval: 220,
};

const orbit: SpinnerVariant = {
	frames: ["◜", "◠", "◝", "◞", "◡", "◟"],
	interval: 110,
};

const dna: SpinnerVariant = {
	frames: ["⡀⠀", "⠄⠀", "⠂⠀", "⠁⠀", "⠈⠀", "⠐⠀", "⠠⠀", "⢀⠀"],
	interval: 100,
};

const waverows: SpinnerVariant = {
	frames: ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█", "▇", "▆", "▅", "▄", "▃", "▂"],
	interval: 90,
};

const snake: SpinnerVariant = {
	frames: [
		"▰▱▱▱▱▱▱",
		"▰▰▱▱▱▱▱",
		"▰▰▰▱▱▱▱",
		"▰▰▰▰▱▱▱",
		"▰▰▰▰▰▱▱",
		"▰▰▰▰▰▰▱",
		"▰▰▰▰▰▰▰",
		"▱▰▰▰▰▰▰",
		"▱▱▰▰▰▰▰",
		"▱▱▱▰▰▰▰",
		"▱▱▱▱▰▰▰",
		"▱▱▱▱▱▰▰",
		"▱▱▱▱▱▱▰",
		"▱▱▱▱▱▱▱",
	],
	interval: 100,
};

const pulse: SpinnerVariant = {
	frames: ["○", "◔", "◑", "◕", "●", "◕", "◑", "◔"],
	interval: 130,
};

const cascade: SpinnerVariant = {
	frames: ["▏", "▎", "▍", "▌", "▋", "▊", "▉", "█", "▉", "▊", "▋", "▌", "▍", "▎"],
	interval: 90,
};

const scan: SpinnerVariant = {
	frames: [
		"[●         ]",
		"[ ●        ]",
		"[  ●       ]",
		"[   ●      ]",
		"[    ●     ]",
		"[     ●    ]",
		"[      ●   ]",
		"[       ●  ]",
		"[        ● ]",
		"[         ●]",
		"[        ● ]",
		"[       ●  ]",
		"[      ●   ]",
		"[     ●    ]",
		"[    ●     ]",
		"[   ●      ]",
		"[  ●       ]",
		"[ ●        ]",
	],
	interval: 90,
};

const diagswipe: SpinnerVariant = {
	frames: ["⠁⠀⠀", "⠂⠁⠀", "⠄⠂⠁", "⡀⠄⠂", "⠀⡀⠄", "⠀⠀⡀", "⠀⠀⠀"],
	interval: 110,
};

const fillsweep: SpinnerVariant = {
	frames: ["▱▱▱▱▱", "▰▱▱▱▱", "▰▰▱▱▱", "▰▰▰▱▱", "▰▰▰▰▱", "▰▰▰▰▰", "▱▰▰▰▰", "▱▱▰▰▰", "▱▱▱▰▰", "▱▱▱▱▰"],
	interval: 110,
};

const rain: SpinnerVariant = {
	frames: ["⡀", "⡄", "⡆", "⡇", "⠇", "⠃", "⠁", " "],
	interval: 90,
};

const columns: SpinnerVariant = {
	frames: ["▁ ▁ ▁", "▃ ▁ ▁", "▅ ▃ ▁", "▇ ▅ ▃", "█ ▇ ▅", "▇ █ ▇", "▅ ▇ █", "▃ ▅ ▇", "▁ ▃ ▅", "▁ ▁ ▃"],
	interval: 110,
};

const sparkle: SpinnerVariant = {
	frames: ["·", "✦", "✧", "✦", "·", " "],
	interval: 160,
};

export const SPINNERS = {
	dots,
	helix,
	breathe,
	orbit,
	dna,
	waverows,
	snake,
	pulse,
	cascade,
	scan,
	diagswipe,
	fillsweep,
	rain,
	columns,
	sparkle,
} as const;

export type SpinnerName = keyof typeof SPINNERS;

export const THINKING_SPINNERS: readonly SpinnerName[] = [
	"helix",
	"breathe",
	"orbit",
	"dna",
	"waverows",
	"snake",
	"pulse",
];

export const TOOL_SPINNERS: readonly SpinnerName[] = [
	"cascade",
	"scan",
	"diagswipe",
	"fillsweep",
	"rain",
	"columns",
	"sparkle",
];

export function getSpinner(name: string | undefined, fallback: SpinnerName): SpinnerVariant {
	if (name && name in SPINNERS) {
		return SPINNERS[name as SpinnerName];
	}
	return SPINNERS[fallback];
}
