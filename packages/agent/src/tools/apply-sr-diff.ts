// T-038, T-040: apply_sr_diff exact-match search/replace tool +
// structured no_match/ambiguous diagnostics.

export type ApplyStatus = "ok" | "no_match" | "ambiguous";

export interface ApplyMatch {
	start: number;
	end: number;
	line: number;
}

export interface ApplySuccess {
	status: "ok";
	newContent: string;
	match: ApplyMatch;
}

export interface ApplyNoMatch {
	status: "no_match";
	reason: "no_match";
}

export interface ApplyAmbiguous {
	status: "ambiguous";
	reason: "ambiguous";
	matches: ApplyMatch[];
}

export type ApplyResult = ApplySuccess | ApplyNoMatch | ApplyAmbiguous;

function lineOf(content: string, offset: number): number {
	let line = 1;
	for (let i = 0; i < offset && i < content.length; i++) {
		if (content.charCodeAt(i) === 10) line++;
	}
	return line;
}

function findAllExact(haystack: string, needle: string): ApplyMatch[] {
	if (needle.length === 0) return [];
	const matches: ApplyMatch[] = [];
	let from = 0;
	while (true) {
		const idx = haystack.indexOf(needle, from);
		if (idx === -1) break;
		matches.push({
			start: idx,
			end: idx + needle.length,
			line: lineOf(haystack, idx),
		});
		from = idx + needle.length;
	}
	return matches;
}

/** Perform an exact-match search/replace on `content`. Must match exactly once. */
export function applySrDiff(
	content: string,
	search: string,
	replace: string,
): ApplyResult {
	const matches = findAllExact(content, search);
	if (matches.length === 0) {
		return { status: "no_match", reason: "no_match" };
	}
	if (matches.length > 1) {
		return { status: "ambiguous", reason: "ambiguous", matches };
	}
	const [m] = matches;
	const newContent = content.slice(0, m.start) + replace + content.slice(m.end);
	return { status: "ok", newContent, match: m };
}
