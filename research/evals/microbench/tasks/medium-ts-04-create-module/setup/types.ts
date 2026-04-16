/**
 * Logger interface for structured logging across the application.
 * Implementations should handle message formatting and output.
 */
export interface Logger {
  /** Log an informational message */
  log(message: string, ...args: unknown[]): void;

  /** Log a warning message */
  warn(message: string, ...args: unknown[]): void;

  /** Log an error message */
  error(message: string, ...args: unknown[]): void;
}

/**
 * Log levels for filtering output.
 */
export type LogLevel = "info" | "warn" | "error";
