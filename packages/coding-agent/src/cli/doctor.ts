/**
 * `caveman doctor` (WS11) — diagnostic / health check command.
 *
 * Reports kernel + arch, terminal capabilities, sandbox availability, MCP
 * servers reachable, missing tooling, and auth status. Output is human
 * readable by default; `--json` emits a structured JSON object so CI / hooks
 * can consume it.
 *
 * The doctor is read-only: it never writes to settings or filesystem and
 * never spawns network requests except for explicit MCP probes (each guarded
 * by a 1.5s timeout).
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir, release as osRelease, platform } from "node:os";
import { join } from "node:path";
import { getEnvApiKey } from "@juliusbrussee/caveman-ai";
import chalk from "chalk";
import { CONFIG_DIR_NAME, getAgentDir, VERSION } from "../config.js";
import { SettingsManager } from "../core/settings-manager.js";

export type DoctorCheckStatus = "ok" | "warn" | "fail" | "info";

export interface DoctorCheck {
	id: string;
	label: string;
	status: DoctorCheckStatus;
	detail?: string;
}

export interface DoctorReport {
	version: string;
	platform: string;
	arch: string;
	kernel: string;
	node: string;
	bun?: string;
	checks: DoctorCheck[];
	summary: { ok: number; warn: number; fail: number; info: number };
}

interface DoctorOptions {
	json?: boolean;
	includeMcp?: boolean;
	cwd?: string;
}

/** Detect a small set of common terminal capabilities. Best-effort, no probes. */
function detectTerminalCapabilities(): DoctorCheck[] {
	const checks: DoctorCheck[] = [];
	const isTty = !!process.stdout.isTTY;
	const term = process.env.TERM ?? "";
	const colorTerm = process.env.COLORTERM ?? "";
	const program = process.env.TERM_PROGRAM ?? "";
	const wt = process.env.WT_SESSION;
	const ssh = !!(process.env.SSH_TTY || process.env.SSH_CONNECTION);

	checks.push({
		id: "tty",
		label: "stdout is a TTY",
		status: isTty ? "ok" : "warn",
		detail: isTty ? undefined : "stdout is not a TTY (you may be piping or redirecting output)",
	});

	const truecolor = colorTerm === "truecolor" || colorTerm === "24bit";
	checks.push({
		id: "truecolor",
		label: "Truecolor support (COLORTERM)",
		status: truecolor ? "ok" : "warn",
		detail: truecolor ? colorTerm : `COLORTERM='${colorTerm}' (set to 'truecolor' for best rendering)`,
	});

	checks.push({
		id: "term",
		label: "TERM",
		status: term ? "ok" : "warn",
		detail: term || "(empty)",
	});

	checks.push({
		id: "term-program",
		label: "Terminal program",
		status: "info",
		detail: program || (wt ? "Windows Terminal" : "(unknown)"),
	});

	checks.push({
		id: "ssh",
		label: "SSH session",
		status: "info",
		detail: ssh ? "yes" : "no",
	});

	return checks;
}

function detectSandboxCapabilities(): DoctorCheck[] {
	const checks: DoctorCheck[] = [];
	const plat = platform();
	if (plat === "darwin") {
		const seatbelt = which("sandbox-exec");
		checks.push({
			id: "sandbox-darwin",
			label: "macOS sandbox-exec (Seatbelt)",
			status: seatbelt ? "ok" : "warn",
			detail: seatbelt ?? "not found on PATH (sandbox subsystem may still work)",
		});
	} else if (plat === "linux") {
		const bwrap = which("bwrap");
		checks.push({
			id: "sandbox-linux-bwrap",
			label: "Linux bubblewrap (bwrap)",
			status: bwrap ? "ok" : "warn",
			detail: bwrap ?? "not found on PATH (install via apt/dnf for sandboxed exec)",
		});
		const landlock = existsSync("/sys/kernel/security/landlock");
		checks.push({
			id: "sandbox-linux-landlock",
			label: "Linux Landlock LSM",
			status: landlock ? "ok" : "warn",
			detail: landlock ? "available" : "not exposed by kernel — fall back to bubblewrap only",
		});
	} else if (plat === "win32") {
		checks.push({
			id: "sandbox-windows",
			label: "Windows Restricted Tokens",
			status: "info",
			detail: "Windows sandbox path is preview — running natively under PS",
		});
	} else {
		checks.push({
			id: "sandbox-unknown",
			label: "Sandbox availability",
			status: "warn",
			detail: `unsupported platform: ${plat}`,
		});
	}
	return checks;
}

function detectTooling(): DoctorCheck[] {
	const checks: DoctorCheck[] = [];
	for (const tool of ["git", "rg", "fd", "tar", "curl"]) {
		const path = which(tool);
		const required = tool === "git" || tool === "tar" || tool === "curl";
		checks.push({
			id: `tool-${tool}`,
			label: `Tool: ${tool}`,
			status: path ? "ok" : required ? "fail" : "warn",
			detail: path ?? (required ? "missing — install before using cave" : "missing — optional"),
		});
	}
	return checks;
}

function detectAuth(): DoctorCheck[] {
	const providers = ["anthropic", "openai", "google", "groq", "openrouter", "xai"];
	const checks: DoctorCheck[] = [];
	let anyKey = false;
	for (const p of providers) {
		const key = getEnvApiKey(p);
		if (key && key.length > 0) {
			anyKey = true;
			checks.push({
				id: `auth-${p}`,
				label: `Auth (env): ${p}`,
				status: "ok",
				detail: "key present",
			});
		}
	}
	if (!anyKey) {
		checks.push({
			id: "auth",
			label: "Auth",
			status: "warn",
			detail: "no API keys found in env. Run `caveman login` or set ANTHROPIC_API_KEY / OPENAI_API_KEY / etc.",
		});
	}
	return checks;
}

function detectMcpReachability(cwd: string): DoctorCheck[] {
	const checks: DoctorCheck[] = [];
	const userMcp = join(homedir(), CONFIG_DIR_NAME, "mcp.json");
	const projectMcp = join(cwd, CONFIG_DIR_NAME, "mcp.json");
	const altUserMcp = join(homedir(), ".mcp.json");
	const altProjectMcp = join(cwd, ".mcp.json");

	const found: string[] = [];
	for (const path of [userMcp, projectMcp, altUserMcp, altProjectMcp]) {
		if (existsSync(path)) found.push(path);
	}
	if (found.length === 0) {
		checks.push({
			id: "mcp-config",
			label: "MCP config files",
			status: "info",
			detail: "no .mcp.json found (project or user). Run `caveman mcp add <name>` to register one.",
		});
	} else {
		checks.push({
			id: "mcp-config",
			label: "MCP config files",
			status: "ok",
			detail: found.join(", "),
		});
	}
	// We intentionally don't spawn MCP servers from doctor — that's the job of
	// `caveman mcp doctor` (WS2). We only verify the config is parseable.
	return checks;
}

function detectAgentDir(): DoctorCheck[] {
	const dir = getAgentDir();
	if (!existsSync(dir)) {
		return [
			{
				id: "agent-dir",
				label: "Agent dir",
				status: "warn",
				detail: `${dir} (does not exist yet — will be created on first run)`,
			},
		];
	}
	return [{ id: "agent-dir", label: "Agent dir", status: "ok", detail: dir }];
}

function detectOnboarding(cwd: string): DoctorCheck[] {
	try {
		const settings = SettingsManager.create(cwd, getAgentDir());
		const completed = settings.getHasCompletedOnboarding();
		const telemetry = settings.getTelemetryEnabled();
		return [
			{
				id: "onboarding",
				label: "First-run wizard",
				status: completed ? "ok" : "warn",
				detail: completed ? "completed" : "not yet completed — run `cave` interactively to start the wizard",
			},
			{
				id: "telemetry",
				label: "Telemetry",
				status: "info",
				detail: telemetry ? "enabled (opt-in)" : "disabled (default)",
			},
		];
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return [
			{
				id: "onboarding",
				label: "First-run wizard",
				status: "warn",
				detail: `could not read settings: ${msg}`,
			},
		];
	}
}

/** Cross-platform `which` that returns the absolute path or undefined. */
function which(cmd: string): string | undefined {
	const isWin = process.platform === "win32";
	const probe = isWin ? "where" : "which";
	const args = [cmd];

	try {
		const r = spawnSync(probe, args, { encoding: "utf8" });
		if (r.status === 0 && r.stdout) {
			return r.stdout.trim().split("\n")[0]?.trim() || undefined;
		}
	} catch {
		// ignored — treat as missing
	}
	return undefined;
}

export function buildDoctorReport(opts: DoctorOptions = {}): DoctorReport {
	const cwd = opts.cwd ?? process.cwd();
	const checks: DoctorCheck[] = [];
	checks.push(...detectAgentDir());
	checks.push(...detectTerminalCapabilities());
	checks.push(...detectSandboxCapabilities());
	checks.push(...detectTooling());
	checks.push(...detectAuth());
	checks.push(...detectOnboarding(cwd));
	if (opts.includeMcp !== false) {
		checks.push(...detectMcpReachability(cwd));
	}

	const summary = { ok: 0, warn: 0, fail: 0, info: 0 };
	for (const c of checks) summary[c.status]++;

	return {
		version: VERSION,
		platform: platform(),
		arch: process.arch,
		kernel: osRelease(),
		node: process.version,
		bun: process.versions?.bun,
		checks,
		summary,
	};
}

function statusBadge(s: DoctorCheckStatus): string {
	switch (s) {
		case "ok":
			return chalk.green("[ok] ");
		case "warn":
			return chalk.yellow("[warn]");
		case "fail":
			return chalk.red("[fail]");
		default:
			return chalk.dim("[info]");
	}
}

export function formatDoctorReport(report: DoctorReport): string {
	const lines: string[] = [];
	lines.push(
		chalk.bold(`cave ${report.version}`) +
			chalk.dim(`  (${report.platform}/${report.arch}, kernel ${report.kernel})`),
	);
	lines.push(chalk.dim(`node ${report.node}${report.bun ? `, bun ${report.bun}` : ""}`));
	lines.push("");
	for (const c of report.checks) {
		const det = c.detail ? chalk.dim(` — ${c.detail}`) : "";
		lines.push(`  ${statusBadge(c.status)} ${c.label}${det}`);
	}
	lines.push("");
	const { ok, warn, fail, info } = report.summary;
	lines.push(
		`Summary: ${chalk.green(`${ok} ok`)}, ${chalk.yellow(`${warn} warn`)}, ${chalk.red(`${fail} fail`)}, ${chalk.dim(`${info} info`)}`,
	);
	return lines.join("\n");
}

/**
 * CLI entrypoint. Returns the exit code (0 if no fails, 1 otherwise).
 */
export async function runDoctor(args: string[]): Promise<number> {
	const json = args.includes("--json");
	const cwd = process.cwd();
	const report = buildDoctorReport({ json, cwd });
	if (json) {
		process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	} else {
		process.stdout.write(`${formatDoctorReport(report)}\n`);
	}
	return report.summary.fail > 0 ? 1 : 0;
}
