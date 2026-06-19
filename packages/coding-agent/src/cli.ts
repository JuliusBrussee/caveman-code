#!/usr/bin/env node
/**
 * CLI entry point for the refactored coding agent.
 * Uses main.ts with AgentSession and new mode modules.
 *
 * Test with: npx tsx src/cli-new.ts [args...]
 */
process.title = "caveman-code";
process.emitWarning = (() => {}) as typeof process.emitWarning;

import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";
import { main } from "./main.js";

type StdioWriteError = Error & {
	code?: string;
	errno?: number | string;
	syscall?: string;
};

function isClosedStdioWrite(error: StdioWriteError): boolean {
	if (error.syscall !== "write") return false;
	if (error.code === "EPIPE" || error.code === "ERR_STREAM_DESTROYED") return true;
	// Some embedded PTY hosts surface a failed output stream as libuv EDQUOT
	// (errno -122) instead of a more specific stream error on recent Node versions.
	return error.errno === -122 || error.errno === "-122" || error.code === "Unknown system error -122";
}

function getStdioWriteExitCode(error: StdioWriteError): number {
	return error.errno === -122 || error.errno === "-122" || error.code === "Unknown system error -122" ? 1 : 0;
}

function installStdioWriteErrorHandlers(): void {
	let exiting = false;
	const handleError = (error: Error) => {
		if (!isClosedStdioWrite(error)) {
			throw error;
		}
		if (exiting) return;
		exiting = true;
		const exitCode = getStdioWriteExitCode(error);
		process.exitCode = exitCode;
		setImmediate(() => process.exit(exitCode));
	};

	process.stdout.on("error", handleError);
	process.stderr.on("error", handleError);
}

setGlobalDispatcher(new EnvHttpProxyAgent());
installStdioWriteErrorHandlers();

main(process.argv.slice(2));
