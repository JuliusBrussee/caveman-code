// T-067, T-068: session-scoped incremental refresh cache.

export interface RepomapFingerprint {
	gitHead: string;
	mtimes: Map<string, number>;
	intervalMs: number;
	lastRefreshMs: number;
}

export interface CachedRepomap {
	rendered: string;
	fingerprint: RepomapFingerprint;
}

export class RepomapCache {
	private entry: CachedRepomap | null = null;

	get(now: () => number = Date.now): CachedRepomap | null {
		if (!this.entry) return null;
		if (now() - this.entry.fingerprint.lastRefreshMs > this.entry.fingerprint.intervalMs) {
			return null;
		}
		return this.entry;
	}

	put(rendered: string, fingerprint: RepomapFingerprint): void {
		this.entry = { rendered, fingerprint };
	}

	/** Invalidate if HEAD changed or any mtime differs. */
	isStale(headNow: string, mtimesNow: Map<string, number>): boolean {
		if (!this.entry) return true;
		const f = this.entry.fingerprint;
		if (f.gitHead !== headNow) return true;
		if (f.mtimes.size !== mtimesNow.size) return true;
		for (const [file, mtime] of f.mtimes) {
			if (mtimesNow.get(file) !== mtime) return true;
		}
		return false;
	}

	invalidate(): void {
		this.entry = null;
	}
}
