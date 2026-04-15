// T-016..T-019
import { describe, expect, it } from "vitest";
import {
	__resetLandlockCache,
	buildSeatbeltProfile,
	detectLandlockSupport,
	landlockSandbox,
	parseKernelVersion,
	seatbeltSandbox,
	selectSandbox,
	supportsLandlock,
	WINDOWS_UNSUPPORTED_WARNING,
	windowsSandbox,
} from "../sandbox/index.js";

describe("seatbelt sandbox", () => {
	it("denies writes outside workdir and denies network by default", () => {
		const profile = buildSeatbeltProfile("/Users/cave/proj", {});
		expect(profile).toContain("(deny default)");
		expect(profile).toContain('(allow file-write* (subpath "/Users/cave/proj"))');
		expect(profile).toContain("(deny network*)");
	});

	it("denies sensitive home paths (.ssh etc.)", () => {
		const profile = buildSeatbeltProfile("/Users/cave/proj", {});
		expect(profile).toContain('(deny file-read* (subpath "~/.ssh"))');
		expect(profile).toContain('(deny file-write* (subpath "~/.aws"))');
		expect(profile).toContain('(deny file-read* (subpath "~/.gnupg"))');
	});

	it("allows network when allow.network=true", () => {
		const profile = buildSeatbeltProfile("/tmp/wd", { network: true });
		expect(profile).toContain("(allow network*)");
		expect(profile).not.toContain("(deny network*)");
	});

	it("wrap emits sandbox-exec invocation with inline profile", () => {
		const sb = seatbeltSandbox("/tmp/wd");
		const wrapped = sb.wrap("echo hi");
		expect(wrapped).toMatch(/^sandbox-exec -p /);
		expect(wrapped).toContain("echo hi");
	});
});

describe("landlock sandbox", () => {
	it("parses kernel version", () => {
		expect(parseKernelVersion("5.15.0-76-generic")).toEqual({ major: 5, minor: 15 });
		expect(parseKernelVersion("6.8.0")).toEqual({ major: 6, minor: 8 });
		expect(parseKernelVersion("garbage")).toEqual({ major: 0, minor: 0 });
	});

	it("requires kernel 5.13+", () => {
		expect(supportsLandlock({ major: 5, minor: 12 })).toBe(false);
		expect(supportsLandlock({ major: 5, minor: 13 })).toBe(true);
		expect(supportsLandlock({ major: 6, minor: 0 })).toBe(true);
	});

	it("falls back to permissive on old kernel", () => {
		__resetLandlockCache();
		const supported = detectLandlockSupport("linux", "5.10.0");
		expect(supported).toBe(false);
		const sb = landlockSandbox("/tmp/wd", {}, supported);
		expect(sb.profile.kind).toBe("permissive");
		expect(sb.profile.permissiveReason).toMatch(/kernel/);
	});

	it("caches detection result", () => {
		__resetLandlockCache();
		const a = detectLandlockSupport("linux", "6.5.0");
		const b = detectLandlockSupport("linux", "4.0.0"); // would differ if uncached
		expect(a).toBe(true);
		expect(b).toBe(true); // served from cache
	});
});

describe("windows sandbox", () => {
	it("runs permissive and wraps command unchanged", () => {
		const sb = windowsSandbox("C:/tmp/wd");
		expect(sb.profile.kind).toBe("permissive");
		expect(sb.wrap("echo hi")).toBe("echo hi");
	});

	it("has the unsupported warning text naming Windows + no Job Objects / AppContainer", () => {
		expect(WINDOWS_UNSUPPORTED_WARNING).toMatch(/Windows/);
		expect(WINDOWS_UNSUPPORTED_WARNING).toMatch(/No Job Objects or AppContainer/);
	});
});

describe("selectSandbox", () => {
	it("picks seatbelt on darwin", () => {
		__resetLandlockCache();
		const sel = selectSandbox("darwin", "", "/Users/cave/proj");
		expect(sel.sandbox.profile.kind).toBe("seatbelt");
	});

	it("picks landlock on linux 5.15", () => {
		__resetLandlockCache();
		const sel = selectSandbox("linux", "5.15.0", "/tmp/wd");
		expect(sel.sandbox.profile.kind).toBe("landlock");
		expect(sel.warning).toBeUndefined();
	});

	it("warns and runs permissive on old linux kernel", () => {
		__resetLandlockCache();
		const sel = selectSandbox("linux", "5.10.0", "/tmp/wd");
		expect(sel.sandbox.profile.kind).toBe("permissive");
		expect(sel.warning).toMatch(/landlock unsupported/);
	});

	it("warns and runs permissive on win32", () => {
		const sel = selectSandbox("win32", "", "C:/tmp/wd");
		expect(sel.sandbox.profile.kind).toBe("permissive");
		expect(sel.warning).toContain("Windows");
	});
});
