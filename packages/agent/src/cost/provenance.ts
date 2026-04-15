// T-091, T-092: memory/summary provenance tracking.

export interface ProvenanceStamp {
	turnIndex: number;
	sourceMessageIds: string[];
}

export interface ProvenancedEntry<T> {
	value: T;
	provenance: ProvenanceStamp;
}

export class ProvenanceRegistry {
	private knownMessageIds = new Set<string>();
	private entries: ProvenancedEntry<unknown>[] = [];

	register(messageId: string): void {
		this.knownMessageIds.add(messageId);
	}

	stamp<T>(value: T, turnIndex: number, sourceMessageIds: string[]): ProvenancedEntry<T> {
		for (const id of sourceMessageIds) {
			if (!this.knownMessageIds.has(id)) {
				throw new Error(`provenance: unknown source message id ${id}`);
			}
		}
		const entry: ProvenancedEntry<T> = {
			value,
			provenance: { turnIndex, sourceMessageIds },
		};
		this.entries.push(entry);
		return entry;
	}

	all(): readonly ProvenancedEntry<unknown>[] {
		return [...this.entries];
	}
}
