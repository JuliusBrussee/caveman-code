/**
 * Truncates a string to maxLen characters, appending "..." if truncated.
 * If the string length is exactly maxLen, it should NOT be truncated.
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length < maxLen) {
    return str;
  }
  return str.slice(0, maxLen - 3) + "...";
}

/**
 * Capitalizes the first letter of each word in a string.
 */
export function titleCase(str: string): string {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Counts the number of occurrences of a substring.
 */
export function countOccurrences(str: string, sub: string): number {
  if (sub.length === 0) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = str.indexOf(sub, pos)) !== -1) {
    count++;
    pos += sub.length;
  }
  return count;
}
